import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  hindiName: z.string().optional(),
  defaultUnitWeightKg: z.number().positive().default(40),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;

  if (req.method === "GET") {
    const items = await prisma.item.findMany({
      where: { firmId, active: true },
      orderBy: { name: "asc" },
    });
    return res.status(200).json(items.map((i) => ({
      id: i.id,
      name: i.name,
      hindiName: i.hindiName,
      defaultUnitWeightKg: Number(i.defaultUnitWeightKg),
      purchaseAccountId: i.purchaseAccountId,
      salesAccountId: i.salesAccountId,
    })));
  }

  if (req.method === "POST") {
    if (session.user.role !== "malik") return res.status(403).json({ error: "Forbidden" });
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = parsed.data;

    const item = await prisma.$transaction(async (tx) => {
      // Auto-create purchase and sales accounts
      const lastAcc = await tx.account.findFirst({
        where: { firmId },
        orderBy: { id: "desc" },
        select: { id: true },
      });
      const baseId = (lastAcc?.id ?? 0) + 1;

      const purchaseAcc = await tx.account.create({
        data: {
          firmId,
          code: `PUR${baseId}`,
          name: `Purchase — ${data.name}`,
          type: "expense",
          subType: "direct_expense",
        },
      });
      const salesAcc = await tx.account.create({
        data: {
          firmId,
          code: `SAL${baseId + 1}`,
          name: `Sales — ${data.name}`,
          type: "income",
          subType: "income",
        },
      });

      return tx.item.create({
        data: {
          firmId,
          name: data.name,
          hindiName: data.hindiName,
          defaultUnitWeightKg: data.defaultUnitWeightKg,
          purchaseAccountId: purchaseAcc.id,
          salesAccountId: salesAcc.id,
        },
      });
    });

    return res.status(201).json(item);
  }

  return res.status(405).end();
}
