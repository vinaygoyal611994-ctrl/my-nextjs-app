import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateSchema = z.object({
  bankName: z.string().min(1).max(150),
  accountNo: z.string().min(1).max(50),
  ifsc: z.string().max(20).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;

  if (req.method === "GET") {
    const banks = await prisma.bankAccount.findMany({
      where: { firmId, active: true },
      include: { account: { select: { id: true, code: true, name: true } } },
      orderBy: { id: "asc" },
    });
    return res.json(banks);
  }

  if (req.method === "POST") {
    if (session.user.role !== "malik") return res.status(403).json({ error: "Only owner can add bank accounts" });

    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { bankName, accountNo, ifsc } = parsed.data;

    // Generate unique account code
    const slug = bankName.replace(/\s+/g, "_").toUpperCase().slice(0, 8);
    const count = await prisma.bankAccount.count({ where: { firmId } });
    const code = `BANK_${slug}_${count + 1}`;

    const result = await prisma.$transaction(async (tx) => {
      // Create linked GL account
      const glAccount = await tx.account.create({
        data: {
          firmId,
          code,
          name: `Bank — ${bankName} (${accountNo.slice(-4)})`,
          type: "asset",
          subType: "bank",
          isSystem: false,
        },
      });

      // Create bank account record
      const bank = await tx.bankAccount.create({
        data: { firmId, bankName, accountNo, ifsc, accountId: glAccount.id },
      });

      return { ...bank, account: glAccount };
    });

    return res.status(201).json(result);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
