import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JournalService } from "@/lib/accounting/journal";
import { z } from "zod";
import Decimal from "decimal.js";

const RecoverySchema = z.object({
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(["cash", "bank", "upi", "cheque"]),
  bankAccountId: z.number().int().positive().optional(),
  narration: z.string().max(300).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;

  const advanceId = parseInt(req.query.id as string);
  if (isNaN(advanceId)) return res.status(400).json({ error: "Invalid id" });

  const advance = await prisma.advance.findFirst({
    where: { id: advanceId, firmId },
    include: { kisan: { include: { account: true } } },
  });
  if (!advance) return res.status(404).json({ error: "Advance not found" });
  if (!advance.kisan.account) return res.status(500).json({ error: "किसान का GL खाता नहीं मिला" });

  // GET — return advance detail
  if (req.method === "GET") {
    return res.json({
      id: advance.id,
      kisanName: advance.kisan.name,
      amount: Number(advance.amount),
      amountRecovered: Number(advance.amountRecovered),
      outstanding: Number(advance.amount) - Number(advance.amountRecovered),
      status: advance.status,
    });
  }

  // PATCH — record a recovery payment
  if (req.method === "PATCH") {
    const parsed = RecoverySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { amount, date, mode, bankAccountId, narration } = parsed.data;

    const outstanding = new Decimal(advance.amount).minus(advance.amountRecovered);
    if (new Decimal(amount).gt(outstanding)) {
      return res.status(400).json({ error: `Recovery amount (₹${amount}) cannot exceed outstanding (₹${outstanding})` });
    }
    if (advance.status === "closed") {
      return res.status(400).json({ error: "Advance is already fully recovered" });
    }

    const recAmt = new Decimal(amount);

    // Resolve payment account
    let paymentGlId: number;
    if (mode === "cash") {
      const cash = await prisma.account.findFirst({ where: { firmId, code: "CASH001" } });
      if (!cash) return res.status(400).json({ error: "Cash account not found" });
      paymentGlId = cash.id;
    } else if (bankAccountId) {
      const bank = await prisma.bankAccount.findFirst({
        where: { id: bankAccountId, firmId, active: true },
        include: { account: true },
      });
      if (!bank?.account) return res.status(400).json({ error: "Bank account not found" });
      paymentGlId = bank.account.id;
    } else {
      const first = await prisma.bankAccount.findFirst({
        where: { firmId, active: true }, include: { account: true }, orderBy: { id: "asc" },
      });
      if (!first?.account) return res.status(400).json({ error: "No bank account found" });
      paymentGlId = first.account.id;
    }

    const newRecovered = new Decimal(advance.amountRecovered).plus(recAmt);
    const newStatus = newRecovered.gte(advance.amount) ? "closed" : "partial";

    await prisma.$transaction(async (tx) => {
      const js = new JournalService(tx);
      await js.post({
        firmId,
        voucherType: "advance",
        date: new Date(date),
        narration: narration ?? `उछंती वापसी — ${advance.kisan.name}`,
        createdById: session.user.id,
        lines: [
          // Dr Cash/Bank — money received from kisan
          { accountId: paymentGlId, debit: recAmt, credit: new Decimal(0) },
          // Cr Kisan GL — reduces kisan's advance balance
          { accountId: advance.kisan.account!.id, debit: new Decimal(0), credit: recAmt },
        ],
      });

      await tx.advance.update({
        where: { id: advanceId },
        data: {
          amountRecovered: newRecovered.toDecimalPlaces(2).toNumber(),
          status: newStatus as "open" | "partial" | "closed",
        },
      });
    });

    return res.json({ ok: true, newStatus, newRecovered: newRecovered.toNumber() });
  }

  res.setHeader("Allow", ["GET", "PATCH"]);
  return res.status(405).end();
}
