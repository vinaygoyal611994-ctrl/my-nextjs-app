import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JournalService } from "@/lib/accounting/journal";
import { z } from "zod";
import Decimal from "decimal.js";
import type { Prisma } from "@prisma/client";

const ExpenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  accountId: z.number().int().positive(),
  amount: z.number().positive(),
  mode: z.enum(["cash", "bank", "upi", "cheque"]),
  bankAccountId: z.number().int().positive().optional(), // BankAccount.id
  narration: z.string().max(300).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;

  if (req.method === "GET") {
    const { from, to } = req.query;
    const where: Prisma.ExpenseWhereInput = { firmId };
    if (from) where.date = { gte: new Date(from as string) };
    if (from && to) where.date = { gte: new Date(from as string), lte: new Date(to as string + "T23:59:59") };

    const expenses = await prisma.expense.findMany({
      where,
      include: { party: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 200,
    });

    return res.json(
      expenses.map((e) => ({
        id: e.id,
        date: e.date.toISOString(),
        accountId: e.accountId,
        amount: Number(e.amount),
        mode: e.mode,
        narration: e.narration,
        partyName: e.party?.name ?? null,
      }))
    );
  }

  if (req.method === "POST") {
    const parsed = ExpenseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { date, accountId, amount, mode, bankAccountId, narration } = parsed.data;
    const amt = new Decimal(amount);

    // Resolve payment account (cash or specific bank)
    const expenseAccount = await prisma.account.findFirst({ where: { firmId, id: accountId } });
    if (!expenseAccount) return res.status(400).json({ error: "खाता नहीं मिला" });

    let paymentAccount;
    if (mode === "cash") {
      paymentAccount = await prisma.account.findFirst({ where: { firmId, code: "CASH001" } });
    } else if (bankAccountId) {
      const bank = await prisma.bankAccount.findFirst({
        where: { id: bankAccountId, firmId, active: true },
        include: { account: true },
      });
      paymentAccount = bank?.account ?? null;
    } else {
      const firstBank = await prisma.bankAccount.findFirst({ where: { firmId, active: true }, include: { account: true } });
      paymentAccount = firstBank?.account ?? null;
    }
    if (!paymentAccount) return res.status(400).json({ error: "भुगतान खाता नहीं मिला" });

    const result = await prisma.$transaction(async (tx) => {
      const js = new JournalService(tx);
      const je = await js.post({
        firmId,
        voucherType: "expense",
        date: new Date(date),
        narration: narration ?? `खर्चा — ${expenseAccount.name}`,
        createdById: session.user.id,
        lines: [
          { accountId: expenseAccount.id, debit: amt, credit: new Decimal(0) },
          { accountId: paymentAccount.id, debit: new Decimal(0), credit: amt },
        ],
      });

      const expense = await tx.expense.create({
        data: {
          firmId,
          date: new Date(date),
          accountId,
          amount: amt.toDecimalPlaces(2).toNumber(),
          mode,
          narration,
          journalEntryId: je.journalEntryId,
          createdById: session.user.id,
        },
      });

      // Store bank_account_id via raw SQL (Prisma client not yet regenerated for this field)
      if (bankAccountId) {
        await tx.$executeRaw`UPDATE expenses SET bank_account_id = ${bankAccountId} WHERE id = ${expense.id}`;
      }

      return expense;
    });

    return res.status(201).json({ id: result.id });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
