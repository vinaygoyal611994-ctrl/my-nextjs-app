import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { AccountSubType, AccountType } from "@prisma/client";

const createSchema = z.object({
  name: z.string().min(1, "नाम जरूरी है"),
  type: z.enum(["kisan", "vyapari", "transporter", "palledar", "other", "staff"]),
  village: z.string().optional(),
  mobile: z.string().optional(),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  paymentTermDays: z.number().int().default(0),
  openingBalance: z.number().default(0),
  openingType: z.enum(["Dr", "Cr"]).default("Cr"),
  byajRateOverride: z.number().optional(),
  monthlySalary: z.number().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;

  if (req.method === "GET") {
    const { type, village, search, page = "1" } = req.query;
    const pageNum = parseInt(page as string, 10);
    const take = 50;
    const skip = (pageNum - 1) * take;

    const where: Record<string, unknown> = { firmId, active: true };
    if (type) where.type = type;
    if (village) where.village = { contains: village };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { village: { contains: search } },
        { mobile: { contains: search } },
      ];
    }

    const [parties, total] = await Promise.all([
      prisma.party.findMany({
        where,
        include: {
          account: {
            select: {
              id: true,
              journalLines: {
                select: { debit: true, credit: true },
              },
            },
          },
        },
        orderBy: { name: "asc" },
        take,
        skip,
      }),
      prisma.party.count({ where }),
    ]);

    // Compute balance for each party from journal lines
    const result = parties.map((p) => {
      let balance = Number(p.openingBalance);
      let drTotal = 0;
      let crTotal = 0;
      if (p.account) {
        for (const line of p.account.journalLines) {
          drTotal += Number(line.debit);
          crTotal += Number(line.credit);
        }
      }
      // Opening: Cr means party owes us (lena); Dr means we owe them (dena)
      const openingDr = p.openingType === "Dr" ? balance : 0;
      const openingCr = p.openingType === "Cr" ? balance : 0;
      const netDr = openingDr + drTotal;
      const netCr = openingCr + crTotal;
      const net = netDr - netCr;
      return {
        id: p.id,
        name: p.name,
        type: p.type,
        village: p.village,
        mobile: p.mobile,
        active: p.active,
        balance: Math.abs(net),
        balanceType: net >= 0 ? "Dr" : "Cr",
      };
    });

    return res.status(200).json({ parties: result, total, page: pageNum });
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = parsed.data;

    // Map party type to account sub-type
    const subTypeMap: Record<string, AccountSubType> = {
      kisan: "payable",
      vyapari: "receivable",
      transporter: "payable",
      palledar: "payable",
      other: "other",
      staff: "payable",
    };

    const result = await prisma.$transaction(async (tx) => {
      // Auto-create ledger account — find highest existing P-series code
      const lastPartyAccount = await tx.account.findFirst({
        where: { firmId, code: { startsWith: "P" } },
        orderBy: { id: "desc" },
        select: { code: true },
      });
      const lastNum = lastPartyAccount
        ? parseInt(lastPartyAccount.code.replace(/\D/g, "") || "0", 10)
        : 0;
      const nextCode = `P${String(lastNum + 1).padStart(4, "0")}`;

      const account = await tx.account.create({
        data: {
          firmId,
          code: nextCode,
          name: data.name,
          type: data.type === "vyapari" ? AccountType.asset : AccountType.liability,
          // staff = liability (we owe them salary); vyapari = asset (they owe us)
          subType: subTypeMap[data.type],
          isSystem: false,
        },
      });

      const party = await tx.party.create({
        data: {
          firmId,
          name: data.name,
          type: data.type as import("@prisma/client").PartyType,
          village: data.village,
          mobile: data.mobile,
          gstin: data.gstin,
          pan: data.pan,
          paymentTermDays: data.paymentTermDays,
          openingBalance: data.openingBalance,
          openingType: data.openingType,
          byajRateOverride: data.byajRateOverride,
          monthlySalary: data.monthlySalary,
          accountId: account.id,
        },
      });

      return party;
    });

    return res.status(201).json(result);
  }

  return res.status(405).end();
}
