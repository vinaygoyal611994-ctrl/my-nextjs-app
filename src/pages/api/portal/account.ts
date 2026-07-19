import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { ensurePortalTables } from "@/lib/portal-tables";
import { getSession, COOKIE_NAME } from "@/lib/portal-session";

function parseCookieToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k.trim(), v.join("=")];
    })
  );
  return cookies[COOKIE_NAME] ?? null;
}

type PartyRow = {
  id: number | bigint;
  name: string;
  type: string;
  village: string | null;
  mobile: string | null;
};

type BalanceRow = { balance: string | number };

type PurchaseRow = {
  id: number | bigint;
  date: Date | string;
  bill_no: string | null;
  total_amount: string | number;
  items_summary: string | null;
};

type SaleRow = {
  id: number | bigint;
  date: Date | string;
  bill_no: string | null;
  grand_total: string | number;
  items_summary: string | null;
};

type PaymentRow = {
  id: number | bigint;
  date: Date | string;
  amount: string | number;
  payment_mode: string;
  type: string;
  narration: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    await ensurePortalTables();

    const token = parseCookieToken(req.headers.cookie);
    const session = await getSession(token);

    if (!session) {
      return res.status(401).json({ message: "Login required" });
    }

    const { firmId, partyId, name, mobile } = session;

    if (!partyId) {
      // Account not linked to a party yet
      return res.status(200).json({
        name,
        mobile,
        party: null,
        balance: 0,
        balanceType: "Cr",
        transactions: [],
        payments: [],
      });
    }

    // Get party details
    const partyRows = await prisma.$queryRaw<PartyRow[]>`
      SELECT id, name, type, village, mobile
      FROM parties
      WHERE id = ${partyId} AND firm_id = ${firmId} AND active = 1
      LIMIT 1
    `;

    if (!partyRows.length) {
      return res.status(404).json({ message: "Party not found" });
    }

    const party = partyRows[0];
    const partyType = party.type;

    // Get outstanding balance
    const balRows = await prisma.$queryRaw<BalanceRow[]>`
      SELECT COALESCE(SUM(jl.debit - jl.credit), 0) AS balance
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      JOIN accounts a ON a.id = jl.account_id
      WHERE a.party_id = ${partyId} AND je.cancelled = 0
    `;

    const rawBalance = Number(balRows[0]?.balance ?? 0);
    // balance > 0 means party owes us (Dr); < 0 means we owe them (Cr)
    const balanceType = rawBalance >= 0 ? "Dr" : "Cr";
    const balance = Math.abs(rawBalance);

    let transactions: object[] = [];

    if (partyType === "kisan") {
      // Last 20 purchases for this kisan
      const purchaseRows = await prisma.$queryRaw<PurchaseRow[]>`
        SELECT
          p.id,
          p.date,
          p.bill_no,
          p.total_amount,
          GROUP_CONCAT(i.name ORDER BY i.name SEPARATOR ', ') AS items_summary
        FROM purchases p
        LEFT JOIN purchase_items pi2 ON pi2.purchase_id = p.id
        LEFT JOIN items i ON i.id = pi2.item_id
        WHERE p.kisan_id = ${partyId} AND p.firm_id = ${firmId} AND p.cancelled = 0
        GROUP BY p.id, p.date, p.bill_no, p.total_amount
        ORDER BY p.date DESC, p.id DESC
        LIMIT 20
      `;

      transactions = purchaseRows.map((r) => ({
        id: Number(r.id),
        type: "purchase",
        date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
        billNo: r.bill_no,
        amount: Number(r.total_amount),
        itemsSummary: r.items_summary,
      }));
    } else if (partyType === "vyapari") {
      // Last 20 sales for this vyapari
      const saleRows = await prisma.$queryRaw<SaleRow[]>`
        SELECT
          s.id,
          s.date,
          s.bill_no,
          s.grand_total,
          GROUP_CONCAT(i.name ORDER BY i.name SEPARATOR ', ') AS items_summary
        FROM sales s
        LEFT JOIN sale_items si2 ON si2.sale_id = s.id
        LEFT JOIN items i ON i.id = si2.item_id
        WHERE s.vyapari_id = ${partyId} AND s.firm_id = ${firmId} AND s.cancelled = 0
        GROUP BY s.id, s.date, s.bill_no, s.grand_total
        ORDER BY s.date DESC, s.id DESC
        LIMIT 20
      `;

      transactions = saleRows.map((r) => ({
        id: Number(r.id),
        type: "sale",
        date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
        billNo: r.bill_no,
        amount: Number(r.grand_total),
        itemsSummary: r.items_summary,
      }));
    }

    // Last 10 payments/receipts for this party
    const paymentRows = await prisma.$queryRaw<PaymentRow[]>`
      SELECT id, date, amount, payment_mode, type, narration
      FROM payments_receipts
      WHERE party_id = ${partyId} AND firm_id = ${firmId}
      ORDER BY date DESC, id DESC
      LIMIT 10
    `;

    const payments = paymentRows.map((r) => ({
      id: Number(r.id),
      date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
      amount: Number(r.amount),
      paymentMode: r.payment_mode,
      type: r.type,
      narration: r.narration,
    }));

    return res.status(200).json({
      name,
      mobile,
      party: {
        id: Number(party.id),
        name: party.name,
        type: party.type,
        village: party.village,
        mobile: party.mobile,
      },
      balance,
      balanceType,
      transactions,
      payments,
    });
  } catch (err) {
    console.error("Portal account error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
