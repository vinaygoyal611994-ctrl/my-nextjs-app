import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;

  const partyId = parseInt(req.query.partyId as string, 10);
  const { dateFrom, dateTo } = req.query;

  const party = await prisma.party.findFirst({
    where: { id: partyId, firmId },
    include: { account: true },
  });
  if (!party) return res.status(404).json({ error: "Party not found" });

  if (!party.accountId) return res.status(200).json({ party, entries: [], balance: 0, balanceType: "Cr" });

  // Opening balance
  const ob = Number(party.openingBalance);
  const openingDr = party.openingType === "Dr" ? ob : 0;
  const openingCr = party.openingType === "Cr" ? ob : 0;

  // Journal lines for this account
  const whereDate: Record<string, unknown> = {};
  if (dateFrom) whereDate.gte = new Date(dateFrom as string);
  if (dateTo) whereDate.lte = new Date(dateTo as string);

  const journalLines = await prisma.journalLine.findMany({
    where: {
      accountId: party.accountId,
      journalEntry: {
        firmId,
        cancelled: false,
        ...(Object.keys(whereDate).length ? { date: whereDate } : {}),
      },
    },
    include: {
      journalEntry: {
        select: { date: true, voucherNo: true, voucherType: true, narration: true },
      },
    },
    orderBy: { journalEntry: { date: "asc" } },
  });

  // Build running balance
  let runningDr = openingDr;
  let runningCr = openingCr;

  const entries = journalLines.map((line) => {
    const dr = Number(line.debit);
    const cr = Number(line.credit);
    runningDr += dr;
    runningCr += cr;
    const net = runningDr - runningCr;
    return {
      date: line.journalEntry.date.toISOString(),
      voucherNo: line.journalEntry.voucherNo,
      voucherType: line.journalEntry.voucherType,
      narration: line.journalEntry.narration,
      naame: dr,
      jama: cr,
      baaki: Math.abs(net),
      baakiType: net >= 0 ? "Dr" : "Cr",
    };
  });

  const finalNet = runningDr - runningCr;

  return res.status(200).json({
    party: {
      id: party.id,
      name: party.name,
      type: party.type,
      village: party.village,
      mobile: party.mobile,
    },
    openingBalance: ob,
    openingType: party.openingType,
    entries,
    balance: Math.abs(finalNet),
    balanceType: finalNet >= 0 ? "Dr" : "Cr",
  });
}
