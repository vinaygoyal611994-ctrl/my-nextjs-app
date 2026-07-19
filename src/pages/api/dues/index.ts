import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Legacy payment key → canonical account code (for pay.ts)
export const LEGACY_KEY_TO_CODE: Record<string, string> = {
  committee: "MSHK001",
  kkf:       "KKFP001",
  sgst:      "SGST001",
  cgst:      "CGST001",
  igst:      "IGST001",
};

// GST codes — grouped in UI
export const GST_CODES = new Set(["SGST001", "CGST001", "IGST001"]);

// Known government dues account codes (both old and new)
const KNOWN_GOVT_CODES = [
  "MSHK001", "COMM001",   // Mandi Committee Shulk
  "KKFP001", "KKF001",    // Kisan Kalyan Fund
  "SGST001", "CGST001", "IGST001", // GST
];

export async function ensureDuesTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS govt_dues_payments (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      firm_id         INT NOT NULL,
      dues_type       VARCHAR(30) NOT NULL,
      date            DATE NOT NULL,
      period_from     DATE,
      period_to       DATE,
      amount          DECIMAL(14,2) NOT NULL,
      challan_no      VARCHAR(100),
      mode            VARCHAR(20) NOT NULL DEFAULT 'cash',
      bank_account_id INT,
      journal_entry_id INT,
      narration       VARCHAR(300),
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_gdp_firm_date (firm_id, date),
      INDEX idx_gdp_firm_type (firm_id, dues_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `;
}

interface PayRow {
  id:              bigint;
  dues_type:       string;
  dues_label:      string | null;
  date:            Date | string;
  period_from:     Date | string | null;
  period_to:       Date | string | null;
  amount:          string;
  challan_no:      string | null;
  mode:            string;
  bank_account_id: number | null;
  bank_name:       string | null;
  narration:       string | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;

  try { await ensureDuesTable(); } catch { /* ignore */ }

  // ── Step 1: Find government dues accounts ────────────────────────────────
  // a) By known codes (committee, KKF, GST)
  const codeAccounts = await prisma.account.findMany({
    where: { firmId, active: true, code: { in: KNOWN_GOVT_CODES } },
    select: { id: true, code: true, name: true },
  }).catch(() => [] as { id: number; code: string; name: string }[]);

  // b) By is_govt_dues flag (user-defined: TDS, any custom account)
  let flagAccounts: { id: number; code: string; name: string }[] = [];
  try {
    const rows = await prisma.$queryRaw<{ id: bigint; code: string; name: string }[]>`
      SELECT id, code, name FROM accounts
      WHERE firm_id = ${firmId} AND active = 1 AND is_govt_dues = 1
    `;
    flagAccounts = rows.map((r) => ({ id: Number(r.id), code: r.code, name: r.name }));
  } catch { /* column may not exist yet — skip */ }

  // Merge, deduplicate by account id
  const accMap = new Map<number, { id: number; code: string; name: string }>();
  for (const a of [...codeAccounts, ...flagAccounts]) {
    accMap.set(a.id, { id: a.id, code: a.code, name: a.name });
  }
  const duesAccounts = Array.from(accMap.values());

  // ── Step 2: Compute accumulated & paid for each account ──────────────────
  const summary: {
    key: string; label: string; accountId: number;
    accumulated: number; paid: number; remaining: number;
  }[] = [];

  for (const acc of duesAccounts) {
    try {
      type BalRow = { accumulated: string; paid: string };
      const rows = await prisma.$queryRaw<BalRow[]>`
        SELECT
          COALESCE(SUM(CASE WHEN je.cancelled = 0 THEN jl.credit ELSE 0 END), 0) AS accumulated,
          COALESCE(SUM(CASE WHEN je.cancelled = 0 THEN jl.debit  ELSE 0 END), 0) AS paid
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.journal_entry_id
        WHERE jl.account_id = ${acc.id} AND je.firm_id = ${firmId}
      `;
      const accumulated = Number(rows[0]?.accumulated ?? 0);
      const paid        = Number(rows[0]?.paid        ?? 0);

      // Normalize old codes to canonical codes for the key
      const key = acc.code === "COMM001" ? "MSHK001"
               : acc.code === "KKF001"  ? "KKFP001"
               : acc.code;

      summary.push({ key, label: acc.name, accountId: acc.id, accumulated, paid, remaining: accumulated - paid });
    } catch { /* skip account if balance query fails */ }
  }

  // Sort: committee first, then KKF, then GST, then others alphabetically
  const ORDER: Record<string, number> = { MSHK001: 1, KKFP001: 2, SGST001: 3, CGST001: 4, IGST001: 5 };
  summary.sort((a, b) => (ORDER[a.key] ?? 99) - (ORDER[b.key] ?? 99) || a.label.localeCompare(b.label));

  // ── Payment history ───────────────────────────────────────────────────────
  // Source of truth = journal_entries (ref_type = 'govt_dues') + journal_lines
  // LEFT JOIN govt_dues_payments for challan/period/mode extras when available
  const { from, to } = req.query;
  const fromStr = (from as string) || "2000-01-01";
  const toStr   = (to   as string) || "2099-12-31";

  let historyRows: PayRow[] = [];
  try {
    historyRows = await prisma.$queryRaw<PayRow[]>`
      SELECT
        je.id,
        a.code        AS dues_type,
        a.name        AS dues_label,
        je.date,
        je.narration,
        jl.debit      AS amount,
        COALESCE(gdp.mode, 'cash')  AS mode,
        gdp.challan_no,
        gdp.period_from,
        gdp.period_to,
        gdp.bank_account_id,
        ba.bank_name
      FROM journal_entries je
      JOIN journal_lines jl
        ON jl.journal_entry_id = je.id AND jl.debit > 0
      JOIN accounts a
        ON a.id = jl.account_id AND a.firm_id = ${firmId}
      LEFT JOIN govt_dues_payments gdp
        ON gdp.journal_entry_id = je.id AND gdp.firm_id = ${firmId}
      LEFT JOIN bank_accounts ba
        ON ba.id = gdp.bank_account_id
      WHERE je.firm_id  = ${firmId}
        AND je.cancelled = 0
        AND je.ref_type  = 'govt_dues'
        AND je.date >= ${fromStr}
        AND je.date <= ${toStr}
      ORDER BY je.date DESC, je.id DESC
      LIMIT 200
    `;
  } catch { /* skip if any join fails */ }

  const legacyLabels: Record<string, string> = {
    committee: "Mandi Committee Shulk",
    kkf:       "KKF (Kisan Kalyan Fund)",
    sgst: "SGST", cgst: "CGST", igst: "IGST",
  };

  const history = historyRows.map((p) => ({
    id:         Number(p.id),
    duesType:   p.dues_type,
    label:      p.dues_label ?? legacyLabels[p.dues_type] ?? p.dues_type,
    date:       String(p.date).slice(0, 10),
    periodFrom: p.period_from ? String(p.period_from).slice(0, 10) : null,
    periodTo:   p.period_to   ? String(p.period_to).slice(0, 10)   : null,
    amount:     Number(p.amount),
    challanNo:  p.challan_no,
    mode:       p.mode,
    bankName:   p.bank_name ?? null,
    narration:  p.narration,
  }));

  return res.status(200).json({ summary, history });
}
