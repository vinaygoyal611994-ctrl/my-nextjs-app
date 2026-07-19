import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import Decimal from "decimal.js";
import { JournalService } from "@/lib/accounting/journal";

const updateSchema = z.object({
  date: z.string(),
  wagesAmount: z.number().min(0).default(0),
  advanceAdjusted: z.number().min(0).default(0),
  byajAdjusted: z.number().min(0).default(0),
  committeePct: z.number().min(0).default(0),
  kkfPct: z.number().min(0).default(0),
  items: z
    .array(
      z.object({
        itemId: z.number().int(),
        unitWeightKg: z.number().positive(),
        quantityBags: z.number().positive(),
        totalWeightKg: z.number().positive(),
        ratePerQtl: z.number().positive(),
        amount: z.number().positive(),
        katautiPct: z.number().min(0).default(0),
        katautiKg: z.number().min(0).default(0),
        netWeightKg: z.number().positive(),
      })
    )
    .min(1),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;
  const userId = session.user.id;

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  // ── GET: fetch single purchase for edit form ────────────────────────────
  if (req.method === "GET") {
    const purchase = await prisma.purchase.findFirst({
      where: { id, firmId, cancelled: false },
      include: {
        kisan: { select: { id: true, name: true, village: true } },
        items: {
          include: { item: { select: { id: true, name: true } } },
        },
      },
    });

    if (!purchase) return res.status(404).json({ error: "Purchase not found" });

    return res.status(200).json({
      id: purchase.id,
      billNo: purchase.billNo,
      date: purchase.date.toISOString(),
      purchaseType: purchase.purchaseType,
      kisan: purchase.kisan,
      totalAmount: Number(purchase.totalAmount),
      wagesAmount: Number(purchase.wagesAmount),
      advanceAdjusted: Number(purchase.advanceAdjusted),
      byajAdjusted: Number(purchase.byajAdjusted),
      netPayable: Number(purchase.netPayable),
      items: purchase.items.map((i) => ({
        id: i.id,
        itemId: i.itemId,
        item: i.item,
        unitWeightKg: Number(i.unitWeightKg),
        quantityBags: Number(i.quantityBags),
        totalWeightKg: Number(i.totalWeightKg),
        ratePerQtl: Number(i.ratePerQtl),
        amount: Number(i.amount),
        katautiPct: Number(i.katautiPct),
        katautiKg: Number(i.katautiKg),
        netWeightKg: Number(i.netWeightKg),
      })),
    });
  }

  // ── PUT: update purchase ────────────────────────────────────────────────
  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = parsed.data;

    // Fetch existing purchase (with stock lots for khud validation)
    const existing = await prisma.purchase.findFirst({
      where: { id, firmId, cancelled: false },
      include: {
        kisan: { select: { id: true, name: true } },
        stockLots: true,
      },
    });
    if (!existing) return res.status(404).json({ error: "Purchase not found" });

    // Check: khud purchases — ensure no stock has been partially sold
    if (existing.purchaseType === "khud") {
      for (const lot of existing.stockLots) {
        if (new Decimal(lot.remainingBags.toString()).lt(new Decimal(lot.quantityBags.toString()))) {
          return res.status(400).json({
            error: "Stock already sold — cancel and re-create",
          });
        }
      }
    }

    // Server-side recalculation (mirrors create logic exactly)
    const totalAmount = data.items.reduce(
      (sum, i) => sum.add(new Decimal(i.amount)),
      new Decimal(0)
    );
    const wages = new Decimal(data.wagesAmount);
    const advAdj = new Decimal(data.advanceAdjusted);
    const byajAdj = new Decimal(data.byajAdjusted);
    const netPayable = totalAmount.sub(wages).sub(advAdj).sub(byajAdj);

    // Committee & KKF only apply to khud purchases
    const committeePct =
      existing.purchaseType === "khud" ? new Decimal(data.committeePct) : new Decimal(0);
    const kkfPct =
      existing.purchaseType === "khud" ? new Decimal(data.kkfPct) : new Decimal(0);
    const committeeAmt = totalAmount.mul(committeePct).div(100).toDecimalPlaces(2);
    const kkfAmt = totalAmount.mul(kkfPct).div(100).toDecimalPlaces(2);

    if (netPayable.lt(0)) {
      return res.status(400).json({ error: "कटौती कुल रकम से अधिक नहीं हो सकती" });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Reverse original journal entry
      if (existing.journalEntryId) {
        const js = new JournalService(tx);
        await js.reverse(
          existing.journalEntryId,
          `खरीद संशोधन — ${existing.billNo}`,
          userId
        );
      }

      // 2. Delete old PurchaseItems
      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });

      // 3. If khud: delete old StockLots
      if (existing.purchaseType === "khud") {
        await tx.stockLot.deleteMany({ where: { purchaseId: id } });
      }

      // 4. Fetch kisan account
      const kisan = await tx.party.findUniqueOrThrow({
        where: { id: existing.kisanId },
        include: { account: true },
      });

      // 5. getOrCreate system accounts (mirrors create logic)
      let hammaliAccount = await tx.account.findFirst({ where: { firmId, code: "HAM001" } });
      if (!hammaliAccount) {
        hammaliAccount = await tx.account.findFirst({
          where: { firmId, name: { contains: "Hammali" } },
        });
      }
      if (!hammaliAccount && wages.gt(0)) {
        hammaliAccount = await tx.account.create({
          data: {
            firmId,
            code: "HAM001",
            name: "Hammali / Labour (हम्माली)",
            type: "liability",
            subType: "payable",
            isSystem: true,
          },
        });
      }

      let committeeAccount = null;
      if (committeeAmt.gt(0)) {
        committeeAccount = await tx.account.findFirst({ where: { firmId, code: "MSHK001" } });
        if (!committeeAccount) {
          committeeAccount = await tx.account.create({
            data: {
              firmId,
              code: "MSHK001",
              name: "Mandi Shulk Payable",
              type: "liability",
              subType: "payable",
              isSystem: true,
            },
          });
        }
      }

      let kkfAccount = null;
      if (kkfAmt.gt(0)) {
        kkfAccount = await tx.account.findFirst({ where: { firmId, code: "KKFP001" } });
        if (!kkfAccount) {
          kkfAccount = await tx.account.create({
            data: {
              firmId,
              code: "KKFP001",
              name: "KK Fees Payable",
              type: "liability",
              subType: "payable",
              isSystem: true,
            },
          });
        }
      }

      // 6. Build items with their purchase accounts
      const itemsWithAccounts = await Promise.all(
        data.items.map(async (item) => {
          const itemRecord = await tx.item.findUniqueOrThrow({
            where: { id: item.itemId },
            include: { purchaseAccount: true },
          });
          return { ...item, purchaseAccountId: itemRecord.purchaseAccountId };
        })
      );

      // 7. Update purchase record + create new items
      const updatedPurchase = await tx.purchase.update({
        where: { id },
        data: {
          date: new Date(data.date),
          totalAmount: totalAmount.toDecimalPlaces(2).toNumber(),
          wagesAmount: wages.toDecimalPlaces(2).toNumber(),
          advanceAdjusted: advAdj.toDecimalPlaces(2).toNumber(),
          byajAdjusted: byajAdj.toDecimalPlaces(2).toNumber(),
          netPayable: netPayable.toDecimalPlaces(2).toNumber(),
          journalEntryId: null,
          items: {
            create: data.items.map((i) => ({
              itemId: i.itemId,
              unitWeightKg: i.unitWeightKg,
              quantityBags: i.quantityBags,
              totalWeightKg: i.totalWeightKg,
              ratePerQtl: i.ratePerQtl,
              amount: i.amount,
              katautiPct: i.katautiPct,
              katautiKg: i.katautiKg,
              netWeightKg: i.netWeightKg,
            })),
          },
        },
        include: { items: true },
      });

      // 8. Build journal lines (same structure as create)
      const kisanCredit = totalAmount.sub(wages);
      const totalFees = committeeAmt.plus(kkfAmt);

      let allocatedFees = new Decimal(0);
      const drLines = itemsWithAccounts.map((item, idx) => {
        const itemAmt = new Decimal(item.amount);
        const isLast = idx === itemsWithAccounts.length - 1;
        const itemFeeShare =
          totalFees.gt(0) && totalAmount.gt(0)
            ? isLast
              ? totalFees.minus(allocatedFees)
              : totalFees.mul(itemAmt).div(totalAmount).toDecimalPlaces(2)
            : new Decimal(0);
        allocatedFees = allocatedFees.plus(itemFeeShare);
        return {
          accountId: item.purchaseAccountId!,
          debit: itemAmt.plus(itemFeeShare),
          narration: `खरीद ${existing.billNo}`,
        };
      });

      const journalLines = [
        ...drLines,
        {
          accountId: kisan.account!.id,
          credit: kisanCredit,
          narration: `किसान देय ${kisan.name}`,
        },
        ...(wages.gt(0) && hammaliAccount
          ? [{ accountId: hammaliAccount.id, credit: wages, narration: "हम्माली देय" }]
          : []),
        ...(committeeAmt.gt(0) && committeeAccount
          ? [{ accountId: committeeAccount.id, credit: committeeAmt, narration: "मंडी शुल्क देय" }]
          : []),
        ...(kkfAmt.gt(0) && kkfAccount
          ? [{ accountId: kkfAccount.id, credit: kkfAmt, narration: "KKF देय" }]
          : []),
      ];

      // 9. Post new journal entry
      const js = new JournalService(tx);
      const { journalEntryId } = await js.post({
        firmId,
        voucherType: "purchase",
        date: new Date(data.date),
        narration: `खरीद (संशोधित) — ${kisan.name} — ${existing.billNo}`,
        refType: "purchase",
        refId: id,
        createdById: userId,
        lines: journalLines,
      });

      // 10. Link new journalEntryId to purchase
      await tx.purchase.update({
        where: { id },
        data: { journalEntryId },
      });

      // 11. If khud: create new StockLots (mirrors create logic)
      if (existing.purchaseType === "khud") {
        for (const item of updatedPurchase.items) {
          const itemAmt = new Decimal(item.amount.toString());
          const itemFeeShare =
            totalFees.gt(0) && totalAmount.gt(0)
              ? totalFees.mul(itemAmt).div(totalAmount).toDecimalPlaces(2)
              : new Decimal(0);
          const effectiveAmt = itemAmt.plus(itemFeeShare);
          const netWtKg = new Decimal(item.netWeightKg.toString());
          const effectiveRate = netWtKg.gt(0)
            ? effectiveAmt.div(netWtKg).mul(100).toDecimalPlaces(2)
            : new Decimal(item.ratePerQtl.toString());

          await tx.stockLot.create({
            data: {
              firmId,
              purchaseId: id,
              kisanId: existing.kisanId,
              itemId: item.itemId,
              date: new Date(data.date),
              quantityBags: Number(item.quantityBags),
              totalWeightKg: Number(item.totalWeightKg),
              remainingBags: Number(item.quantityBags),
              remainingWeightKg: Number(item.totalWeightKg),
              ratePerQtl: effectiveRate.toNumber(),
              committeePaid: committeeAmt.gt(0),
            },
          });
        }
      }
    });

    return res.status(200).json({ message: "Updated" });
  }

  return res.status(405).end();
}
