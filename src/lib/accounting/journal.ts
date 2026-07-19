/**
 * JournalService — sole code path that writes to journal_entries/journal_lines.
 * Enforces SUM(debit) === SUM(credit) and auto-generates voucher numbers.
 */
import { PrismaClient, VoucherType } from "@prisma/client";
import Decimal from "decimal.js";

export interface JournalLine {
  accountId: number;
  debit?: Decimal | number;
  credit?: Decimal | number;
  narration?: string;
}

export interface CreateJournalInput {
  firmId: number;
  voucherType: VoucherType;
  date: Date;
  narration?: string;
  refType?: string;
  refId?: number;
  createdById: number;
  lines: JournalLine[];
}

export interface JournalResult {
  journalEntryId: number;
  voucherNo: string;
}

// Prefix map per voucher type
const VOUCHER_PREFIX: Record<VoucherType, string> = {
  purchase: "KH",
  sale: "BK",
  receipt: "JM",
  payment: "NM",
  contra: "CT",
  journal: "JV",
  advance: "UC",
  expense: "KR",
};

export class JournalService {
  constructor(private tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) {}

  async post(input: CreateJournalInput): Promise<JournalResult> {
    const { firmId, voucherType, date, narration, refType, refId, createdById, lines } = input;

    // ── 1. Validate balanced entry ─────────────────────────────────────────
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const line of lines) {
      const dr = new Decimal(line.debit?.toString() ?? 0);
      const cr = new Decimal(line.credit?.toString() ?? 0);
      if (dr.gt(0) && cr.gt(0)) {
        throw new Error(`Journal line for account ${line.accountId} has both debit and credit — only one side allowed per line.`);
      }
      totalDebit = totalDebit.add(dr);
      totalCredit = totalCredit.add(cr);
    }

    if (!totalDebit.eq(totalCredit)) {
      throw new Error(
        `Unbalanced journal: Debit ₹${totalDebit.toFixed(2)} ≠ Credit ₹${totalCredit.toFixed(2)}`
      );
    }

    if (totalDebit.eq(0)) {
      throw new Error("Journal entry has zero amount.");
    }

    // ── 2. Generate voucher number ─────────────────────────────────────────
    const prefix = VOUCHER_PREFIX[voucherType];
    const fy = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;

    const lastEntry = await this.tx.journalEntry.findFirst({
      where: { firmId, voucherType },
      orderBy: { id: "desc" },
      select: { voucherNo: true },
    });

    let seq = 1;
    if (lastEntry?.voucherNo) {
      const parts = lastEntry.voucherNo.split("-");
      const lastSeq = parseInt(parts[parts.length - 1] ?? "0", 10);
      seq = lastSeq + 1;
    }

    const voucherNo = `${prefix}-${fy}-${String(seq).padStart(4, "0")}`;

    // ── 3. Insert journal_entry ────────────────────────────────────────────
    const entry = await this.tx.journalEntry.create({
      data: {
        firmId,
        voucherType,
        voucherNo,
        date,
        narration,
        refType,
        refId,
        totalDebit: totalDebit.toDecimalPlaces(2).toNumber(),
        totalCredit: totalCredit.toDecimalPlaces(2).toNumber(),
        createdById,
        lines: {
          create: lines.map((l) => ({
            accountId: l.accountId,
            debit: new Decimal(l.debit?.toString() ?? 0).toDecimalPlaces(2).toNumber(),
            credit: new Decimal(l.credit?.toString() ?? 0).toDecimalPlaces(2).toNumber(),
            narration: l.narration,
          })),
        },
      },
    });

    return { journalEntryId: entry.id, voucherNo };
  }

  async reverse(journalEntryId: number, reason: string, createdById: number): Promise<JournalResult> {
    const original = await this.tx.journalEntry.findUniqueOrThrow({
      where: { id: journalEntryId },
      include: { lines: true },
    });

    if (original.cancelled) {
      throw new Error("Journal entry is already cancelled.");
    }

    // Swap debit/credit on each line
    const reversedLines: JournalLine[] = original.lines.map((l) => ({
      accountId: l.accountId,
      debit: new Decimal(l.credit.toString()),
      credit: new Decimal(l.debit.toString()),
      narration: `Reversal: ${l.narration ?? ""}`,
    }));

    const result = await this.post({
      firmId: original.firmId,
      voucherType: original.voucherType,
      date: new Date(),
      narration: `Reversal of ${original.voucherNo} — ${reason}`,
      refType: "reversal",
      refId: original.id,
      createdById,
      lines: reversedLines,
    });

    // Mark original as cancelled
    await this.tx.journalEntry.update({
      where: { id: journalEntryId },
      data: { cancelled: true, cancelReason: reason },
    });

    // Mark the reversal entry as cancelled too — it is an internal accounting
    // artifact, not a real transaction. Excluding both the original and its
    // reversal from reports keeps gross Dr/Cr totals clean; only the new
    // corrected entry (created by the caller after reverse()) is active.
    await this.tx.journalEntry.update({
      where: { id: result.journalEntryId },
      data: { cancelled: true, cancelReason: `Auto-reversal of ${journalEntryId}` },
    });

    return result;
  }
}
