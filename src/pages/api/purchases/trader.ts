import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import Decimal from "decimal.js";
import { JournalService } from "@/lib/accounting/journal";

const itemSchema = z.object({
  itemId: z.number().int().positive(),
  unitWeightKg: z.number().positive(),
  quantityBags: z.number().positive(),
  totalWeightKg: z.number().positive(),
  ratePerQtl: z.number().positive(),
  amount: z.number().positive(),
  katautiPct: z.number().min(0).default(0),
  katautiKg: z.number().min(0).default(0),
  netWeightKg: z.number().positive(),
});

const schema = z.object({
  traderId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  billNo: z.string().max(50).optional(),
  committeePct: z.number().min(0).default(0),
  kkfPct: z.number().min(0).default(0),
  mudatPct: z.number().min(0).default(0),
  sgstPct: z.number().min(0).default(0),
  cgstPct: z.number().min(0).default(0),
  igstPct: z.number().min(0).default(0),
  items: z.array(itemSchema).min(1),
});

async function ensureTables() {
  // Add trader_purchase_id column to stock_lots if not already present
  try {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE stock_lots ADD COLUMN trader_purchase_id INT NULL"
    );
  } catch { /* column already exists */ }

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS trader_purchases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      firm_id INT NOT NULL,
      trader_id INT NOT NULL,
      date DATE NOT NULL,
      bill_no VARCHAR(50) NOT NULL,
      total_item_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      committee_pct DECIMAL(6,4) NOT NULL DEFAULT 0,
      committee_amt DECIMAL(14,2) NOT NULL DEFAULT 0,
      kkf_pct DECIMAL(6,4) NOT NULL DEFAULT 0,
      kkf_amt DECIMAL(14,2) NOT NULL DEFAULT 0,
      mudat_pct DECIMAL(6,4) NOT NULL DEFAULT 0,
      mudat_amt DECIMAL(14,2) NOT NULL DEFAULT 0,
      sgst_pct DECIMAL(6,4) NOT NULL DEFAULT 0,
      sgst_amt DECIMAL(14,2) NOT NULL DEFAULT 0,
      cgst_pct DECIMAL(6,4) NOT NULL DEFAULT 0,
      cgst_amt DECIMAL(14,2) NOT NULL DEFAULT 0,
      igst_pct DECIMAL(6,4) NOT NULL DEFAULT 0,
      igst_amt DECIMAL(14,2) NOT NULL DEFAULT 0,
      net_payable DECIMAL(14,2) NOT NULL DEFAULT 0,
      journal_entry_id INT,
      cancelled TINYINT(1) NOT NULL DEFAULT 0,
      created_by_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS trader_purchase_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      trader_purchase_id INT NOT NULL,
      item_id INT NOT NULL,
      unit_weight_kg DECIMAL(8,3) NOT NULL,
      quantity_bags DECIMAL(10,3) NOT NULL,
      total_weight_kg DECIMAL(12,3) NOT NULL,
      rate_per_qtl DECIMAL(10,2) NOT NULL,
      amount DECIMAL(14,2) NOT NULL,
      katauti_pct DECIMAL(6,4) NOT NULL DEFAULT 0,
      katauti_kg DECIMAL(10,3) NOT NULL DEFAULT 0,
      net_weight_kg DECIMAL(12,3) NOT NULL,
      effective_rate_per_qtl DECIMAL(10,2) NOT NULL DEFAULT 0
    )
  `;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;
  const userId = session.user.id;

  // Ensure raw tables exist on every request
  await ensureTables();

  if (req.method === "GET") {
    // Single record detail
    if (req.query.id) {
      const id = parseInt(req.query.id as string, 10);

      type HeaderRow = {
        id: number; bill_no: string; date: Date;
        trader_id: number; trader_name: string; trader_village: string | null;
        total_item_amount: number; committee_pct: number; committee_amt: number;
        kkf_pct: number; kkf_amt: number; mudat_pct: number; mudat_amt: number;
        sgst_pct: number; sgst_amt: number; cgst_pct: number; cgst_amt: number;
        igst_pct: number; igst_amt: number; net_payable: number;
        journal_entry_id: number | null; cancelled: number; created_at: Date;
      };
      type ItemRow = {
        id: number; item_id: number; item_name: string; item_hindi: string | null;
        unit_weight_kg: number; quantity_bags: number; total_weight_kg: number;
        rate_per_qtl: number; amount: number; katauti_pct: number; katauti_kg: number;
        net_weight_kg: number; effective_rate_per_qtl: number;
      };

      const [headers, items] = await Promise.all([
        prisma.$queryRaw<HeaderRow[]>`
          SELECT tp.*, p.name AS trader_name, p.village AS trader_village
          FROM trader_purchases tp
          JOIN parties p ON p.id = tp.trader_id
          WHERE tp.id = ${id} AND tp.firm_id = ${firmId}
          LIMIT 1
        `,
        prisma.$queryRaw<ItemRow[]>`
          SELECT tpi.*, i.name AS item_name, i.hindi_name AS item_hindi
          FROM trader_purchase_items tpi
          JOIN items i ON i.id = tpi.item_id
          WHERE tpi.trader_purchase_id = ${id}
        `,
      ]);

      if (!headers[0]) return res.status(404).json({ error: "Not found" });
      const h = headers[0];

      return res.status(200).json({
        purchase: {
          id: Number(h.id),
          billNo: h.bill_no,
          date: String(h.date).slice(0, 10),
          traderId: Number(h.trader_id),
          traderName: h.trader_name,
          traderVillage: h.trader_village,
          totalItemAmount: Number(h.total_item_amount),
          committeePct: Number(h.committee_pct),
          committeeAmt: Number(h.committee_amt),
          kkfPct: Number(h.kkf_pct),
          kkfAmt: Number(h.kkf_amt),
          mudatPct: Number(h.mudat_pct),
          mudatAmt: Number(h.mudat_amt),
          sgstPct: Number(h.sgst_pct),
          sgstAmt: Number(h.sgst_amt),
          cgstPct: Number(h.cgst_pct),
          cgstAmt: Number(h.cgst_amt),
          igstPct: Number(h.igst_pct),
          igstAmt: Number(h.igst_amt),
          netPayable: Number(h.net_payable),
          cancelled: Boolean(h.cancelled),
          createdAt: String(h.created_at).slice(0, 19),
        },
        items: items.map((i) => ({
          id: Number(i.id),
          itemId: Number(i.item_id),
          itemName: i.item_hindi || i.item_name,
          unitWeightKg: Number(i.unit_weight_kg),
          quantityBags: Number(i.quantity_bags),
          totalWeightKg: Number(i.total_weight_kg),
          ratePerQtl: Number(i.rate_per_qtl),
          amount: Number(i.amount),
          katautiKg: Number(i.katauti_kg),
          netWeightKg: Number(i.net_weight_kg),
          effectiveRate: Number(i.effective_rate_per_qtl),
        })),
      });
    }

    // List
    const rows = await prisma.$queryRaw<
      Array<{
        id: number; bill_no: string; date: Date;
        trader_name: string; total_item_amount: number; net_payable: number; cancelled: number;
      }>
    >`
      SELECT tp.id, tp.bill_no, tp.date, p.name AS trader_name,
             tp.total_item_amount, tp.net_payable, tp.cancelled
      FROM trader_purchases tp
      JOIN parties p ON p.id = tp.trader_id
      WHERE tp.firm_id = ${firmId}
      ORDER BY tp.date DESC, tp.id DESC
      LIMIT 200
    `;

    return res.status(200).json({
      purchases: rows.map((r) => ({
        id: Number(r.id),
        billNo: r.bill_no,
        date: String(r.date).slice(0, 10),
        traderName: r.trader_name,
        totalItemAmount: Number(r.total_item_amount),
        netPayable: Number(r.net_payable),
        cancelled: Boolean(r.cancelled),
      })),
    });
  }

  if (req.method === "POST") {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = parsed.data;

    // Validate trader belongs to this firm and has a GL account
    const trader = await prisma.party.findFirst({
      where: { id: data.traderId, firmId, type: "vyapari", active: true },
      include: { account: true },
    });
    if (!trader) return res.status(400).json({ error: "Trader not found or not a vyapari" });
    if (!trader.account) return res.status(400).json({ error: "Trader does not have a GL account" });

    // Compute amounts
    const totalItemAmount = data.items.reduce(
      (sum, i) => sum.plus(new Decimal(i.amount)),
      new Decimal(0)
    );

    const committeePct = new Decimal(data.committeePct);
    const kkfPct = new Decimal(data.kkfPct);
    const mudatPct = new Decimal(data.mudatPct);
    const sgstPct = new Decimal(data.sgstPct);
    const cgstPct = new Decimal(data.cgstPct);
    const igstPct = new Decimal(data.igstPct);

    const committeeAmt = totalItemAmount.mul(committeePct).div(100).toDecimalPlaces(2);
    const kkfAmt = totalItemAmount.mul(kkfPct).div(100).toDecimalPlaces(2);
    const mudatAmt = totalItemAmount.mul(mudatPct).div(100).toDecimalPlaces(2);
    const sgstAmt = totalItemAmount.mul(sgstPct).div(100).toDecimalPlaces(2);
    const cgstAmt = totalItemAmount.mul(cgstPct).div(100).toDecimalPlaces(2);
    const igstAmt = totalItemAmount.mul(igstPct).div(100).toDecimalPlaces(2);

    // Trader handles all govt dues (committee, kkf, gst) themselves —
    // we owe them the FULL invoice amount, nothing goes to our payable accounts.
    const netPayable = totalItemAmount
      .plus(committeeAmt)
      .plus(kkfAmt)
      .plus(mudatAmt)
      .plus(sgstAmt)
      .plus(cgstAmt)
      .plus(igstAmt);

    // For stock cost: include committee + kkf + mudat (not GST — GST is a tax passthrough)
    const totalStockFees = committeeAmt.plus(kkfAmt).plus(mudatAmt);

    const result = await prisma.$transaction(async (tx) => {
      // Auto-generate bill number
      const year = new Date(data.date).getFullYear();
      const lastRows = await tx.$queryRaw<Array<{ bill_no: string }>>`
        SELECT bill_no FROM trader_purchases
        WHERE firm_id = ${firmId}
        ORDER BY id DESC
        LIMIT 1
      `;
      const lastBillNo = lastRows[0]?.bill_no ?? "";
      const lastSeq = lastBillNo ? parseInt(lastBillNo.split("-").pop() ?? "0", 10) : 0;
      const billNo = data.billNo?.trim() || `TP-${year}-${String(lastSeq + 1).padStart(4, "0")}`;

      // No govt payable account lookups needed — trader handles all dues themselves

      // Fetch item purchase accounts
      const itemsWithAccounts = await Promise.all(
        data.items.map(async (item) => {
          const itemRecord = await tx.item.findUniqueOrThrow({
            where: { id: item.itemId },
            include: { purchaseAccount: true },
          });
          return { ...item, purchaseAccountId: itemRecord.purchaseAccountId };
        })
      );

      // Build journal lines with rounding-safe proportional fee distribution.
      // "Last item gets the remainder" ensures sum of shares exactly equals the total.
      const totalGst = sgstAmt.plus(cgstAmt).plus(igstAmt);

      let allocatedStockFees = new Decimal(0);
      let allocatedGst = new Decimal(0);
      const drLines = itemsWithAccounts.map((item, idx) => {
        const itemAmt = new Decimal(item.amount);
        const isLast = idx === itemsWithAccounts.length - 1;

        const itemFeeShare =
          totalStockFees.gt(0) && totalItemAmount.gt(0)
            ? isLast
              ? totalStockFees.minus(allocatedStockFees)
              : totalStockFees.mul(itemAmt).div(totalItemAmount).toDecimalPlaces(2)
            : new Decimal(0);
        allocatedStockFees = allocatedStockFees.plus(itemFeeShare);

        const itemGstShare =
          totalGst.gt(0) && totalItemAmount.gt(0)
            ? isLast
              ? totalGst.minus(allocatedGst)
              : totalGst.mul(itemAmt).div(totalItemAmount).toDecimalPlaces(2)
            : new Decimal(0);
        allocatedGst = allocatedGst.plus(itemGstShare);

        return {
          accountId: item.purchaseAccountId!,
          debit: itemAmt.plus(itemFeeShare).plus(itemGstShare),
          narration: `व्यापारी खरीद ${billNo}`,
        };
      });

      // Cr: only Trader GL — full invoice amount (trader pays all govt dues themselves)
      // Dr total = item + committee + kkf + mudat + sgst + cgst + igst
      // Cr total = same (netPayable) ✓  — no govt payable accounts touched
      const crLines = [
        {
          accountId: trader.account!.id,
          credit: netPayable,
          narration: `व्यापारी देय — ${trader.name} — ${billNo}`,
        },
      ];

      const js = new JournalService(tx);
      const { journalEntryId } = await js.post({
        firmId,
        voucherType: "purchase",
        date: new Date(data.date),
        narration: `व्यापारी खरीद — ${trader.name} — ${billNo}`,
        refType: "trader_purchase",
        createdById: userId,
        lines: [...drLines, ...crLines],
      });

      // Insert into trader_purchases
      await tx.$executeRaw`
        INSERT INTO trader_purchases (
          firm_id, trader_id, date, bill_no,
          total_item_amount,
          committee_pct, committee_amt,
          kkf_pct, kkf_amt,
          mudat_pct, mudat_amt,
          sgst_pct, sgst_amt,
          cgst_pct, cgst_amt,
          igst_pct, igst_amt,
          net_payable,
          journal_entry_id,
          created_by_id
        ) VALUES (
          ${firmId}, ${data.traderId}, ${new Date(data.date)}, ${billNo},
          ${totalItemAmount.toNumber()},
          ${committeePct.toNumber()}, ${committeeAmt.toNumber()},
          ${kkfPct.toNumber()}, ${kkfAmt.toNumber()},
          ${mudatPct.toNumber()}, ${mudatAmt.toNumber()},
          ${sgstPct.toNumber()}, ${sgstAmt.toNumber()},
          ${cgstPct.toNumber()}, ${cgstAmt.toNumber()},
          ${igstPct.toNumber()}, ${igstAmt.toNumber()},
          ${netPayable.toNumber()},
          ${journalEntryId},
          ${userId}
        )
      `;

      // Get the inserted trader_purchase id
      const idRows = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM trader_purchases
        WHERE firm_id = ${firmId} AND bill_no = ${billNo}
        ORDER BY id DESC LIMIT 1
      `;
      const traderPurchaseId = idRows[0]?.id;

      if (!traderPurchaseId) throw new Error("Failed to retrieve trader_purchase id");

      // Insert items and create stock lots
      for (const item of data.items) {
        const itemAmt = new Decimal(item.amount);
        const itemFeeShare =
          totalStockFees.gt(0) && totalItemAmount.gt(0)
            ? totalStockFees.mul(itemAmt).div(totalItemAmount).toDecimalPlaces(2)
            : new Decimal(0);
        const effectiveAmt = itemAmt.plus(itemFeeShare);
        const netWtKg = new Decimal(item.netWeightKg);
        const effectiveRate = netWtKg.gt(0)
          ? effectiveAmt.div(netWtKg).mul(100).toDecimalPlaces(2)
          : new Decimal(item.ratePerQtl);

        await tx.$executeRaw`
          INSERT INTO trader_purchase_items (
            trader_purchase_id, item_id,
            unit_weight_kg, quantity_bags, total_weight_kg,
            rate_per_qtl, amount,
            katauti_pct, katauti_kg, net_weight_kg,
            effective_rate_per_qtl
          ) VALUES (
            ${traderPurchaseId}, ${item.itemId},
            ${item.unitWeightKg}, ${item.quantityBags}, ${item.totalWeightKg},
            ${item.ratePerQtl}, ${item.amount},
            ${item.katautiPct}, ${item.katautiKg}, ${item.netWeightKg},
            ${effectiveRate.toNumber()}
          )
        `;

        // Create stock lot (kisanId = null for trader purchase)
        const lot = await tx.stockLot.create({
          data: {
            firmId,
            purchaseId: null,
            kisanId: null,
            itemId: item.itemId,
            date: new Date(data.date),
            quantityBags: item.quantityBags,
            totalWeightKg: item.totalWeightKg,
            remainingBags: item.quantityBags,
            remainingWeightKg: item.totalWeightKg,
            ratePerQtl: effectiveRate.toNumber(),
            committeePaid: committeeAmt.gt(0),
          },
        });
        // Link stock lot to this trader purchase for edit support
        await tx.$executeRaw`
          UPDATE stock_lots SET trader_purchase_id = ${traderPurchaseId} WHERE id = ${lot.id}
        `;
      }

      return { traderPurchaseId, billNo };
    });

    return res.status(201).json(result);
  }

  if (req.method === "PUT") {
    const id = parseInt(req.query.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const updateSchema = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      committeePct: z.number().min(0).default(0),
      kkfPct: z.number().min(0).default(0),
      mudatPct: z.number().min(0).default(0),
      sgstPct: z.number().min(0).default(0),
      cgstPct: z.number().min(0).default(0),
      igstPct: z.number().min(0).default(0),
      items: z.array(itemSchema).min(1),
    });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = parsed.data;

    // Fetch existing trader purchase
    type ExistingRow = {
      id: number; bill_no: string; date: Date;
      trader_id: number; journal_entry_id: number | null; cancelled: number;
    };
    const existingRows = await prisma.$queryRaw<ExistingRow[]>`
      SELECT id, bill_no, date, trader_id, journal_entry_id, cancelled
      FROM trader_purchases
      WHERE id = ${id} AND firm_id = ${firmId}
      LIMIT 1
    `;
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.cancelled) return res.status(400).json({ error: "Cancelled record cannot be edited" });

    // Find linked stock lots (by trader_purchase_id; null for old records)
    type LotRow = { id: number; quantity_bags: string; remaining_bags: string };
    const lotRows = await prisma.$queryRaw<LotRow[]>`
      SELECT id, quantity_bags, remaining_bags
      FROM stock_lots
      WHERE trader_purchase_id = ${id} AND firm_id = ${firmId}
    `;

    // Check: no stock sold
    for (const lot of lotRows) {
      const qty = new Decimal(String(lot.quantity_bags));
      const rem = new Decimal(String(lot.remaining_bags));
      if (rem.lt(qty)) {
        return res.status(400).json({ error: "Stock already sold — cancel and re-create" });
      }
    }

    // Recompute amounts (same formulas as POST)
    const totalItemAmount = data.items.reduce(
      (sum, i) => sum.plus(new Decimal(i.amount)),
      new Decimal(0)
    );
    const committeePct = new Decimal(data.committeePct);
    const kkfPct      = new Decimal(data.kkfPct);
    const mudatPct    = new Decimal(data.mudatPct);
    const sgstPct     = new Decimal(data.sgstPct);
    const cgstPct     = new Decimal(data.cgstPct);
    const igstPct     = new Decimal(data.igstPct);

    const committeeAmt = totalItemAmount.mul(committeePct).div(100).toDecimalPlaces(2);
    const kkfAmt       = totalItemAmount.mul(kkfPct).div(100).toDecimalPlaces(2);
    const mudatAmt     = totalItemAmount.mul(mudatPct).div(100).toDecimalPlaces(2);
    const sgstAmt      = totalItemAmount.mul(sgstPct).div(100).toDecimalPlaces(2);
    const cgstAmt      = totalItemAmount.mul(cgstPct).div(100).toDecimalPlaces(2);
    const igstAmt      = totalItemAmount.mul(igstPct).div(100).toDecimalPlaces(2);
    const netPayable   = totalItemAmount
      .plus(committeeAmt).plus(kkfAmt).plus(mudatAmt)
      .plus(sgstAmt).plus(cgstAmt).plus(igstAmt);
    const totalStockFees = committeeAmt.plus(kkfAmt).plus(mudatAmt);
    const totalGst       = sgstAmt.plus(cgstAmt).plus(igstAmt);

    // Fetch trader with GL account
    const trader = await prisma.party.findFirst({
      where: { id: existing.trader_id, firmId, type: "vyapari" },
      include: { account: true },
    });
    if (!trader?.account) return res.status(400).json({ error: "Trader GL account not found" });

    await prisma.$transaction(async (tx) => {
      // 1. Reverse original journal entry
      if (existing.journal_entry_id) {
        const js = new JournalService(tx);
        await js.reverse(
          existing.journal_entry_id,
          `व्यापारी खरीद संशोधन — ${existing.bill_no}`,
          userId
        );
      }

      // 2. Delete old stock lots
      const lotIds = lotRows.map((l) => l.id);
      if (lotIds.length > 0) {
        await tx.stockLot.deleteMany({ where: { id: { in: lotIds } } });
      }

      // 3. Delete old items
      await tx.$executeRaw`
        DELETE FROM trader_purchase_items WHERE trader_purchase_id = ${id}
      `;

      // 4. Fetch item purchase accounts
      const itemsWithAccounts = await Promise.all(
        data.items.map(async (item) => {
          const itemRecord = await tx.item.findUniqueOrThrow({
            where: { id: item.itemId },
            include: { purchaseAccount: true },
          });
          return { ...item, purchaseAccountId: itemRecord.purchaseAccountId };
        })
      );

      // 5. Build journal lines (same as POST, rounding-safe)
      let allocatedStockFees = new Decimal(0);
      let allocatedGst       = new Decimal(0);
      const drLines = itemsWithAccounts.map((item, idx) => {
        const itemAmt = new Decimal(item.amount);
        const isLast  = idx === itemsWithAccounts.length - 1;
        const itemFeeShare =
          totalStockFees.gt(0) && totalItemAmount.gt(0)
            ? isLast
              ? totalStockFees.minus(allocatedStockFees)
              : totalStockFees.mul(itemAmt).div(totalItemAmount).toDecimalPlaces(2)
            : new Decimal(0);
        allocatedStockFees = allocatedStockFees.plus(itemFeeShare);
        const itemGstShare =
          totalGst.gt(0) && totalItemAmount.gt(0)
            ? isLast
              ? totalGst.minus(allocatedGst)
              : totalGst.mul(itemAmt).div(totalItemAmount).toDecimalPlaces(2)
            : new Decimal(0);
        allocatedGst = allocatedGst.plus(itemGstShare);
        return {
          accountId: item.purchaseAccountId!,
          debit: itemAmt.plus(itemFeeShare).plus(itemGstShare),
          narration: `व्यापारी खरीद ${existing.bill_no}`,
        };
      });

      const crLines = [
        {
          accountId: trader.account!.id,
          credit: netPayable,
          narration: `व्यापारी देय — ${trader.name} — ${existing.bill_no}`,
        },
      ];

      // 6. Post new journal entry
      const js = new JournalService(tx);
      const { journalEntryId: newJeId } = await js.post({
        firmId,
        voucherType: "purchase",
        date: new Date(data.date),
        narration: `व्यापारी खरीद (संशोधित) — ${trader.name} — ${existing.bill_no}`,
        refType: "trader_purchase",
        createdById: userId,
        lines: [...drLines, ...crLines],
      });

      // 7. Update trader_purchases header
      await tx.$executeRaw`
        UPDATE trader_purchases SET
          date              = ${new Date(data.date)},
          total_item_amount = ${totalItemAmount.toNumber()},
          committee_pct     = ${committeePct.toNumber()},
          committee_amt     = ${committeeAmt.toNumber()},
          kkf_pct           = ${kkfPct.toNumber()},
          kkf_amt           = ${kkfAmt.toNumber()},
          mudat_pct         = ${mudatPct.toNumber()},
          mudat_amt         = ${mudatAmt.toNumber()},
          sgst_pct          = ${sgstPct.toNumber()},
          sgst_amt          = ${sgstAmt.toNumber()},
          cgst_pct          = ${cgstPct.toNumber()},
          cgst_amt          = ${cgstAmt.toNumber()},
          igst_pct          = ${igstPct.toNumber()},
          igst_amt          = ${igstAmt.toNumber()},
          net_payable       = ${netPayable.toNumber()},
          journal_entry_id  = ${newJeId}
        WHERE id = ${id} AND firm_id = ${firmId}
      `;

      // 8. Insert new items + stock lots
      for (const item of data.items) {
        const itemAmt = new Decimal(item.amount);
        const itemFeeShare =
          totalStockFees.gt(0) && totalItemAmount.gt(0)
            ? totalStockFees.mul(itemAmt).div(totalItemAmount).toDecimalPlaces(2)
            : new Decimal(0);
        const effectiveAmt = itemAmt.plus(itemFeeShare);
        const netWtKg      = new Decimal(item.netWeightKg);
        const effectiveRate = netWtKg.gt(0)
          ? effectiveAmt.div(netWtKg).mul(100).toDecimalPlaces(2)
          : new Decimal(item.ratePerQtl);

        await tx.$executeRaw`
          INSERT INTO trader_purchase_items (
            trader_purchase_id, item_id,
            unit_weight_kg, quantity_bags, total_weight_kg,
            rate_per_qtl, amount,
            katauti_pct, katauti_kg, net_weight_kg,
            effective_rate_per_qtl
          ) VALUES (
            ${id}, ${item.itemId},
            ${item.unitWeightKg}, ${item.quantityBags}, ${item.totalWeightKg},
            ${item.ratePerQtl}, ${item.amount},
            ${item.katautiPct}, ${item.katautiKg}, ${item.netWeightKg},
            ${effectiveRate.toNumber()}
          )
        `;

        const lot = await tx.stockLot.create({
          data: {
            firmId,
            purchaseId: null,
            kisanId: null,
            itemId: item.itemId,
            date: new Date(data.date),
            quantityBags: item.quantityBags,
            totalWeightKg: item.totalWeightKg,
            remainingBags: item.quantityBags,
            remainingWeightKg: item.totalWeightKg,
            ratePerQtl: effectiveRate.toNumber(),
            committeePaid: committeeAmt.gt(0),
          },
        });
        await tx.$executeRaw`
          UPDATE stock_lots SET trader_purchase_id = ${id} WHERE id = ${lot.id}
        `;
      }
    });

    return res.status(200).json({ message: "Updated" });
  }

  return res.status(405).end();
}
