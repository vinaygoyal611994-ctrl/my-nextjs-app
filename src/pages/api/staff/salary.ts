import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JournalService } from "@/lib/accounting/journal";
import { z } from "zod";
import Decimal from "decimal.js";

const Schema = z.object({
  staffId: z.number().int().positive(),
  salaryDue: z.number().positive(),   // full salary for the month (e.g. 9000)
  amountPaid: z.number().positive(),  // amount actually paid — can be less (outstanding) or more (advance)
  month: z.string().regex(/^\d{4}-\d{2}$/),
  mode: z.enum(["cash", "bank", "upi"]),
  bankAccountId: z.number().int().positive().optional(),
  narration: z.string().max(300).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;

  if (req.method === "GET") {
    const { staffId } = req.query;
    if (!staffId) return res.status(400).json({ error: "staffId required" });

    const staff = await prisma.party.findFirst({
      where: { id: parseInt(staffId as string), firmId, type: "staff" },
    });
    if (!staff) return res.status(404).json({ error: "Staff not found" });

    const salaries = await prisma.expense.findMany({
      where: { firmId, partyId: staff.id },
      orderBy: { date: "desc" },
      take: 36,
    });

    return res.json(salaries.map((s) => ({
      id: s.id,
      date: s.date.toISOString().slice(0, 10),
      amount: Number(s.amount),
      mode: s.mode,
      narration: s.narration,
    })));
  }

  if (req.method === "POST") {
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { staffId, salaryDue, amountPaid, month, mode, bankAccountId, narration } = parsed.data;
    const due = new Decimal(salaryDue);
    const paid = new Decimal(amountPaid);
    const payDate = new Date(`${month}-01`);

    const staff = await prisma.party.findFirst({
      where: { id: staffId, firmId, type: "staff" },
    });
    if (!staff) return res.status(404).json({ error: "Staff member not found" });
    if (!staff.accountId) return res.status(400).json({ error: "Staff GL account missing" });

    // Resolve payment account (cash / bank)
    let paymentGlAccountId: number;
    if (mode === "cash") {
      const acc = await prisma.account.findFirst({ where: { firmId, code: "CASH001" } });
      if (!acc) return res.status(400).json({ error: "Cash account not found" });
      paymentGlAccountId = acc.id;
    } else if (bankAccountId) {
      const bank = await prisma.bankAccount.findFirst({
        where: { id: bankAccountId, firmId, active: true },
        include: { account: true },
      });
      if (!bank?.account) return res.status(400).json({ error: "Bank account not found" });
      paymentGlAccountId = bank.account.id;
    } else {
      const firstBank = await prisma.bankAccount.findFirst({
        where: { firmId, active: true },
        include: { account: true },
        orderBy: { id: "asc" },
      });
      if (!firstBank?.account) return res.status(400).json({ error: "No bank account found" });
      paymentGlAccountId = firstBank.account.id;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Auto-create Salary Expense account
      let salaryAcc = await tx.account.findFirst({ where: { firmId, code: "SAL001" } });
      if (!salaryAcc) {
        salaryAcc = await tx.account.create({
          data: {
            firmId, code: "SAL001",
            name: "Staff Salary (वेतन)",
            type: "liability",
            subType: "indirect_expense",
            isSystem: true,
          },
        });
      }

      const js = new JournalService(tx);
      const je = await js.post({
        firmId,
        voucherType: "expense",
        date: payDate,
        narration: narration ?? (paid.gt(due)
          ? `Salary + Advance — ${staff.name} (${month}) | Salary: ₹${due}, Advance: ₹${paid.minus(due)}`
          : paid.lt(due)
            ? `Salary — ${staff.name} (${month}) | Paid: ₹${paid} of ₹${due}`
            : `Salary — ${staff.name} (${month})`),
        createdById: session.user.id,
        lines: [
          // Dr Salary Expense — full month salary recognized as cost
          { accountId: salaryAcc.id, debit: due, credit: new Decimal(0) },
          // Cr Staff GL Account — full salary owed to staff
          { accountId: staff.accountId!, debit: new Decimal(0), credit: due },
          // Dr Staff GL Account — only amount actually paid now
          { accountId: staff.accountId!, debit: paid, credit: new Decimal(0) },
          // Cr Cash/Bank — only cash that left the firm
          { accountId: paymentGlAccountId, debit: new Decimal(0), credit: paid },
          // Net staff GL = Cr (due - paid) = outstanding salary payable to staff
        ],
      });

      const expense = await tx.expense.create({
        data: {
          firmId,
          date: payDate,
          accountId: salaryAcc.id,
          amount: due.toDecimalPlaces(2).toNumber(),
          mode,
          partyId: staff.id,
          narration: narration ?? (paid.gt(due)
            ? `Salary + Advance — ${staff.name} (${month}) | Salary: ₹${due}, Advance: ₹${paid.minus(due)}`
            : paid.lt(due)
              ? `Salary — ${staff.name} (${month}) | Paid: ₹${paid} of ₹${due}`
              : `Salary — ${staff.name} (${month})`),
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
