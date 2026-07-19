import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface TrialBalanceLine {
  accountId: number;
  code: string;
  name: string;
  type: string;
  totalDebit: number;
  totalCredit: number;
  netBalance: number; // positive = Dr, negative = Cr
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;

  // One-time idempotent cleanup: mark any existing reversal entries as cancelled.
  // JournalService.reverse() now does this automatically for new reversals, but
  // entries created before this fix still have cancelled=false.
  await prisma.$executeRaw`
    UPDATE journal_entries
    SET cancelled = 1, cancel_reason = 'Auto-reversal (backfill)'
    WHERE firm_id = ${firmId} AND ref_type = 'reversal' AND cancelled = 0
  `;

  const { from, to } = req.query;
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = new Date(from as string);
  if (to) { const d = new Date(to as string); d.setHours(23, 59, 59, 999); dateFilter.lte = d; }

  // Get all active accounts for this firm
  const accounts = await prisma.account.findMany({
    where: { firmId, active: true },
    select: { id: true, code: true, name: true, type: true },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });

  // Aggregate journal lines per account within date range.
  // cancelled entries (original) and their reversal entries are both marked
  // cancelled=true by JournalService.reverse(), so excluding cancelled=true here
  // gives correct balances: only the active corrected entry is counted.
  const lines = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: {
      journalEntry: {
        firmId,
        cancelled: false,
        ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
      },
    },
    _sum: { debit: true, credit: true },
  });

  const lineMap = new Map(lines.map((l) => [l.accountId, l]));

  const result: TrialBalanceLine[] = accounts
    .map((acc) => {
      const agg = lineMap.get(acc.id);
      const totalDebit = Number(agg?._sum.debit ?? 0);
      const totalCredit = Number(agg?._sum.credit ?? 0);
      return {
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        totalDebit,
        totalCredit,
        netBalance: totalDebit - totalCredit,
      };
    })
    .filter((r) => r.totalDebit !== 0 || r.totalCredit !== 0); // skip zero-movement accounts

  return res.json(result);
}
