import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["kisan", "vyapari", "transporter", "palledar", "other", "staff"]).optional(),
  village: z.string().nullable().optional(),
  mobile: z.string().nullable().optional(),
  gstin: z.string().nullable().optional(),
  pan: z.string().nullable().optional(),
  paymentTermDays: z.number().int().optional(),
  openingBalance: z.number().optional(),
  openingType: z.enum(["Dr", "Cr"]).optional(),
  byajRateOverride: z.number().optional().nullable(),
  monthlySalary: z.number().optional().nullable(),
  active: z.boolean().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;
  const id = parseInt(req.query.id as string, 10);

  const party = await prisma.party.findFirst({ where: { id, firmId } });
  if (!party) return res.status(404).json({ error: "Party not found" });

  if (req.method === "GET") {
    // Return party with last transactions + balance
    const [transactions, account] = await Promise.all([
      prisma.journalEntry.findMany({
        where: { firmId, lines: { some: { accountId: party.accountId ?? 0 } } },
        include: { lines: { where: { accountId: party.accountId ?? 0 } } },
        orderBy: { date: "desc" },
        take: 20,
      }),
      party.accountId
        ? prisma.account.findUnique({
            where: { id: party.accountId },
            include: { journalLines: true },
          })
        : null,
    ]);

    let balance = Number(party.openingBalance);
    if (account) {
      const drTotal = account.journalLines.reduce((s, l) => s + Number(l.debit), 0);
      const crTotal = account.journalLines.reduce((s, l) => s + Number(l.credit), 0);
      const openingDr = party.openingType === "Dr" ? balance : 0;
      const openingCr = party.openingType === "Cr" ? balance : 0;
      balance = openingDr + drTotal - (openingCr + crTotal);
    }

    return res.status(200).json({
      party,
      balance: Math.abs(balance),
      balanceType: balance >= 0 ? "Dr" : "Cr",
      recentTransactions: transactions,
    });
  }

  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.party.update({ where: { id }, data: parsed.data });
      // Sync account name if name changed
      if (parsed.data.name && party.accountId) {
        await tx.account.update({
          where: { id: party.accountId },
          data: { name: parsed.data.name },
        });
      }
      return p;
    });

    return res.status(200).json(updated);
  }

  // Deactivate (no hard delete)
  if (req.method === "DELETE") {
    if (session.user.role !== "malik") {
      return res.status(403).json({ error: "Only malik can deactivate parties" });
    }
    await prisma.party.update({ where: { id }, data: { active: false } });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
