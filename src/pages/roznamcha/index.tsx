import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Layout } from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { formatINR, formatDate, todayISO } from "@/lib/utils";
import Link from "next/link";
import { FileText, BookOpen, ChevronRight } from "lucide-react";

interface VoucherRow {
  id: number; voucherNo: string; voucherType: string;
  date: string; narration: string | null;
  totalDebit: number; totalCredit: number;
  refType: string | null; refId: number | null;
  partyName: string | null; billNo: string | null; link: string | null;
}

const VOUCHER_LABELS: Record<string, string> = {
  purchase: "Purchase (खरीद)", sale: "Sale (बिक्री)", receipt: "Receipt (जमा)",
  payment: "Payment (नामे)", contra: "Contra", journal: "Journal",
  advance: "Advance (उछंती)", expense: "Expense (खर्चा)",
};

const VOUCHER_COLORS: Record<string, string> = {
  purchase: "bg-green-100 text-green-700",
  sale: "bg-blue-100 text-blue-700",
  receipt: "bg-teal-100 text-teal-700",
  payment: "bg-red-100 text-red-700",
  expense: "bg-orange-100 text-orange-700",
  advance: "bg-purple-100 text-purple-700",
};

function buildLink(refType: string | null, refId: number | null): string | null {
  if (!refType) return null;
  if (refType === "purchase" && refId) return `/kharid/${refId}`;
  if (refType === "sale" && refId) return `/bikri/${refId}`;
  if (refType === "payment" || refType === "receipt" || refType === "contra") return "/jama-naame";
  if (refType === "advance") return "/uchanti";
  if (refType === "expense") return "/kharcha";
  if (refType === "hammali_payment") return "/hammali";
  if (refType === "dues_payment") return "/sarkar-dues";
  return null;
}

