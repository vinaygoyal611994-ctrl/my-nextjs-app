import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  fyYear: z.number().int().min(2000).max(2100),
});

interface StockValueRow {
  stock_value: unknown;
}

function n(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") return parseFloat(v) || 0;
  return Number(v);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  // Only malik can close FY
  if (session.user.role !== "malik") {
    return res.status(403).json({ error: "केवल मालिक वित्तीय वर्ष बंद कर सकते हैं" });
  }

  const firmId = session.user.firmId;

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { fyYear } = parsed.data;

  // fyYear = start year of FY, e.g. 2025 → FY 2025-26, ends March 31 2026
  const fyEnd = new Date(`${fyYear + 1}-03-31`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // FY must be fully over (March 31 must have passed)
  if (fyEnd >= today) {
    return res.status(400).json({
      error: `वित्तीय वर्ष ${fyYear}-${String(fyYear + 1).slice(2)} अभी समाप्त नहीं हुआ है (${fyEnd.toLocaleDateString("en-IN")} तक चलेगा)`,
    });
  }

  // Check if already locked
  const existing = await prisma.fyClosing.findUnique({
    where: { firmId_fyYear: { firmId, fyYear } },
  });

  if (existing?.locked) {
    return res.status(409).json({
      error: `वित्तीय वर्ष ${fyYear}-${String(fyYear + 1).slice(2)} पहले से बंद है`,
      closingStockVal: Number(existing.closingStockVal),
    });
  }

  // Calculate closing stock value — SUM of remaining stock lots as of March 31 of that FY
  const fyStart = `${fyYear}-04-01`;
  const fyEndStr = `${fyYear + 1}-03-31`;

  const [valueRows] = await Promise.all([
    prisma.$queryRaw<StockValueRow[]>`
      SELECT
        SUM(sl.remaining_weight_kg / 100 * sl.rate_per_qtl) AS stock_value
      FROM stock_lots sl
      WHERE sl.firm_id = ${firmId}
        AND sl.date >= ${fyStart}
        AND sl.date <= ${fyEndStr}
    `,
  ]);

  const closingStockVal = Math.round(n(valueRows[0]?.stock_value) * 100) / 100;

  // Upsert FyClosing record
  const closing = await prisma.fyClosing.upsert({
    where: { firmId_fyYear: { firmId, fyYear } },
    create: {
      firmId,
      fyYear,
      closingDate: fyEnd,
      closingStockVal,
      locked: true,
    },
    update: {
      closingDate: fyEnd,
      closingStockVal,
      locked: true,
    },
  });

  return res.status(200).json({
    ok: true,
    fyYear,
    closingDate: closing.closingDate.toISOString().slice(0, 10),
    closingStockVal: Number(closing.closingStockVal),
  });
}
