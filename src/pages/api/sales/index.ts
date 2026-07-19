import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import Decimal from "decimal.js";
import { JournalService } from "@/lib/accounting/journal";

const itemSchema = z.object({
  itemId: z.number().int(),
  unitWeightKg: z.number().positive(),
  quantityBags: z.number().positive(),
  totalWeightKg: z.number().positive(),
  ratePerQtl: z.number().positive(),
  amount: z.number().positive(),
});

const saleSchema = z.object({
  vyapariId: z.number().int(),
  date: z.string(),
  billNo: z.string().max(50).optional(),
  saudaId: z.number().int().optional(),
  items: z.array(itemSchema).min(1),
  wagesAmount: z.number().min(0).default(0),
  damiPct: z.number().min(0).default(0),
  committeePct: z.number().min(0).default(0),
  kkfPct: z.number().min(0).default(0),
  mudatPct: z.number().min(0).default(0),
  gstType: z.enum(["intra", "inter"]).optional(),
  sgstPct: z.number().min(0).default(0),
  cgstPct: z.number().min(0).default(0),
  igstPct: z.number().min(0).default(0),
  vehicleNo: z.string().optional(),
  driverName: z.string().optional(),
  driverMobile: z.string().optional(),
  biltyNo: z.string().optional(),
  bhadaAmount: z.number().min(0).optional(),
  bhadaPaidBy: z.string().optional(),
  transporterId: z.number().int().optional(),
  paymentDueDate: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;
  const userId = session.user.id;

  if (req.method === "GET") {
    const { page = "1", vyapariId, dateFrom, dateTo } = req.query;
    const pageNum = parseInt(page as string, 10);
    const where: Record<string, unknown> = { firmId, cancelled: false };
    if (vyapariId) where.vyapariId = parseInt(vyapariId as string);
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) (where.date as Record<string, unknown>).gte = new Date(dateFrom as string);
      if (dateTo) (where.date as Record<string, unknown>).lte = new Date(dateTo as string);
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          vyapari: { select: { name: true, village: true } },
          items: { select: { id: true } },
        },
        orderBy: { date: "desc" },
        take: 30,
        skip: (pageNum - 1) * 30,
      }),
      prisma.sale.count({ where }),
    ]);

    return res.status(200).json({
      sales: sales.map((s) => ({
        id: s.id,
        billNo: s.billNo,
        date: s.date.toISOString(),
        vyapari: s.vyapari.name,
        maalAmount: Number(s.maalAmount),
        grandTotal: Number(s.grandTotal),
        paymentDueDate: s.paymentDueDate?.toISOString() ?? null,
        itemCount: s.items.length,
      })),
      total,
      page: pageNum,
    });
  }

  if (req.method === "POST") {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;

    // ── Server-side recalculation ──────────────────────────────────────────
    const maalAmount = d.items.reduce((s, i) => s.add(new Decimal(i.amount)), new Decimal(0));
    const wages = new Decimal(d.wagesAmount);

    const damiAmt = maalAmount.mul(d.damiPct).div(100);
    const committeeAmt = maalAmount.mul(d.committeePct).div(100);
    const kkfAmt = maalAmount.mul(d.kkfPct).div(100);
    const mudatAmt = maalAmount.mul(d.mudatPct).div(100);

    const taxableAmount = maalAmount.add(wages).add(damiAmt).add(committeeAmt).add(kkfAmt).add(mudatAmt);

    const sgstAmt = taxableAmount.mul(d.sgstPct).div(100);
    const cgstAmt = taxableAmount.mul(d.cgstPct).div(100);
    const igstAmt = taxableAmount.mul(d.igstPct).div(100);

    const grandTotal = taxableAmount.add(sgstAmt).add(cgstAmt).add(igstAmt);

    const result = await prisma.$transaction(async (tx) => {
      // Bill number
      const lastSale = await tx.sale.findFirst({
        where: { firmId }, orderBy: { id: "desc" }, select: { billNo: true },
      });
      const lastSeq = lastSale ? parseInt(lastSale.billNo.split("-").pop() ?? "0") : 0;
      const year = new Date(d.date).getFullYear();
      const billNo = d.billNo?.trim() || `BK-${year}-${String(lastSeq + 1).padStart(4, "0")}`;

      // Fetch vyapari account
      const vyapari = await tx.party.findUniqueOrThrow({
        where: { id: d.vyapariId }, include: { account: true },
      });

      // System accounts — ensure they exist with stable codes
      async function getOrCreate(
        code: string, name: string, type: "income" | "liability" | "asset" | "expense" | "capital", subType: "income" | "payable" | "other"
      ) {
        let acc = await tx.account.findFirst({ where: { firmId, code } });
        if (!acc) acc = await tx.account.findFirst({ where: { firmId, name: { contains: name.split(" ")[0] } } });
        if (!acc) acc = await tx.account.create({ data: { firmId, code, name, type, subType, isSystem: true } });
        return acc;
      }

      const [damiAcc, committeeAcc, kkfAcc, hammaliAcc, mudatAcc, sgstAcc, cgstAcc, igstAcc] =
        await Promise.all([
          getOrCreate("DAMI001", "Dami / Commission (दमी)", "income", "income"),
          getOrCreate("MSHK001", "Mandi Shulk Payable", "liability", "payable"),
          getOrCreate("KKFP001", "KK Fees Payable", "liability", "payable"),
          getOrCreate("HAM001", "Hammali / Labour (हम्माली)", "liability", "payable"),
          getOrCreate("MUDAT001", "Mudat / Bhaav Badha (मुदत)", "income", "income"),
          getOrCreate("SGST001", "SGST Payable", "liability", "payable"),
          getOrCreate("CGST001", "CGST Payable", "liability", "payable"),
          getOrCreate("IGST001", "IGST Payable", "liability", "payable"),
        ]);

      // Item sales accounts
      const itemsWithAccounts = await Promise.all(
        d.items.map(async (item) => {
          const rec = await tx.item.findUniqueOrThrow({
            where: { id: item.itemId }, include: { salesAccount: true },
          });
          return { ...item, salesAccountId: rec.salesAccountId };
        })
      );

      // Create sale record
      const sale = await tx.sale.create({
        data: {
          firmId,
          vyapariId: d.vyapariId,
          saudaId: d.saudaId,
          billNo,
          date: new Date(d.date),
          maalAmount: maalAmount.toDecimalPlaces(2).toNumber(),
          wagesAmount: wages.toDecimalPlaces(2).toNumber(),
          damiPct: d.damiPct, damiAmt: damiAmt.toDecimalPlaces(2).toNumber(),
          committeePct: d.committeePct, committeeAmt: committeeAmt.toDecimalPlaces(2).toNumber(),
          kkfPct: d.kkfPct, kkfAmt: kkfAmt.toDecimalPlaces(2).toNumber(),
          mudatPct: d.mudatPct, mudatAmt: mudatAmt.toDecimalPlaces(2).toNumber(),
          taxableAmount: taxableAmount.toDecimalPlaces(2).toNumber(),
          gstType: d.gstType,
          sgstPct: d.sgstPct, sgstAmt: sgstAmt.toDecimalPlaces(2).toNumber(),
          cgstPct: d.cgstPct, cgstAmt: cgstAmt.toDecimalPlaces(2).toNumber(),
          igstPct: d.igstPct, igstAmt: igstAmt.toDecimalPlaces(2).toNumber(),
          grandTotal: grandTotal.toDecimalPlaces(2).toNumber(),
          vehicleNo: d.vehicleNo,
          driverName: d.driverName,
          driverMobile: d.driverMobile,
          biltyNo: d.biltyNo,
          bhadaAmount: d.bhadaAmount,
          bhadaPaidBy: d.bhadaPaidBy,
          transporterId: d.transporterId,
          paymentDueDate: d.paymentDueDate ? new Date(d.paymentDueDate) : undefined,
          createdById: userId,
          items: {
            create: d.items.map((i) => ({
              itemId: i.itemId,
              unitWeightKg: i.unitWeightKg,
              quantityBags: i.quantityBags,
              totalWeightKg: i.totalWeightKg,
              ratePerQtl: i.ratePerQtl,
              amount: i.amount,
            })),
          },
        },
        include: { items: true },
      });

      // Journal lines — Dr: Vyapari A/c (grand total), Cr: line-wise sales accounts + charges
      const journalLines = [
        { accountId: vyapari.account!.id, debit: grandTotal, narration: `बिक्री ${billNo}` },
        ...itemsWithAccounts.map((i) => ({
          accountId: i.salesAccountId!,
          credit: new Decimal(i.amount),
          narration: `Sales — item`,
        })),
        ...(wages.gt(0) && hammaliAcc ? [{ accountId: hammaliAcc.id, credit: wages }] : []),
        ...(damiAmt.gt(0) && damiAcc ? [{ accountId: damiAcc.id, credit: damiAmt }] : []),
        ...(committeeAmt.gt(0) && committeeAcc ? [{ accountId: committeeAcc.id, credit: committeeAmt }] : []),
        ...(kkfAmt.gt(0) && kkfAcc ? [{ accountId: kkfAcc.id, credit: kkfAmt }] : []),
        ...(mudatAmt.gt(0) && mudatAcc ? [{ accountId: mudatAcc.id, credit: mudatAmt }] : []),
        ...(sgstAmt.gt(0) && sgstAcc ? [{ accountId: sgstAcc.id, credit: sgstAmt }] : []),
        ...(cgstAmt.gt(0) && cgstAcc ? [{ accountId: cgstAcc.id, credit: cgstAmt }] : []),
        ...(igstAmt.gt(0) && igstAcc ? [{ accountId: igstAcc.id, credit: igstAmt }] : []),
      ];

      const js = new JournalService(tx);
      const { journalEntryId } = await js.post({
        firmId, voucherType: "sale", date: new Date(d.date),
        narration: `बिक्री — ${vyapari.name} — ${billNo}`,
        refType: "sale", refId: sale.id, createdById: userId,
        lines: journalLines,
      });

      await tx.sale.update({ where: { id: sale.id }, data: { journalEntryId } });

      // Deduct stock FIFO for each item
      for (const item of sale.items) {
        let qtyNeeded = new Decimal(item.quantityBags.toString());
        const lots = await tx.stockLot.findMany({
          where: { firmId, itemId: item.itemId, remainingBags: { gt: 0 } },
          orderBy: { date: "asc" },
        });
        for (const lot of lots) {
          if (qtyNeeded.lte(0)) break;
          const take = Decimal.min(qtyNeeded, new Decimal(lot.remainingBags.toString()));
          const takeWt = take.mul(new Decimal(lot.totalWeightKg.toString())).div(new Decimal(lot.quantityBags.toString()));
          await tx.stockLot.update({
            where: { id: lot.id },
            data: {
              remainingBags: new Decimal(lot.remainingBags.toString()).sub(take).toDecimalPlaces(3).toNumber(),
              remainingWeightKg: new Decimal(lot.remainingWeightKg.toString()).sub(takeWt).toDecimalPlaces(3).toNumber(),
            },
          });
          await tx.stockMovement.create({
            data: {
              stockLotId: lot.id, type: "out",
              bags: take.toDecimalPlaces(3).toNumber(),
              weightKg: takeWt.toDecimalPlaces(3).toNumber(),
              refType: "sale", refId: sale.id,
            },
          });
          qtyNeeded = qtyNeeded.sub(take);
        }
      }

      return { saleId: sale.id, billNo };
    });

    return res.status(201).json(result);
  }

  return res.status(405).end();
}
