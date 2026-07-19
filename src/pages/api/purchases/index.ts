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
  katautiPct: z.number().min(0).default(0),
  katautiKg: z.number().min(0).default(0),
  netWeightKg: z.number().positive(),
});

const purchaseSchema = z.object({
  kisanId: z.number().int(),
  purchaseType: z.enum(["aadhat", "khud"]),
  date: z.string(), // ISO date string
  billNo: z.string().max(50).optional(),
  wagesAmount: z.number().min(0).default(0),
  advanceAdjusted: z.number().min(0).default(0),
  byajAdjusted: z.number().min(0).default(0),
  committeePct: z.number().min(0).default(0),
  kkfPct: z.number().min(0).default(0),
  items: z.array(itemSchema).min(1, "कम से कम एक जिन्स जोड़ें"),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;
  const userId = session.user.id;

  if (req.method === "GET") {
    const { page = "1", kisanId, dateFrom, dateTo } = req.query;
    const pageNum = parseInt(page as string, 10);
    const take = 30;

    const where: Record<string, unknown> = { firmId, cancelled: false };
    if (kisanId) where.kisanId = parseInt(kisanId as string);
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) (where.date as Record<string, unknown>).gte = new Date(dateFrom as string);
      if (dateTo) (where.date as Record<string, unknown>).lte = new Date(dateTo as string);
    }

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        include: {
          kisan: { select: { name: true, village: true } },
          items: { include: { item: { select: { name: true } } } },
        },
        orderBy: { date: "desc" },
        take,
        skip: (pageNum - 1) * take,
      }),
      prisma.purchase.count({ where }),
    ]);

    return res.status(200).json({
      purchases: purchases.map((p) => ({
        id: p.id,
        billNo: p.billNo,
        date: p.date.toISOString(),
        kisan: p.kisan.name,
        village: p.kisan.village,
        totalAmount: Number(p.totalAmount),
        netPayable: Number(p.netPayable),
        purchaseType: p.purchaseType,
        itemCount: p.items.length,
      })),
      total,
      page: pageNum,
    });
  }

  if (req.method === "POST") {
    const parsed = purchaseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = parsed.data;

    // Server-side recalculation
    const totalAmount = data.items.reduce((sum, i) => sum.add(new Decimal(i.amount)), new Decimal(0));
    const wages = new Decimal(data.wagesAmount);
    const advAdj = new Decimal(data.advanceAdjusted);
    const byajAdj = new Decimal(data.byajAdjusted);
    const netPayable = totalAmount.sub(wages).sub(advAdj).sub(byajAdj);

    // Committee & KKF only apply to khud purchases
    const committeePct = data.purchaseType === "khud" ? new Decimal(data.committeePct) : new Decimal(0);
    const kkfPct = data.purchaseType === "khud" ? new Decimal(data.kkfPct) : new Decimal(0);
    const committeeAmt = totalAmount.mul(committeePct).div(100).toDecimalPlaces(2);
    const kkfAmt = totalAmount.mul(kkfPct).div(100).toDecimalPlaces(2);

    if (netPayable.lt(0)) {
      return res.status(400).json({ error: "कटौती कुल रकम से अधिक नहीं हो सकती" });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Bill number sequence
      const lastPurchase = await tx.purchase.findFirst({
        where: { firmId },
        orderBy: { id: "desc" },
        select: { billNo: true },
      });
      const lastSeq = lastPurchase ? parseInt(lastPurchase.billNo.split("-").pop() ?? "0") : 0;
      const year = new Date(data.date).getFullYear();
      const billNo = data.billNo?.trim() || `KH-${year}-${String(lastSeq + 1).padStart(4, "0")}`;

      // Fetch kisan account
      const kisan = await tx.party.findUniqueOrThrow({
        where: { id: data.kisanId },
        include: { account: true },
      });

      // Hammali account (getOrCreate)
      let hammaliAccount = await tx.account.findFirst({ where: { firmId, code: "HAM001" } });
      if (!hammaliAccount) {
        hammaliAccount = await tx.account.findFirst({ where: { firmId, name: { contains: "Hammali" } } });
      }
      if (!hammaliAccount && wages.gt(0)) {
        hammaliAccount = await tx.account.create({
          data: {
            firmId, code: "HAM001",
            name: "Hammali / Labour (हम्माली)",
            type: "liability", subType: "payable", isSystem: true,
          },
        });
      }

      // Committee account (getOrCreate) — only needed for khud
      let committeeAccount = null;
      if (committeeAmt.gt(0)) {
        committeeAccount = await tx.account.findFirst({ where: { firmId, code: "MSHK001" } });
        if (!committeeAccount) {
          committeeAccount = await tx.account.create({
            data: {
              firmId, code: "MSHK001",
              name: "Mandi Shulk Payable",
              type: "liability", subType: "payable", isSystem: true,
            },
          });
        }
      }

      // KKF account (getOrCreate) — only needed for khud
      let kkfAccount = null;
      if (kkfAmt.gt(0)) {
        kkfAccount = await tx.account.findFirst({ where: { firmId, code: "KKFP001" } });
        if (!kkfAccount) {
          kkfAccount = await tx.account.create({
            data: {
              firmId, code: "KKFP001",
              name: "KK Fees Payable",
              type: "liability", subType: "payable", isSystem: true,
            },
          });
        }
      }

      // Build items with their purchase accounts
      const itemsWithAccounts = await Promise.all(
        data.items.map(async (item) => {
          const itemRecord = await tx.item.findUniqueOrThrow({
            where: { id: item.itemId },
            include: { purchaseAccount: true },
          });
          return { ...item, purchaseAccountId: itemRecord.purchaseAccountId };
        })
      );

      // Create purchase record
      const purchase = await tx.purchase.create({
        data: {
          firmId,
          kisanId: data.kisanId,
          purchaseType: data.purchaseType,
          billNo,
          date: new Date(data.date),
          totalAmount: totalAmount.toDecimalPlaces(2).toNumber(),
          wagesAmount: wages.toDecimalPlaces(2).toNumber(),
          advanceAdjusted: advAdj.toDecimalPlaces(2).toNumber(),
          byajAdjusted: byajAdj.toDecimalPlaces(2).toNumber(),
          netPayable: netPayable.toDecimalPlaces(2).toNumber(),
          createdById: userId,
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

      // Cr Kisan GL = totalAmount - wages
      const kisanCredit = totalAmount.sub(wages);

      // Total mandi fees for proportional distribution across items
      const totalFees = committeeAmt.plus(kkfAmt);

      // Journal lines — rounding-safe: last item absorbs remainder
      let allocatedFees = new Decimal(0);
      const drLines = itemsWithAccounts.map((item, idx) => {
        const itemAmt = new Decimal(item.amount);
        const isLast = idx === itemsWithAccounts.length - 1;
        const itemFeeShare = totalFees.gt(0) && totalAmount.gt(0)
          ? isLast
            ? totalFees.minus(allocatedFees)
            : totalFees.mul(itemAmt).div(totalAmount).toDecimalPlaces(2)
          : new Decimal(0);
        allocatedFees = allocatedFees.plus(itemFeeShare);
        return {
          accountId: item.purchaseAccountId!,
          debit: itemAmt.plus(itemFeeShare),
          narration: `खरीद ${billNo}`,
        };
      });

      // Journal lines
      const journalLines = [
        // Dr: Purchase accounts (line-wise by jins), including proportional share of committee+KKF for khud
        ...drLines,
        // Cr: Kisan GL (full produce amount minus wages)
        {
          accountId: kisan.account!.id,
          credit: kisanCredit,
          narration: `किसान देय ${kisan.name}`,
        },
        // Cr: Hammali Payable
        ...(wages.gt(0) && hammaliAccount
          ? [{ accountId: hammaliAccount.id, credit: wages, narration: "हम्माली देय" }]
          : []),
        // Cr: Committee Payable (khud only)
        ...(committeeAmt.gt(0) && committeeAccount
          ? [{ accountId: committeeAccount.id, credit: committeeAmt, narration: "मंडी शुल्क देय" }]
          : []),
        // Cr: KKF Payable (khud only)
        ...(kkfAmt.gt(0) && kkfAccount
          ? [{ accountId: kkfAccount.id, credit: kkfAmt, narration: "KKF देय" }]
          : []),
      ];

      const js = new JournalService(tx);
      const { journalEntryId } = await js.post({
        firmId,
        voucherType: "purchase",
        date: new Date(data.date),
        narration: `खरीद — ${kisan.name} — ${billNo}`,
        refType: "purchase",
        refId: purchase.id,
        createdById: userId,
        lines: journalLines,
      });

      await tx.purchase.update({
        where: { id: purchase.id },
        data: { journalEntryId },
      });

      // For khud kharid: create stock lot per item line with effective rate including fees
      if (data.purchaseType === "khud") {
        for (const item of purchase.items) {
          const itemAmt = new Decimal(item.amount.toString());
          const itemFeeShare = totalFees.gt(0) && totalAmount.gt(0)
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
              purchaseId: purchase.id,
              kisanId: data.kisanId,
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

      return { purchaseId: purchase.id, billNo };
    });

    return res.status(201).json(result);
  }

  return res.status(405).end();
}
