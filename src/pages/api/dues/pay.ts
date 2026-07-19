import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { ensureDuesTable, LEGACY_KEY_TO_CODE } from "./index";

const schema = z.object({
  duesType:      z.string().min(1, "dues type जरूरी है"), // account code or legacy key
  date:          z.string().min(1),
  periodFrom:    z.string().optional(),
  periodTo:      z.string().optional(),
  amount:        z.number().positive("राशि 0 से अधिक होनी चाहिए"),
  mode:          z.enum(["cash", "bank", "upi", "cheque"]),
  bankAccountId: z.number().int().optional(),
  challanNo:     z.string().optional(),
  narration:     z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;

  await ensureDuesTable();

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  // Resolve: legacy key ("committee") → account code ("MSHK001"), or use as-is
  const glCode = LEGACY_KEY_TO_CODE[data.duesType] ?? data.duesType;

  // Get payable GL account (any account with this code for this firm)
  const payableAcc = await prisma.account.findFirst({
    where: { firmId, code: glCode },
    select: { id: true },
  });
  if (!payableAcc) {
    return res.status(400).json({ error: `GL account नहीं मिला: ${glCode}` });
  }

  // Get cash/bank GL
  let payAccId: number;
  if (data.mode !== "cash" && data.bankAccountId) {
    const bankAcc = await prisma.bankAccount.findFirst({
      where: { id: data.bankAccountId, firmId },
      select: { account: { select: { id: true } } },
    });
    if (!bankAcc?.account) {
      return res.status(400).json({ error: "Bank account नहीं मिला" });
    }
    payAccId = bankAcc.account.id;
  } else {
    const payGlCode = data.mode === "cash" ? "CASH001" : "BANK001";
    const payAcc = await prisma.account.findFirst({
      where: { firmId, code: payGlCode },
      select: { id: true },
    });
    if (!payAcc) {
      return res.status(400).json({ error: `Cash/Bank GL नहीं मिला` });
    }
    payAccId = payAcc.id;
  }

  const amt = new Decimal(data.amount);

  // Auto voucher number
  const lastEntry = await prisma.journalEntry.findFirst({
    where: { firmId, voucherType: "payment", voucherNo: { startsWith: "DUES-" } },
    orderBy: { id: "desc" },
    select: { voucherNo: true },
  });
  const lastNum = lastEntry
    ? parseInt(lastEntry.voucherNo.replace(/\D/g, "") || "0", 10)
    : 0;
  const voucherNo = `DUES-${String(lastNum + 1).padStart(4, "0")}`;

  // Get account name for narration
  const accName = (await prisma.account.findFirst({
    where: { firmId, code: glCode },
    select: { name: true },
  }))?.name ?? glCode;

  const narration =
    data.narration ||
    `${accName} payment${data.challanNo ? ` — Challan: ${data.challanNo}` : ""}`;

  // Journal: Dr Payable (reduces liability), Cr Cash/Bank
  const entry = await prisma.journalEntry.create({
    data: {
      firmId,
      voucherType: "payment",
      voucherNo,
      date: new Date(data.date),
      narration,
      refType: "govt_dues",
      totalDebit: amt,
      totalCredit: amt,
      createdById: session.user.id,
      lines: {
        create: [
          { accountId: payableAcc.id, debit: amt,            credit: new Decimal(0) },
          { accountId: payAccId,      debit: new Decimal(0), credit: amt },
        ],
      },
    },
  });

  // Store resolved account code (not legacy key) for future JOIN-based label lookup
  await prisma.$executeRaw`
    INSERT INTO govt_dues_payments
      (firm_id, dues_type, date, period_from, period_to, amount, challan_no, mode, bank_account_id, journal_entry_id, narration)
    VALUES (
      ${firmId},
      ${glCode},
      ${data.date},
      ${data.periodFrom ?? null},
      ${data.periodTo ?? null},
      ${data.amount},
      ${data.challanNo ?? null},
      ${data.mode},
      ${data.bankAccountId ?? null},
      ${entry.id},
      ${data.narration ?? null}
    )
  `;

  // If committee (MSHK001), also record in CommitteePayment
  if (glCode === "MSHK001") {
    await prisma.committeePayment.create({
      data: {
        firmId,
        date: new Date(data.date),
        periodFrom: data.periodFrom ? new Date(data.periodFrom) : new Date(data.date),
        periodTo:   data.periodTo   ? new Date(data.periodTo)   : new Date(data.date),
        amount: amt,
        receiptNo: data.challanNo,
        mode: data.mode as import("@prisma/client").PaymentMode,
        journalEntryId: entry.id,
      },
    });
  }

  return res.status(201).json({ ok: true, voucherNo, journalEntryId: entry.id });
}
