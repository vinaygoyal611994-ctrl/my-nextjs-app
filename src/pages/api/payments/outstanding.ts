import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function ensureInvoicePaymentsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      firm_id INT NOT NULL,
      payment_receipt_id INT NOT NULL,
      ref_type VARCHAR(20) NOT NULL,
      ref_id INT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_firm (firm_id),
      INDEX idx_payment (payment_receipt_id),
      INDEX idx_invoice (ref_type, ref_id)
    )
  `);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;

  const { partyId, voucherType } = req.query;
  if (!partyId || !voucherType) return res.status(400).json({ error: "partyId and voucherType required" });

  await ensureInvoicePaymentsTable();

  const pId = parseInt(partyId as string, 10);

  try {
    if (voucherType === "receipt") {
      type Row = { id: number; bill_no: string; date: Date; total: string; paid: string };
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT s.id, s.bill_no, s.date,
               CAST(s.grand_total AS CHAR) AS total,
               CAST(COALESCE(SUM(ip.amount), 0) AS CHAR) AS paid
        FROM sales s
        LEFT JOIN invoice_payments ip ON ip.ref_type = 'sale' AND ip.ref_id = s.id AND ip.firm_id = ${firmId}
        WHERE s.firm_id = ${firmId} AND s.vyapari_id = ${pId} AND s.cancelled = 0
        GROUP BY s.id
        HAVING (s.grand_total - COALESCE(SUM(ip.amount), 0)) > 0.01
        ORDER BY s.date ASC
        LIMIT 100
      `;
      return res.json(rows.map((r) => ({
        id: Number(r.id),
        billNo: r.bill_no,
        date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
        total: Number(r.total),
        paid: Number(r.paid),
        remaining: Math.max(0, Number(r.total) - Number(r.paid)),
        refType: "sale" as const,
      })));
    }

    if (voucherType === "payment") {
      type Row = { id: number; bill_no: string; date: Date; total: string; paid: string };
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT p.id, p.bill_no, p.date,
               CAST(p.net_payable AS CHAR) AS total,
               CAST(COALESCE(SUM(ip.amount), 0) AS CHAR) AS paid
        FROM purchases p
        LEFT JOIN invoice_payments ip ON ip.ref_type = 'purchase' AND ip.ref_id = p.id AND ip.firm_id = ${firmId}
        WHERE p.firm_id = ${firmId} AND p.kisan_id = ${pId} AND p.cancelled = 0
        GROUP BY p.id
        HAVING (p.net_payable - COALESCE(SUM(ip.amount), 0)) > 0.01
        ORDER BY p.date ASC
        LIMIT 100
      `;
      return res.json(rows.map((r) => ({
        id: Number(r.id),
        billNo: r.bill_no,
        date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
        total: Number(r.total),
        paid: Number(r.paid),
        remaining: Math.max(0, Number(r.total) - Number(r.paid)),
        refType: "purchase" as const,
      })));
    }

    return res.status(400).json({ error: "Invalid voucherType" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to fetch outstanding invoices" });
  }
}