export default function RoznamchaPage({ vouchers, date: initDate }: { vouchers: VoucherRow[]; date: string }) {
  const [date, setDate] = useState(initDate);

  function fetchDay(d: string) {
    setDate(d);
    window.location.href = `/roznamcha?date=${d}`;
  }

  const totalDebit = vouchers.reduce((s, v) => s + v.totalDebit, 0);
  const totalCredit = vouchers.reduce((s, v) => s + v.totalCredit, 0);

  return (
    <Layout title="Daybook (रोजनामचा)">
      <div className="space-y-4">
        {/* Date picker */}
        <div className="flex items-center justify-between gap-3 bg-white rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <FileText size={18} className="text-amber-600" />
            <span className="font-medium text-gray-700">Date:</span>
            <Input
              type="date"
              value={date}
              onChange={(e) => fetchDay(e.target.value)}
              className="w-40 h-9"
            />
            <span className="text-sm text-gray-500">{vouchers.length} transactions</span>
          </div>
          <Link href="/roznamcha/cashbook" className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
            <BookOpen size={14} /> Cash Book (नकद बही)
          </Link>
        </div>

        {/* Voucher list */}
        <div className="bg-white rounded-lg border divide-y overflow-hidden">
          {vouchers.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p>No transactions on this day</p>
            </div>
          ) : (
            vouchers.map((v) => {
              const display = v.partyName ?? v.narration ?? "—";
              // For purchases/sales: show bill no + voucher no
              // For others: show narration (if extra context) + voucher no
              const sub = v.billNo
                ? `${v.billNo} · ${v.voucherNo}`
                : v.narration && v.narration !== v.partyName
                  ? `${v.narration} · ${v.voucherNo}`
                  : v.voucherNo;
              const amount = v.totalDebit > 0 ? v.totalDebit : v.totalCredit;

              const inner = (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 ${VOUCHER_COLORS[v.voucherType] ?? "bg-gray-100 text-gray-600"}`}>
                      {VOUCHER_LABELS[v.voucherType] ?? v.voucherType}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-800 truncate">{display}</p>
                      <p className="text-xs text-gray-400 font-mono truncate">{sub}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <div className="text-right">
                      <p className="font-semibold text-sm text-gray-800">{formatINR(amount)}</p>
                      <p className="text-xs text-gray-400">
                        {v.totalDebit > 0 ? "Dr" : "Cr"}
                      </p>
                    </div>
                    {v.link && <ChevronRight size={14} className="text-gray-300" />}
                  </div>
                </>
              );

              return v.link ? (
                <Link key={v.id} href={v.link} className="flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors group">
                  {inner}
                </Link>
              ) : (
                <div key={v.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  {inner}
                </div>
              );
            })
          )}
        </div>

        {/* Daily totals */}
        {vouchers.length > 0 && (
          <div className="bg-amber-50 rounded-lg border border-amber-200 p-4 grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <p className="text-gray-500">Total Payment (नामे) (Dr)</p>
              <p className="text-xl font-bold text-red-600">{formatINR(totalDebit)}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500">Total Receipt (जमा) (Cr)</p>
              <p className="text-xl font-bold text-green-600">{formatINR(totalCredit)}</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) return { redirect: { destination: "/auth/login", permanent: false } };
  const firmId = session.user.firmId;
  const date = (ctx.query.date as string) ?? todayISO();

  type RichRow = {
    id: bigint; voucher_no: string; voucher_type: string;
    narration: string | null; total_debit: string; total_credit: string;
    date: Date; ref_type: string | null; ref_id: bigint | null;
    bill_no: string | null; party_name: string | null;
  };

  const rows = await prisma.$queryRaw<RichRow[]>`
    SELECT
      je.id, je.voucher_no, je.voucher_type, je.narration,
      je.total_debit, je.total_credit, je.date, je.ref_type, je.ref_id,
      CASE
        WHEN je.ref_type = 'purchase' THEN p.bill_no
        WHEN je.ref_type = 'sale'     THEN s.bill_no
        ELSE NULL
      END AS bill_no,
      CASE
        WHEN je.ref_type = 'purchase'             THEN kisan.name
        WHEN je.ref_type = 'sale'                 THEN vyapari.name
        WHEN je.ref_type IN ('payment','receipt') THEN COALESCE(pay_party.name, di.debit_acc_name)
        WHEN je.ref_type = 'advance'              THEN adv_kisan.name
        ELSE di.debit_acc_name
      END AS party_name
    FROM journal_entries je
    LEFT JOIN purchases p          ON je.ref_type = 'purchase'             AND p.id     = je.ref_id
    LEFT JOIN parties kisan        ON kisan.id    = p.kisan_id
    LEFT JOIN sales s              ON je.ref_type = 'sale'                 AND s.id     = je.ref_id
    LEFT JOIN parties vyapari      ON vyapari.id  = s.vyapari_id
    LEFT JOIN payments_receipts pr ON je.ref_type IN ('payment','receipt') AND pr.id    = je.ref_id
    LEFT JOIN parties pay_party    ON pay_party.id = pr.party_id
    LEFT JOIN advances adv         ON je.ref_type = 'advance'              AND adv.id   = je.ref_id
    LEFT JOIN parties adv_kisan    ON adv_kisan.id = adv.kisan_id
    LEFT JOIN (
      SELECT jl2.journal_entry_id, MIN(a2.name) AS debit_acc_name
      FROM journal_lines jl2
      JOIN accounts a2 ON a2.id = jl2.account_id AND a2.firm_id = ${firmId}
      WHERE jl2.debit > 0
      GROUP BY jl2.journal_entry_id
    ) di ON di.journal_entry_id = je.id
    WHERE je.firm_id = ${firmId} AND je.cancelled = 0 AND je.date = ${date}
    ORDER BY je.id ASC
  `;

  return {
    props: {
      date,
      vouchers: rows.map((r) => {
        const refType = r.ref_type ?? null;
        const refId = r.ref_id ? Number(r.ref_id) : null;
        return {
          id: Number(r.id),
          voucherNo: r.voucher_no,
          voucherType: r.voucher_type,
          date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
          narration: r.narration,
          totalDebit: Number(r.total_debit),
          totalCredit: Number(r.total_credit),
          refType,
          refId,
          partyName: r.party_name ?? null,
          billNo: r.bill_no ?? null,
          link: buildLink(refType, refId),
        };
      }),
    },
  };
};
