import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JournalService } from "@/lib/accounting/journal";
import { z } from "zod";
import Decimal from "decimal.js";

const AdvanceSchema = z.object({
  kisanId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive(),
  mode: z.enum(["cash", "bank", "upi", "cheque"]),
  bankAccountId: z.number().int().positive().optional(),
  byajRatePct: z.number().min(0).max(100).optional().default(0),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;

  if (req.method === "GET") {
    const advances = await prisma.advance.findMany({
      where: { firmId, status: { not: "closed" } },
      include: { kisan: { select: { name: true, village: true } } },
      orderBy: { date: "desc" },
      take: 200,
    });

    return res.json(
      advances.map((a) => ({
        id: a.id,
        kisanId: a.kisanId,
        kisanName: a.kisan.name,
        kisanVillage: a.kisan.village,
        date: a.date.toISOString(),
        amount: Number(a.amount),
        mode: a.mode,
        byajRatePct: Number(a.byajRatePct),
        status: a.status,
        amountRecovered: Number(a.amountRecovered),
        outstanding: Number(a.amount) - Number(a.amountRecovered),
      }))
    );
  }

  if (req.method === "POST") {
    const parsed = AdvanceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { kisanId, date, amount, mode, bankAccountId, byajRatePct } = parsed.data;
    const amt = new Decimal(amount);

    // Validate kisan belongs to firm, must have a GL account
    const kisan = await prisma.party.findFirst({
      where: { id: kisanId, firmId, type: "kisan" },
      include: { account: true },
    });
    if (!kisan) return res.status(400).json({ error: "किसान नहीं मिला" });
    if (!kisan.account) return res.status(400).json({ error: "किसान का GL खाता नहीं मिला" });

    // Resolve payment GL account (cash or specific bank)
    let payGlId: number;
    if (mode === "cash") {
      const cash = await prisma.account.findFirst({ where: { firmId, code: "CASH001" } });
      if (!cash) return res.status(400).json({ error: "Cash account not found" });
      payGlId = cash.id;
    } else if (bankAccountId) {
      const bank = await prisma.bankAccount.findFirst({
        where: { id: bankAccountId, firmId, active: true }, include: { account: true },
      });
      if (!bank?.account) return res.status(400).json({ error: "Bank account not found" });
      payGlId = bank.account.id;
    } else {
      const first = await prisma.bankAccount.findFirst({
        where: { firmId, active: true }, include: { account: true }, orderBy: { id: "asc" },
      });
      if (!first?.account) return res.status(400).json({ error: "No bank account found" });
      payGlId = first.account.id;
    }

    // Get byaj rate from settings if not provided
    let byajRate = byajRatePct;
    if (byajRate === 0) {
      const setting = await prisma.setting.findFirst({
        where: { firmId, key: "byaj_pct_month" },
        orderBy: { effectiveFrom: "desc" },
      });
      byajRate = parseFloat(setting?.value ?? "0");
    }

    const result = await prisma.$transaction(async (tx) => {
      const js = new JournalService(tx);
      const je = await js.post({
        firmId,
        voucherType: "advance",
        date: new Date(date),
        narration: `उछंती — ${kisan.name}`,
        createdById: session.user.id,
        lines: [
          // Dr Kisan GL — kisan now owes mandi the advance
          { accountId: kisan.account!.id, debit: amt, credit: new Decimal(0) },
          // Cr Cash/Bank — mandi paid out cash
          { accountId: payGlId, debit: new Decimal(0), credit: amt },
        ],
      });

      const advance = await tx.advance.create({
        data: {
          firmId,
          kisanId,
          date: new Date(date),
          amount: amt.toDecimalPlaces(2).toNumber(),
          mode,
          byajRatePct: new Decimal(byajRate).toDecimalPlaces(4).toNumber(),
          journalEntryId: je.journalEntryId,
        },
      });
      return advance;
    });

    return res.status(201).json({ id: result.id });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
