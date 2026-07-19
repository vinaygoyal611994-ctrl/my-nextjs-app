import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const firmId = session.user.firmId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  const [
    todayPurchases,
    todayPayments,
    cashAccount,
    committeePayable,
    advancesOutstanding,
    pendingSaudas,
    overdueRecipients,
  ] = await Promise.all([
    // Today's purchases
    prisma.purchase.findMany({
      where: { firmId, date: { gte: today, lte: todayEnd }, cancelled: false },
      include: { kisan: { select: { name: true } }, items: { include: { item: true } } },
    }),

    // Today's payments/receipts
    prisma.paymentReceipt.findMany({
      where: { firmId, date: { gte: today, lte: todayEnd }, cancelled: false },
    }),

    // Cash balance (sum journal lines for cash account)
    prisma.account.findFirst({
      where: { firmId, subType: "cash", isSystem: true },
      select: { id: true, name: true },
    }),

    // Committee payable
    prisma.account.findFirst({
      where: { firmId, name: { contains: "Mandi Shulk" } },
    }),

    // Open advances count + total
    prisma.advance.aggregate({
      where: { firmId, status: { in: ["open", "partial"] } },
      _sum: { amount: true },
      _count: true,
    }),

    // Pending saudas
    prisma.sauda.count({
      where: { firmId, status: { in: ["pending", "partial"] } },
    }),

    // Overdue sales (past due date)
    prisma.sale.findMany({
      where: {
        firmId,
        cancelled: false,
        paymentDueDate: { lt: today },
      },
      include: { vyapari: { select: { name: true } } },
      take: 10,
      orderBy: { paymentDueDate: "asc" },
    }),
  ]);

  const aavakTotal = todayPurchases.reduce(
    (sum, p) => sum + Number(p.totalAmount),
    0
  );
  const aavakBags = todayPurchases.reduce(
    (sum, p) => sum + p.items.reduce((s, i) => s + Number(i.quantityBags), 0),
    0
  );

  return res.status(200).json({
    aavak: {
      vouchers: todayPurchases.length,
      totalAmount: aavakTotal,
      totalBags: aavakBags,
    },
    cashAccountId: cashAccount?.id,
    advancesOutstanding: {
      count: advancesOutstanding._count,
      total: Number(advancesOutstanding._sum?.amount ?? 0),
    },
    pendingSaudas,
    overdueRecipients: overdueRecipients.map((s) => ({
      id: s.id,
      vyapari: s.vyapari.name,
      grandTotal: Number(s.grandTotal),
      dueDate: s.paymentDueDate,
    })),
    today: today.toISOString(),
  });
}
