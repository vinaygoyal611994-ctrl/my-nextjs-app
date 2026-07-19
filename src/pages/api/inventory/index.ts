import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFyDates(fyStartYear: number): { fyStart: string; fyEnd: string } {
  return {
    fyStart: `${fyStartYear}-04-01`,
    fyEnd: `${fyStartYear + 1}-03-31`,
  };
}

/** Safely convert raw SQL value (BigInt | string | number | null) → number */
function n(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") return parseFloat(v) || 0;
  return Number(v);
}

/** Convert raw SQL date (Date | string | null) → "YYYY-MM-DD" string */
function sqlDate(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

// ── Types for raw query rows ───────────────────────────────────────────────────

interface StockSummaryRow {
  item_id: unknown;
  purchased_bags: unknown;
  purchased_weight_kg: unknown;
  remaining_bags: unknown;
  remaining_weight_kg: unknown;
  stock_value: unknown;
  avg_rate: unknown;
}

interface SoldRow {
  item_id: unknown;
  sold_bags: unknown;
  sold_weight_kg: unknown;
}

interface LotRow {
  id: unknown;
  item_id: unknown;
  date: unknown;
  quantity_bags: unknown;
  total_weight_kg: unknown;
  remaining_bags: unknown;
  remaining_weight_kg: unknown;
  rate_per_qtl: unknown;
  gate_pass_no: unknown;
  bill_no: unknown;
  kisan_name: unknown;
  kisan_village: unknown;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;

  // Determine FY start year — defaults to current FY
  const today = new Date();
  const currentFyStartYear =
    today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;

  const fyParam = req.query.fy as string | undefined;
  const fyStartYear = fyParam ? parseInt(fyParam, 10) : currentFyStartYear;
  if (isNaN(fyStartYear)) return res.status(400).json({ error: "Invalid fy param" });

  const { fyStart, fyEnd } = getFyDates(fyStartYear);

  // ── Raw SQL queries (run in parallel) ─────────────────────────────────────

  const [stockRows, soldRows, lotRows, itemRows, fyClosingRow] = await Promise.all([
    // 1. Stock summary per item from stock_lots in this FY
    prisma.$queryRaw<StockSummaryRow[]>`
      SELECT
        sl.item_id,
        SUM(sl.quantity_bags)                                         AS purchased_bags,
        SUM(sl.total_weight_kg)                                       AS purchased_weight_kg,
        SUM(sl.remaining_bags)                                        AS remaining_bags,
        SUM(sl.remaining_weight_kg)                                   AS remaining_weight_kg,
        SUM(sl.remaining_weight_kg / 100 * sl.rate_per_qtl)          AS stock_value,
        SUM(sl.total_weight_kg * sl.rate_per_qtl)
          / NULLIF(SUM(sl.total_weight_kg), 0)                       AS avg_rate
      FROM stock_lots sl
      WHERE sl.firm_id = ${firmId}
        AND sl.date >= ${fyStart}
        AND sl.date <= ${fyEnd}
      GROUP BY sl.item_id
    `,

    // 2. Sold qty per item from sale_items JOIN sales in this FY
    prisma.$queryRaw<SoldRow[]>`
      SELECT
        si.item_id,
        SUM(si.quantity_bags)   AS sold_bags,
        SUM(si.total_weight_kg) AS sold_weight_kg
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.firm_id = ${firmId}
        AND s.date >= ${fyStart}
        AND s.date <= ${fyEnd}
        AND s.cancelled = 0
      GROUP BY si.item_id
    `,

    // 3. Individual lots with remaining stock in this FY (for expanded view)
    prisma.$queryRaw<LotRow[]>`
      SELECT
        sl.id,
        sl.item_id,
        sl.date,
        sl.quantity_bags,
        sl.total_weight_kg,
        sl.remaining_bags,
        sl.remaining_weight_kg,
        sl.rate_per_qtl,
        sl.gate_pass_no,
        p.bill_no,
        party.name  AS kisan_name,
        party.village AS kisan_village
      FROM stock_lots sl
      LEFT JOIN purchases p ON p.id = sl.purchase_id
      LEFT JOIN parties party ON party.id = sl.kisan_id
      WHERE sl.firm_id = ${firmId}
        AND sl.date >= ${fyStart}
        AND sl.date <= ${fyEnd}
      ORDER BY sl.item_id, sl.date ASC
    `,

    // 4. All active items for this firm
    prisma.item.findMany({
      where: { firmId, active: true },
      select: { id: true, name: true, hindiName: true },
      orderBy: { name: "asc" },
    }),

    // 5. FyClosing record for this FY
    prisma.fyClosing.findUnique({
      where: { firmId_fyYear: { firmId, fyYear: fyStartYear } },
    }),
  ]);

  // ── Build maps ────────────────────────────────────────────────────────────

  const stockMap = new Map<number, StockSummaryRow>();
  for (const row of stockRows) {
    stockMap.set(n(row.item_id), row);
  }

  const soldMap = new Map<number, SoldRow>();
  for (const row of soldRows) {
    soldMap.set(n(row.item_id), row);
  }

  // Group lots by item_id
  const lotsMap = new Map<number, LotRow[]>();
  for (const lot of lotRows) {
    const itemId = n(lot.item_id);
    const arr = lotsMap.get(itemId) ?? [];
    arr.push(lot);
    lotsMap.set(itemId, arr);
  }

  // ── Build per-item response ───────────────────────────────────────────────

  // Collect item IDs that have any activity (purchased or sold) in this FY
  const activeItemIds = new Set<number>([
    ...Array.from(stockMap.keys()),
    ...Array.from(soldMap.keys()),
  ]);

  let totalRemainingBags = 0;
  let totalRemainingWeightKg = 0;
  let totalStockValue = 0;

  const items = itemRows
    .filter((item) => activeItemIds.has(item.id))
    .map((item) => {
      const stock = stockMap.get(item.id);
      const sold = soldMap.get(item.id);
      const lots = lotsMap.get(item.id) ?? [];

      const purchasedBags = n(stock?.purchased_bags);
      const purchasedWeightKg = n(stock?.purchased_weight_kg);
      const soldBags = n(sold?.sold_bags);
      const soldWeightKg = n(sold?.sold_weight_kg);
      const remainingBags = n(stock?.remaining_bags);
      const remainingWeightKg = n(stock?.remaining_weight_kg);
      const avgRatePerQtl = n(stock?.avg_rate);
      const stockValueRs = n(stock?.stock_value);

      totalRemainingBags += remainingBags;
      totalRemainingWeightKg += remainingWeightKg;
      totalStockValue += stockValueRs;

      return {
        itemId: item.id,
        itemName: item.name,
        itemHindi: item.hindiName ?? item.name,
        purchasedBags,
        purchasedWeightKg,
        soldBags,
        soldWeightKg,
        remainingBags,
        remainingWeightKg,
        avgRatePerQtl: Math.round(avgRatePerQtl * 100) / 100,
        stockValueRs: Math.round(stockValueRs * 100) / 100,
        lots: lots.map((lot) => {
          const kisanName = lot.kisan_name ? String(lot.kisan_name) : null;
          const kisanVillage = lot.kisan_village ? String(lot.kisan_village) : null;
          const source = kisanName
            ? kisanVillage
              ? `${kisanName} — ${kisanVillage}`
              : kisanName
            : "—";

          return {
            lotId: n(lot.id),
            date: sqlDate(lot.date),
            billNo: lot.bill_no ? String(lot.bill_no) : null,
            source,
            purchasedBags: n(lot.quantity_bags),
            totalWeightKg: n(lot.total_weight_kg),
            ratePerQtl: n(lot.rate_per_qtl),
            remainingBags: n(lot.remaining_bags),
            remainingWeightKg: n(lot.remaining_weight_kg),
            gatePassNo: lot.gate_pass_no ? String(lot.gate_pass_no) : null,
          };
        }),
      };
    });

  // ── FyClosing shape ───────────────────────────────────────────────────────

  const fyClosing = fyClosingRow
    ? {
        fyYear: fyClosingRow.fyYear,
        closingDate: fyClosingRow.closingDate.toISOString().slice(0, 10),
        closingStockVal: Number(fyClosingRow.closingStockVal),
        locked: fyClosingRow.locked,
      }
    : null;

  return res.status(200).json({
    fyYear: fyStartYear,
    fyStart,
    fyEnd,
    items,
    totalRemainingBags: Math.round(totalRemainingBags * 1000) / 1000,
    totalRemainingWeightKg: Math.round(totalRemainingWeightKg * 1000) / 1000,
    totalStockValue: Math.round(totalStockValue * 100) / 100,
    fyClosing,
  });
}
