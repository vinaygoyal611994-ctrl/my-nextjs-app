import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import Decimal from "decimal.js";

const Schema = z.object({
  cash: z.number().min(0),
  banks: z.array(z.object({ accountId: z.number().int().positive(), amount: z.number().min(0) })),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "malik") return res.status(403).json({ error: "Only owner can set opening balance" });

  const firmId = session.user.firmId;

  if (req.method === "GET") {
    const existing = await prisma.journalEntry.findFirst({
      where: { firmId, voucherNo: "OB-0001" },
      include: { lines: { include: { account: { select: { id: true, code: true, name: true, subType: true } } } } },
    });

    if (!existing) return res.json({ cash: 0, banks: [], date: null, exists: false });

    const cashLine = existing.lines.find((l) => l.account.code === "CASH001");
    const bankLines = existing.lines.filter((l) => l.account.subType === "bank");

    return res.json({
      exists: true,
      date: existing.date.toISOString().slice(0, 10),
      cash: Number(cashLine?.debit ?? 0),
      banks: bankLines.map((l) => ({ accountId: l.account.id, amount: Number(l.debit) })),
    });
  }

  if (req.method === "POST") {
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { cash, banks, date } = parsed.data;
    const totalBank = banks.reduce((s, b) => s + b.amount, 0);

    if (cash === 0 && totalBank === 0) {
      return res.status(400).json({ error: "Enter at least one amount" });
    }

    await prisma.$transaction(async (tx) => {
      // Ensure Capital account exists
      let capitalAcc = await tx.account.findFirst({ where: { firmId, code: "CAP001" } });
      if (!capitalAcc) {
        capitalAcc = await tx.account.create({
          data: {
            firmId, code: "CAP001",
            name: "Owner Capital (मालिक पूँजी)",
            type: "capital", subType: "capital", isSystem: true,
          },
        });
      }

      const cashAcc = await tx.account.findFirstOrThrow({ where: { firmId, code: "CASH001" } });

      // Delete previous opening balance entry
      const prev = await tx.journalEntry.findFirst({ where: { firmId, voucherNo: "OB-0001" } });
      if (prev) {
        await tx.journalLine.deleteMany({ where: { journalEntryId: prev.id } });
        await tx.journalEntry.delete({ where: { id: prev.id } });
      }

      const totalAssets = new Decimal(cash).plus(totalBank);
      const lines: { accountId: number; debit: number; credit: number }[] = [];

      if (cash > 0) lines.push({ accountId: cashAcc.id, debit: cash, credit: 0 });

      for (const b of banks) {
        if (b.amount > 0) lines.push({ accountId: b.accountId, debit: b.amount, credit: 0 });
      }

      // Capital = balancing Cr
      lines.push({ accountId: capitalAcc.id, debit: 0, credit: totalAssets.toNumber() });

      await tx.journalEntry.create({
        data: {
          firmId,
          voucherType: "journal",
          voucherNo: "OB-0001",
          date: new Date(date),
          narration: "Opening Balance — FY Start",
          totalDebit: totalAssets.toNumber(),
          totalCredit: totalAssets.toNumber(),
          createdById: session.user.id,
          lines: { create: lines },
        },
      });
    });

    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
