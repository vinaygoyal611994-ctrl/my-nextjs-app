import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;

  const accountId = parseInt(req.query.id as string);
  if (isNaN(accountId)) return res.status(400).json({ error: "Invalid account id" });

  // PATCH: toggle is_govt_dues
  if (req.method === "PATCH") {
    const { isGovtDues } = req.body as { isGovtDues: boolean };
    const acc = await prisma.account.findFirst({ where: { id: accountId, firmId } });
    if (!acc) return res.status(404).json({ error: "Account not found" });
    // Ensure column exists before updating
    await prisma.$executeRaw`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_govt_dues TINYINT(1) NOT NULL DEFAULT 0`;
    await prisma.$executeRaw`UPDATE accounts SET is_govt_dues = ${isGovtDues ? 1 : 0} WHERE id = ${accountId} AND firm_id = ${firmId}`;
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET", "PATCH"]);
    return res.status(405).end();
  }

  const account = await prisma.account.findFirst({
    where: { id: accountId, firmId },
    include: { parties: { select: { id: true, name: true, type: true } } },
  });
  if (!account) return res.status(404).json({ error: "Account not found" });

  const { from, to } = req.query;
  const today = new Date();
  const fromDate = from
    ? new Date(from as string)
    : new Date(today.getFullYear(), today.getMonth(), 1);
  const toDate = to ? new Date(to as string) : new Date(today);
  toDate.setHours(23, 59, 59, 999);

  type SumRow = { total_debit: string; total_credit: string };
  const [openingRows, entries] = await Promise.all([
    prisma.$queryRaw<SumRow[]>`
      SELECT COALESCE(SUM(jl.debit), 0)  AS total_debit,
             COALESCE(SUM(jl.credit), 0) AS total_credit
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE jl.account_id = ${accountId}
        AND je.firm_id = ${firmId}
        AND je.cancelled = 0
        AND je.date < ${fromDate}
    `,
    prisma.journalLine.findMany({
      where: {
        accountId,
        journalEntry: {
          firmId,
          cancelled: false,
          date: { gte: fromDate, lte: toDate },
        },
      },
      include: {
        journalEntry: {
          select: { date: true, voucherType: true, voucherNo: true, narration: true },
        },
      },
      orderBy: [{ journalEntry: { date: "asc" } }, { journalEntry: { id: "asc" } }],
    }),
  ]);

  const openingDr = Number(openingRows[0]?.total_debit ?? 0);
  const openingCr = Number(openingRows[0]?.total_credit ?? 0);

  return res.json({
    account: {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      subType: account.subType,
      party: account.parties[0] ?? null,
    },
    from: fromDate.toISOString().slice(0, 10),
    to: toDate.toISOString().slice(0, 10),
    openingDr,
    openingCr,
    entries: entries.map((e) => ({
      id: e.id,
      date: e.journalEntry.date.toISOString().slice(0, 10),
      voucherType: e.journalEntry.voucherType,
      voucherNo: e.journalEntry.voucherNo,
      narration: e.narration ?? e.journalEntry.narration ?? "",
      debit: Number(e.debit),
      credit: Number(e.credit),
    })),
  });
}
