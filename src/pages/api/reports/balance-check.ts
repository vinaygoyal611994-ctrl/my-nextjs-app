import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface BalanceIssue {
  type: string;
  message: string;
  count: number;
  amount: number;
}

export interface BalanceCheckResult {
  issues: BalanceIssue[];
  grandDr: number;
  grandCr: number;
  tbDiff: number;
}

type CountAmt = { cnt: bigint; amt: string };
type OnlyCnt  = { cnt: bigint };

function inrShort(v: number) {
  return v.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function safeNum(v: unknown): number {
  return typeof v === "bigint" ? Number(v) : Number(v ?? 0);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;

  const issues: BalanceIssue[] = [];

  // 1. Purchases without journal entries
  const purchaseRows = await prisma.$queryRaw<CountAmt[]>`
    SELECT COUNT(*) AS cnt, COALESCE(SUM(net_payable), 0) AS amt
    FROM purchases
    WHERE firm_id = ${firmId} AND cancelled = 0 AND journal_entry_id IS NULL
  `.catch(() => [] as CountAmt[]);

  const pCount = safeNum(purchaseRows[0]?.cnt);
  const pAmt   = Number(purchaseRows[0]?.amt ?? 0);
  if (pCount > 0) {
    issues.push({
      type: "purchase_no_journal",
      message: `${pCount} Purchase (खरीद) की journal entry नहीं बनी — ₹${inrShort(pAmt)} का हिसाब accounts में दर्ज नहीं है।`,
      count: pCount,
      amount: pAmt,
    });
  }

  // 2. Sales without journal entries
  const saleRows = await prisma.$queryRaw<CountAmt[]>`
    SELECT COUNT(*) AS cnt, COALESCE(SUM(grand_total), 0) AS amt
    FROM sales
    WHERE firm_id = ${firmId} AND cancelled = 0 AND journal_entry_id IS NULL
  `.catch(() => [] as CountAmt[]);

  const sCount = safeNum(saleRows[0]?.cnt);
  const sAmt   = Number(saleRows[0]?.amt ?? 0);
  if (sCount > 0) {
    issues.push({
      type: "sale_no_journal",
      message: `${sCount} Sale (बिक्री) की journal entry नहीं बनी — ₹${inrShort(sAmt)} का हिसाब accounts में दर्ज नहीं है।`,
      count: sCount,
      amount: sAmt,
    });
  }

  // 3. Payments / receipts without journal entries
  const payRows = await prisma.$queryRaw<CountAmt[]>`
    SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS amt
    FROM payments_receipts
    WHERE firm_id = ${firmId} AND cancelled = 0 AND journal_entry_id IS NULL
  `.catch(() => [] as CountAmt[]);

  const prCount = safeNum(payRows[0]?.cnt);
  const prAmt   = Number(payRows[0]?.amt ?? 0);
  if (prCount > 0) {
    issues.push({
      type: "payment_no_journal",
      message: `${prCount} Payment/Receipt की journal entry नहीं बनी — ₹${inrShort(prAmt)} का पैसा accounts में नहीं दिखेगा।`,
      count: prCount,
      amount: prAmt,
    });
  }

  // 4. Expenses without journal entries
  const expRows = await prisma.$queryRaw<CountAmt[]>`
    SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS amt
    FROM expenses
    WHERE firm_id = ${firmId} AND journal_entry_id IS NULL
  `.catch(() => [] as CountAmt[]);

  const eCount = safeNum(expRows[0]?.cnt);
  const eAmt   = Number(expRows[0]?.amt ?? 0);
  if (eCount > 0) {
    issues.push({
      type: "expense_no_journal",
      message: `${eCount} Expense (खर्चे) की journal entry नहीं बनी — ₹${inrShort(eAmt)} का खर्चा accounts में नहीं दिखेगा।`,
      count: eCount,
      amount: eAmt,
    });
  }

  // 5. Advances without journal entries
  const advRows = await prisma.$queryRaw<CountAmt[]>`
    SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS amt
    FROM advances
    WHERE firm_id = ${firmId} AND journal_entry_id IS NULL
  `.catch(() => [] as CountAmt[]);

  const aCount = safeNum(advRows[0]?.cnt);
  const aAmt   = Number(advRows[0]?.amt ?? 0);
  if (aCount > 0) {
    issues.push({
      type: "advance_no_journal",
      message: `${aCount} Advance (उछंती) की journal entry नहीं बनी — ₹${inrShort(aAmt)} का उछंती accounts में नहीं है।`,
      count: aCount,
      amount: aAmt,
    });
  }

  // 6. Journal entries where total_debit ≠ total_credit (data integrity error)
  const imbalRows = await prisma.$queryRaw<OnlyCnt[]>`
    SELECT COUNT(*) AS cnt
    FROM journal_entries je
    WHERE je.firm_id = ${firmId}
      AND je.cancelled = 0
      AND ABS(je.total_debit - je.total_credit) > 0.01
  `.catch(() => [] as OnlyCnt[]);

  const jCount = safeNum(imbalRows[0]?.cnt);
  if (jCount > 0) {
    issues.push({
      type: "unbalanced_journal",
      message: `${jCount} journal entries में Debit और Credit बराबर नहीं हैं — यह data error है, कृपया support से संपर्क करें।`,
      count: jCount,
      amount: 0,
    });
  }

  // 7. Trial balance totals (DR vs CR across all active journal lines)
  type TBRow = { grand_dr: string; grand_cr: string };
  const tbRows = await prisma.$queryRaw<TBRow[]>`
    SELECT
      COALESCE(SUM(CASE WHEN je.cancelled = 0 THEN jl.debit  ELSE 0 END), 0) AS grand_dr,
      COALESCE(SUM(CASE WHEN je.cancelled = 0 THEN jl.credit ELSE 0 END), 0) AS grand_cr
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE je.firm_id = ${firmId}
  `.catch(() => [] as TBRow[]);

  const grandDr = Number(tbRows[0]?.grand_dr ?? 0);
  const grandCr = Number(tbRows[0]?.grand_cr ?? 0);
  const tbDiff  = Math.abs(grandDr - grandCr);

  // If trial balance itself is off and no journal integrity issues, flag it
  if (tbDiff > 0.01 && jCount === 0) {
    issues.push({
      type: "trial_unbalanced",
      message: `Trial Balance में ₹${tbDiff.toLocaleString("en-IN", { maximumFractionDigits: 2 })} का अंतर है — यही Balance Sheet में दिख रहा है।`,
      count: 1,
      amount: tbDiff,
    });
  }

  // If no specific issues found, give a generic explanation
  if (issues.length === 0) {
    issues.push({
      type: "rounding",
      message: "सभी entries सही दिखती हैं। यह छोटा-सा अंतर (Rounding) हो सकता है — आमतौर पर ₹1 से कम होने पर चिंता की बात नहीं।",
      count: 0,
      amount: 0,
    });
  }

  return res.json({ issues, grandDr, grandCr, tbDiff });
}
