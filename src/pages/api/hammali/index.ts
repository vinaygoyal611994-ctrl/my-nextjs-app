import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JournalService } from "@/lib/accounting/journal";
import { z } from "zod";
import Decimal from "decimal.js";

const paySchema = z.object({
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount:        z.number().positive(),
  mode:          z.enum(["cash", "bank", "upi", "cheque"]),
  bankAccountId: z.number().int().positive().optional(),
  narration:     z.string().max(300).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId  = session.user.firmId;
  const userId  = session.user.id;

  // ── GET: Summary + payment history ────────────────────────────────────────
  if (req.method === "GET") {
    // Find HAM001 account (may have slightly different code or name)
    const hamAcc = await prisma.account.findFirst({
      where: {
        firmId,
        OR: [
          { code: "HAM001" },
          { name: { contains: "Hammali" } },
          { name: { contains: "हम्माली" } },
        ],
      },
      select: { id: true, name: true },
    });

    if (!hamAcc) {
      // No purchases with wages recorded yet
      return res.json({ accountId: null, accumulated: 0, paid: 0, outstanding: 0, history: [] });
    }

    // Compute accumulated (credits = wages deducted from farmers)
    // and paid (debits = payments made to labourers)
    type BalRow = { accumulated: string; paid: string };
    const [bal] = await prisma.$queryRaw<BalRow[]>`
      SELECT
        COALESCE(SUM(CASE WHEN je.cancelled = 0 THEN jl.credit ELSE 0 END), 0) AS accumulated,
        COALESCE(SUM(CASE WHEN je.cancelled = 0 THEN jl.debit  ELSE 0 END), 0) AS paid
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE jl.account_id = ${hamAcc.id} AND je.firm_id = ${firmId}
    `;

    const accumulated = Number(bal?.accumulated ?? 0);
    const paid        = Number(bal?.paid        ?? 0);

    // Payment history = all debit journal entries for HAM001
    // (only debit = payments; credits come from purchases automatically)
    type HistRow = {
      je_id: bigint; voucher_no: string; date: Date;
      amount: string; narration: string | null;
    };
    const histRows = await prisma.$queryRaw<HistRow[]>`
      SELECT je.id AS je_id, je.voucher_no, je.date,
             jl.debit AS amount, je.narration
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE jl.account_id = ${hamAcc.id}
        AND je.firm_id    = ${firmId}
        AND je.cancelled  = 0
        AND jl.debit      > 0
      ORDER BY je.date DESC, je.id DESC
      LIMIT 200
    `;

    const history = histRows.map((r) => ({
      id:         Number(r.je_id),
      voucherNo:  r.voucher_no,
      date:       r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
      amount:     Number(r.amount),
      narration:  r.narration ?? null,
    }));

    return res.json({ accountId: hamAcc.id, accumulated, paid, outstanding: accumulated - paid, history });
  }

  // ── POST: Record payment to labourers ─────────────────────────────────────
  if (req.method === "POST") {
    const parsed = paySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { date, amount, mode, bankAccountId, narration } = parsed.data;
    const amt = new Decimal(amount);

    // 1. Find HAM001
    const hamAcc = await prisma.account.findFirst({
      where: {
        firmId,
        OR: [
          { code: "HAM001" },
          { name: { contains: "Hammali" } },
          { name: { contains: "हम्माली" } },
        ],
      },
      select: { id: true },
    });
    if (!hamAcc) return res.status(400).json({ error: "Hammali account (HAM001) नहीं मिला। पहले एक purchase दर्ज करें।" });

    // 2. Resolve Cash or Bank GL account
    let cashBankId: number;
    if (mode === "cash") {
      const cashAcc = await prisma.account.findFirst({ where: { firmId, subType: "cash", isSystem: true } });
      if (!cashAcc) return res.status(400).json({ error: "Cash account नहीं मिला" });
      cashBankId = cashAcc.id;
    } else {
      if (!bankAccountId) return res.status(400).json({ error: "Bank account चुनें" });
      const bank = await prisma.bankAccount.findFirst({
        where: { id: bankAccountId, firmId, active: true },
        include: { account: true },
      });
      if (!bank?.account) return res.status(400).json({ error: "Bank account नहीं मिला" });
      cashBankId = bank.account.id;
    }

    // 3. Create journal entry: DR HAM001, CR Cash/Bank
    const { journalEntryId, voucherNo } = await new JournalService(prisma).post({
      firmId,
      voucherType: "expense",
      date:         new Date(date),
      narration:    narration ?? "Hammali / Labour charges payment",
      refType:      "hammali_payment",
      createdById:  userId,
      lines: [
        { accountId: hamAcc.id, debit:  amt, narration: "Hammali Payable — paid" },
        { accountId: cashBankId, credit: amt, narration: narration ?? "Labour payment" },
      ],
    });

    return res.status(201).json({ journalEntryId, voucherNo });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
