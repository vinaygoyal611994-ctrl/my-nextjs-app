import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  name:        z.string().min(1, "नाम जरूरी है").max(200),
  type:        z.enum(["asset", "liability", "income", "expense", "capital"]),
  subType:     z.enum(["cash","bank","receivable","payable","income","direct_expense","indirect_expense","stock","capital","advance","other"]),
  isGovtDues:  z.boolean().optional().default(false),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;

  // ── POST: Create new account ──────────────────────────────────────────────
  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { name, type, subType, isGovtDues } = parsed.data;

    // Auto-generate code: prefix by type, find next number
    const prefixMap: Record<string, string> = {
      asset: "A", liability: "L", income: "INC", expense: "EXP", capital: "CAP",
    };
    const prefix = prefixMap[type] ?? "ACC";

    const lastAcc = await prisma.account.findFirst({
      where: { firmId, code: { startsWith: prefix } },
      orderBy: { id: "desc" },
      select: { code: true },
    });
    const lastNum = lastAcc
      ? parseInt(lastAcc.code.replace(/\D/g, "") || "0", 10)
      : 0;
    const code = `${prefix}${String(lastNum + 1).padStart(4, "0")}`;

    const account = await prisma.account.create({
      data: { firmId, code, name, type, subType, isSystem: false },
    });

    if (isGovtDues) {
      await prisma.$executeRaw`
        UPDATE accounts SET is_govt_dues = 1 WHERE id = ${account.id}
      `;
    }

    return res.status(201).json(account);
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  }

  type BalanceRow = { account_id: number; total_debit: string; total_credit: string };
  const balanceRows = await prisma.$queryRaw<BalanceRow[]>`
    SELECT jl.account_id,
           COALESCE(SUM(jl.debit), 0)  AS total_debit,
           COALESCE(SUM(jl.credit), 0) AS total_credit
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE je.firm_id = ${firmId} AND je.cancelled = 0
    GROUP BY jl.account_id
  `;

  const balanceMap = new Map(
    balanceRows.map((r) => [
      Number(r.account_id),
      { dr: Number(r.total_debit), cr: Number(r.total_credit) },
    ])
  );

  const accounts = await prisma.account.findMany({
    where: { firmId, active: true },
    include: { parties: { select: { id: true, name: true, type: true } } },
    orderBy: [{ subType: "asc" }, { name: "asc" }],
  });

  const rows = accounts.map((a) => {
    const bal = balanceMap.get(a.id) ?? { dr: 0, cr: 0 };
    const party = a.parties[0] ?? null;
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      subType: a.subType,
      isSystem: a.isSystem,
      partyId: party?.id ?? null,
      partyName: party?.name ?? null,
      partyType: party?.type ?? null,
      totalDebit: bal.dr,
      totalCredit: bal.cr,
    };
  });

  return res.json(rows);
}
