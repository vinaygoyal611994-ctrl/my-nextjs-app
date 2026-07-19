import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import Decimal from "decimal.js";
import { JournalService } from "@/lib/accounting/journal";
import { VoucherType } from "@prisma/client";
import { ensureInvoicePaymentsTable } from "./outstanding";

const schema = z.object({
  type: z.enum(["receipt", "payment", "contra"]),
  partyId: z.number().int().optional(),
  amount: z.number().positive("रकम जरूरी है"),
  mode: z.enum(["cash", "bank", "upi", "cheque"]),
  date: z.string(),
  chequeNo: z.string().optional(),
  chequeDate: z.string().optional(),
  bankAccountId: z.number().int().optional(),
  narration: z.string().optional(),
  allocations: z.array(z.object({
    refType: z.enum(["sale", "purchase"]),
    refId: z.number().int(),
    amount: z.number().positive(),
  })).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;
  const userId = session.user.id;

  if (req.method === "GET") {
    const { type, page = "1", partyId } = req.query;
    const pageNum = parseInt(page as string, 10);
    const where: Record<string, unknown> = { firmId, cancelled: false };
    if (type) where.voucherType = type;
    if (partyId) where.partyId = parseInt(partyId as string);

    const [payments, total] = await Promise.all([
      prisma.paymentReceipt.findMany({
        where,
        include: { party: { select: { name: true, type: true } } },
        orderBy: { date: "desc" },
        take: 50,
        skip: (pageNum - 1) * 50,
      }),
      prisma.paymentReceipt.count({ where }),
    ]);

    return res.status(200).json({
      payments: payments.map((p) => ({
        id: p.id,
        voucherNo: p.voucherNo,
        voucherType: p.voucherType,
        date: p.date.toISOString(),
        party: p.party?.name,
        partyType: p.party?.type,
        amount: Number(p.amount),
        mode: p.mode,
        narration: p.narration,
      })),
      total,
    });
  }

  if (req.method === "POST") {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = parsed.data;
    const amount = new Decimal(data.amount);

    const result = await prisma.$transaction(async (tx) => {
      // Sequence number
      const last = await tx.paymentReceipt.findFirst({
        where: { firmId, voucherType: data.type as VoucherType },
        orderBy: { id: "desc" },
        select: { voucherNo: true },
      });
      const lastSeq = last ? parseInt(last.voucherNo.split("-").pop() ?? "0") : 0;
      const year = new Date(data.date).getFullYear();
      const prefix = data.type === "receipt" ? "JM" : data.type === "payment" ? "NM" : "CT";
      const voucherNo = `${prefix}-${year}-${String(lastSeq + 1).padStart(4, "0")}`;

      // Resolve cash GL (always needed)
      const cashAcc = await tx.account.findFirstOrThrow({ where: { firmId, subType: "cash", isSystem: true } });
      const cashGlId = cashAcc.id;

      // Resolve bank GL (from bankAccountId or fallback to first bank)
      let bankGlId = cashGlId;
      const bankRow = data.bankAccountId
        ? await tx.bankAccount.findFirst({ where: { id: data.bankAccountId, firmId, active: true }, include: { account: true } })
        : await tx.bankAccount.findFirst({ where: { firmId, active: true }, include: { account: true } });
      if (bankRow?.account?.id) bankGlId = bankRow.account.id;

      const cashOrBankGlId = data.mode === "cash" ? cashGlId : bankGlId;

      let debitAccountId: number;
      let creditAccountId: number;

      if (data.type === "receipt") {
        // Cash/Bank Dr, Party Cr
        const partyAcc = await tx.party.findFirst({ where: { id: data.partyId }, include: { account: true } });
        debitAccountId = cashOrBankGlId;
        creditAccountId = partyAcc!.account!.id;
      } else if (data.type === "payment") {
        // Party Dr, Cash/Bank Cr
        const partyAcc = await tx.party.findFirst({ where: { id: data.partyId }, include: { account: true } });
        debitAccountId = partyAcc!.account!.id;
        creditAccountId = cashOrBankGlId;
      } else {
        // Contra: transfer between cash and bank — needs two distinct accounts
        if (data.mode === "cash") {
          // Bank → Cash (withdrawal): Cash Dr, Bank Cr
          debitAccountId = cashGlId;
          creditAccountId = bankGlId;
        } else {
          // Cash → Bank (deposit): Bank Dr, Cash Cr
          debitAccountId = bankGlId;
          creditAccountId = cashGlId;
        }
      }

      const pr = await tx.paymentReceipt.create({
        data: {
          firmId,
          voucherType: data.type as VoucherType,
          voucherNo,
          date: new Date(data.date),
          partyId: data.partyId,
          amount: amount.toDecimalPlaces(2).toNumber(),
          mode: data.mode,
          chequeNo: data.chequeNo,
          chequeDate: data.chequeDate ? new Date(data.chequeDate) : undefined,
          chequeStatus: data.mode === "cheque" ? "pending" : undefined,
          bankAccountId: data.bankAccountId,
          narration: data.narration,
          createdById: userId,
        },
      });

      const js = new JournalService(tx);
      const { journalEntryId } = await js.post({
        firmId,
        voucherType: data.type as VoucherType,
        date: new Date(data.date),
        narration: data.narration ?? `${data.type} — ${voucherNo}`,
        refType: data.type,
        refId: pr.id,
        createdById: userId,
        lines: [
          { accountId: debitAccountId, debit: amount },
          { accountId: creditAccountId, credit: amount },
        ],
      });

      await tx.paymentReceipt.update({
        where: { id: pr.id },
        data: { journalEntryId },
      });

      // Store invoice-wise allocations if provided
      if (data.allocations?.length) {
        await ensureInvoicePaymentsTable();
        for (const alloc of data.allocations) {
          await tx.$executeRaw`
            INSERT INTO invoice_payments (firm_id, payment_receipt_id, ref_type, ref_id, amount)
            VALUES (${firmId}, ${pr.id}, ${alloc.refType}, ${alloc.refId}, ${alloc.amount})
          `;
        }
      }

      return { id: pr.id, voucherNo };
    });

    return res.status(201).json(result);
  }

  return res.status(405).end();
}
