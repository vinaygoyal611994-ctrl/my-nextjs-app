import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import Decimal from "decimal.js";
import { JournalService } from "@/lib/accounting/journal";

const updateSchema = z.object({
  date: z.string(),
  items: z
    .array(
      z.object({
        itemId: z.number().int(),
        unitWeightKg: z.number().positive(),
        quantityBags: z.number().positive(),
        totalWeightKg: z.number().positive(),
        ratePerQtl: z.number().positive(),
        amount: z.number().positive(),
      })
    )
    .min(1),
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
  paymentDueDate: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;
  const userId = session.user.id;

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  // ── GET: fetch single sale for edit form ────────────────────────────────
  if (req.method === "GET") {
    const sale = await prisma.sale.findFirst({
      where: { id, firmId, cancelled: false },
      include: {
        vyapari: { select: { id: true, name: true, village: true } },
        items: {
          include: { item: { select: { id: true, name: true } } },
        },
      },
    });

    if (!sale) return res.status(404).json({ error: "Sale not found" });

    return res.status(200).json({
      id: sale.id,
      billNo: sale.billNo,
      date: sale.date.toISOString(),
      vyapari: sale.vyapari,
      maalAmount: Number(sale.maalAmount),
      wagesAmount: Number(sale.wagesAmount),
      damiPct: Number(sale.damiPct),
      damiAmt: Number(sale.damiAmt),
      committeePct: Number(sale.committeePct),
      committeeAmt: Number(sale.committeeAmt),
      kkfPct: Number(sale.kkfPct),
      kkfAmt: Number(sale.kkfAmt),
      mudatPct: Number(sale.mudatPct),
      mudatAmt: Number(sale.mudatAmt),
      taxableAmount: Number(sale.taxableAmount),
      gstType: sale.gstType,
      sgstPct: Number(sale.sgstPct),
      sgstAmt: Number(sale.sgstAmt),
      cgstPct: Number(sale.cgstPct),
      cgstAmt: Number(sale.cgstAmt),
      igstPct: Number(sale.igstPct),
      igstAmt: Number(sale.igstAmt),
      grandTotal: Number(sale.grandTotal),
      vehicleNo: sale.vehicleNo,
      driverName: sale.driverName,
      driverMobile: sale.driverMobile,
      biltyNo: sale.biltyNo,
      bhadaAmount: sale.bhadaAmount != null ? Number(sale.bhadaAmount) : null,
      bhadaPaidBy: sale.bhadaPaidBy,
      paymentDueDate: sale.paymentDueDate?.toISOString() ?? null,
      items: sale.items.map((i) => ({
        id: i.id,
        itemId: i.itemId,
        item: i.item,
        unitWeightKg: Number(i.unitWeightKg),
        quantityBags: Number(i.quantityBags),
        totalWeightKg: Number(i.totalWeightKg),
        ratePerQtl: Number(i.ratePerQtl),
        amount: Number(i.amount),
      })),
    });
  }

  // ── PUT: update sale ────────────────────────────────────────────────────
  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;

    // Fetch existing sale
    const existing = await prisma.sale.findFirst({
      where: { id, firmId, cancelled: false },
      include: {
        vyapari: { select: { id: true, name: true } },
      },
    });
    if (!existing) return res.status(404).json({ error: "Sale not found" });

    // Server-side recalculation (mirrors create logic exactly)
    const maalAmount = d.items.reduce(
      (s, i) => s.add(new Decimal(i.amount)),
      new Decimal(0)
    );
    const wages = new Decimal(d.wagesAmount);

    const damiAmt = maalAmount.mul(d.damiPct).div(100);
    const committeeAmt = maalAmount.mul(d.committeePct).div(100);
    const kkfAmt = maalAmount.mul(d.kkfPct).div(100);
    const mudatAmt = maalAmount.mul(d.mudatPct).div(100);

    const taxableAmount = maalAmount
      .add(wages)
      .add(damiAmt)
      .add(committeeAmt)
      .add(kkfAmt)
      .add(mudatAmt);

    const sgstAmt = taxableAmount.mul(d.sgstPct).div(100);
    const cgstAmt = taxableAmount.mul(d.cgstPct).div(100);
    const igstAmt = taxableAmount.mul(d.igstPct).div(100);

    const grandTotal = taxableAmount.add(sgstAmt).add(cgstAmt).add(igstAmt);

    await prisma.$transaction(async (tx) => {
      // 1. Find all StockMovements for this sale
      const movements = await tx.stockMovement.findMany({
        where: { refType: "sale", refId: id },
      });

      // 2. Restore stock lots from movements
      for (const movement of movements) {
        await tx.stockLot.update({
          where: { id: movement.stockLotId },
          data: {
            remainingBags: { increment: movement.bags },
            remainingWeightKg: { increment: movement.weightKg },
          },
        });
      }

      // 3. Delete those StockMovements
      await tx.stockMovement.deleteMany({ where: { refType: "sale", refId: id } });

      // 4. Reverse original journal entry
      if (existing.journalEntryId) {
        const js = new JournalService(tx);
        await js.reverse(
          existing.journalEntryId,
          `बिक्री संशोधन — ${existing.billNo}`,
          userId
        );
      }

      // 5. Delete old SaleItems
      await tx.saleItem.deleteMany({ where: { saleId: id } });

      // 6. getOrCreate system accounts (mirrors create logic exactly)
      async function getOrCreate(
        code: string,
        name: string,
        type: "income" | "liability" | "asset" | "expense" | "capital",
        subType: "income" | "payable" | "other"
      ) {
        let acc = await tx.account.findFirst({ where: { firmId, code } });
        if (!acc)
          acc = await tx.account.findFirst({
            where: { firmId, name: { contains: name.split(" ")[0] } },
          });
        if (!acc)
          acc = await tx.account.create({
            data: { firmId, code, name, type, subType, isSystem: true },
          });
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

      // Fetch vyapari account
      const vyapari = await tx.party.findUniqueOrThrow({
        where: { id: existing.vyapariId },
        include: { account: true },
      });

      // Item sales accounts
      const itemsWithAccounts = await Promise.all(
        d.items.map(async (item) => {
          const rec = await tx.item.findUniqueOrThrow({
            where: { id: item.itemId },
            include: { salesAccount: true },
          });
          return { ...item, salesAccountId: rec.salesAccountId };
        })
      );

      // 7. Update sale record + create new items
      const updatedSale = await tx.sale.update({
        where: { id },
        data: {
          date: new Date(d.date),
          maalAmount: maalAmount.toDecimalPlaces(2).toNumber(),
          wagesAmount: wages.toDecimalPlaces(2).toNumber(),
          damiPct: d.damiPct,
          damiAmt: damiAmt.toDecimalPlaces(2).toNumber(),
          committeePct: d.committeePct,
          committeeAmt: committeeAmt.toDecimalPlaces(2).toNumber(),
          kkfPct: d.kkfPct,
          kkfAmt: kkfAmt.toDecimalPlaces(2).toNumber(),
          mudatPct: d.mudatPct,
          mudatAmt: mudatAmt.toDecimalPlaces(2).toNumber(),
          taxableAmount: taxableAmount.toDecimalPlaces(2).toNumber(),
          gstType: d.gstType,
          sgstPct: d.sgstPct,
          sgstAmt: sgstAmt.toDecimalPlaces(2).toNumber(),
          cgstPct: d.cgstPct,
          cgstAmt: cgstAmt.toDecimalPlaces(2).toNumber(),
          igstPct: d.igstPct,
          igstAmt: igstAmt.toDecimalPlaces(2).toNumber(),
          grandTotal: grandTotal.toDecimalPlaces(2).toNumber(),
          vehicleNo: d.vehicleNo,
          driverName: d.driverName,
          driverMobile: d.driverMobile,
          biltyNo: d.biltyNo,
          bhadaAmount: d.bhadaAmount,
          bhadaPaidBy: d.bhadaPaidBy,
          paymentDueDate: d.paymentDueDate ? new Date(d.paymentDueDate) : null,
          journalEntryId: null,
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

      // 8. Build journal lines (same structure as create)
      const journalLines = [
        { accountId: vyapari.account!.id, debit: grandTotal, narration: `बिक्री ${existing.billNo}` },
        ...itemsWithAccounts.map((i) => ({
          accountId: i.salesAccountId!,
          credit: new Decimal(i.amount),
          narration: `Sales — item`,
        })),
        ...(wages.gt(0) && hammaliAcc ? [{ accountId: hammaliAcc.id, credit: wages }] : []),
        ...(damiAmt.gt(0) && damiAcc ? [{ accountId: damiAcc.id, credit: damiAmt }] : []),
        ...(committeeAmt.gt(0) && committeeAcc
          ? [{ accountId: committeeAcc.id, credit: committeeAmt }]
          : []),
        ...(kkfAmt.gt(0) && kkfAcc ? [{ accountId: kkfAcc.id, credit: kkfAmt }] : []),
        ...(mudatAmt.gt(0) && mudatAcc ? [{ accountId: mudatAcc.id, credit: mudatAmt }] : []),
        ...(sgstAmt.gt(0) && sgstAcc ? [{ accountId: sgstAcc.id, credit: sgstAmt }] : []),
        ...(cgstAmt.gt(0) && cgstAcc ? [{ accountId: cgstAcc.id, credit: cgstAmt }] : []),
        ...(igstAmt.gt(0) && igstAcc ? [{ accountId: igstAcc.id, credit: igstAmt }] : []),
      ];

      // 9. Post new journal entry
      const js = new JournalService(tx);
      const { journalEntryId } = await js.post({
        firmId,
        voucherType: "sale",
        date: new Date(d.date),
        narration: `बिक्री (संशोधित) — ${vyapari.name} — ${existing.billNo}`,
        refType: "sale",
        refId: id,
        createdById: userId,
        lines: journalLines,
      });

      // 10. Link new journalEntryId to sale
      await tx.sale.update({ where: { id }, data: { journalEntryId } });

      // 11. Run FIFO stock depletion for new item quantities (mirrors create logic)
      for (const item of updatedSale.items) {
        let qtyNeeded = new Decimal(item.quantityBags.toString());
        const lots = await tx.stockLot.findMany({
          where: { firmId, itemId: item.itemId, remainingBags: { gt: 0 } },
          orderBy: { date: "asc" },
        });
        for (const lot of lots) {
          if (qtyNeeded.lte(0)) break;
          const take = Decimal.min(qtyNeeded, new Decimal(lot.remainingBags.toString()));
          const takeWt = take
            .mul(new Decimal(lot.totalWeightKg.toString()))
            .div(new Decimal(lot.quantityBags.toString()));
          await tx.stockLot.update({
            where: { id: lot.id },
            data: {
              remainingBags: new Decimal(lot.remainingBags.toString())
                .sub(take)
                .toDecimalPlaces(3)
                .toNumber(),
              remainingWeightKg: new Decimal(lot.remainingWeightKg.toString())
                .sub(takeWt)
                .toDecimalPlaces(3)
                .toNumber(),
            },
          });
          await tx.stockMovement.create({
            data: {
              stockLotId: lot.id,
              type: "out",
              bags: take.toDecimalPlaces(3).toNumber(),
              weightKg: takeWt.toDecimalPlaces(3).toNumber(),
              refType: "sale",
              refId: id,
            },
          });
          qtyNeeded = qtyNeeded.sub(take);
        }
      }
    });

    return res.status(200).json({ message: "Updated" });
  }

  return res.status(405).end();
}
