import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, BookOpen, TrendingDown, TrendingUp, Landmark } from "lucide-react";

interface EntryRow {
  id: number;
  date: string;
  voucherType: string;
  voucherNo: string;
  narration: string;
  debit: number;
  credit: number;
}

interface AccountLedgerProps {
  account: {
    id: number;
    code: string;
    name: string;
    type: string;
    subType: string;
    isGovtDues: boolean;
    party: { id: number; name: string; type: string } | null;
  };
  from: string;
  to: string;
  openingDr: number;
  openingCr: number;
  entries: EntryRow[];
}

const VOUCHER_LABELS: Record<string, string> = {
  purchase: "खरीद",
  sale: "बिक्री",
  receipt: "जमा",
  payment: "नामे",
  contra: "Contra",
  journal: "Journal",
  advance: "उछंती",
  expense: "खर्चा",
};

export default function AccountLedgerPage(props: AccountLedgerProps) {
  const { account, entries } = props;
  const [from, setFrom] = useState(props.from);
  const [to, setTo] = useState(props.to);
  const [isGovtDues, setIsGovtDues] = useState(account.isGovtDues);
  const [toggling, setToggling] = useState(false);

  async function toggleGovtDues() {
    setToggling(true);
    try {
      await fetch(`/api/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isGovtDues: !isGovtDues }),
      });
      setIsGovtDues((v) => !v);
    } finally {
      setToggling(false);
    }
  }

  function go() {
    window.location.href = `/accounts/${account.id}?from=${from}&to=${to}`;
  }

  // Opening balance as Dr balance (positive = Dr, negative = Cr)
  const openingNetDr = props.openingDr - props.openingCr;

  // Build rows with running balance
  let runningDr = openingNetDr;
  const rows = entries.map((e) => {
    runningDr += e.debit - e.credit;
    return { ...e, runningDr };
  });

  const closingDr = runningDr;
  const periodDebit = entries.reduce((s, e) => s + e.debit, 0);
  const periodCredit = entries.reduce((s, e) => s + e.credit, 0);

  function balLabel(netDr: number) {
    if (Math.abs(netDr) < 0.01) return <span className="text-gray-400">Nil</span>;
    if (netDr > 0) return <span className="text-blue-700 font-semibold">{formatINR(netDr)} Dr</span>;
    return <span className="text-green-700 font-semibold">{formatINR(Math.abs(netDr))} Cr</span>;
  }

  const displayName = account.party?.name ?? account.name;

  return (
    <Layout title={`${displayName} — Ledger`}>
      <div className="space-y-4">
        <Link href="/accounts" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={14} /> Chart of Accounts
        </Link>

        {/* Header */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BookOpen size={18} className="text-amber-700" />
                <h1 className="text-lg font-bold text-gray-800">{displayName}</h1>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono">{account.code}</span>
              </div>
              <p className="text-sm text-gray-500 capitalize">
                {account.type} — {account.subType.replace("_", " ")}
              </p>
              {/* Govt dues toggle — only for payable liabilities */}
              {account.type === "liability" && account.subType === "payable" && (
                <button
                  onClick={toggleGovtDues}
                  disabled={toggling}
                  className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                    isGovtDues
                      ? "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200"
                      : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                  }`}
                >
                  <Landmark size={11} />
                  {isGovtDues ? "Sarkar Dues ✓ (click to remove)" : "Sarkar Dues mein add karein"}
                </button>
              )}
            </div>

            {/* Date range picker */}
            <div className="flex items-center gap-2 flex-wrap">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36 h-8 text-sm" />
              <span className="text-gray-400 text-sm">to</span>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36 h-8 text-sm" />
              <Button variant="outline" size="sm" onClick={go} className="h-8">View</Button>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Opening Balance</p>
            <p className="font-bold text-sm">{balLabel(openingNetDr)}</p>
          </div>
          <div className="bg-white border rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Period Debit</p>
            <p className="font-bold text-sm text-blue-700">{formatINR(periodDebit)}</p>
          </div>
          <div className="bg-white border rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Period Credit</p>
            <p className="font-bold text-sm text-green-700">{formatINR(periodCredit)}</p>
          </div>
          <div className="bg-white border rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Closing Balance</p>
            <p className="font-bold text-sm">{balLabel(closingDr)}</p>
          </div>
        </div>

        {/* Ledger table */}
        <div className="bg-white rounded-lg border overflow-hidden">
          {rows.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <BookOpen size={36} className="mx-auto mb-3 opacity-30" />
              <p>No transactions in this period</p>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-amber-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 w-28">Date</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 w-28">Voucher</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Narration</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600 w-32">Debit (Dr)</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600 w-32">Credit (Cr)</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600 w-36">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {/* Opening balance row */}
                    <tr className="bg-blue-50/50">
                      <td className="px-4 py-2 text-gray-400 text-xs">{formatDate(from)}</td>
                      <td className="px-4 py-2 text-gray-400 text-xs" colSpan={2}>Opening Balance</td>
                      <td className="px-4 py-2 text-right">
                        {openingNetDr > 0 ? <span className="text-blue-700 font-medium">{formatINR(openingNetDr)}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {openingNetDr < 0 ? <span className="text-green-700 font-medium">{formatINR(Math.abs(openingNetDr))}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">{balLabel(openingNetDr)}</td>
                    </tr>

                    {rows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{formatDate(row.date)}</td>
                        <td className="px-4 py-2.5">
                          <div>
                            <span className="text-xs font-mono text-gray-600">{row.voucherNo}</span>
                            <p className="text-xs text-gray-400">{VOUCHER_LABELS[row.voucherType] ?? row.voucherType}</p>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs max-w-xs truncate">{row.narration || "—"}</td>
                        <td className="px-4 py-2.5 text-right">
                          {row.debit > 0 ? <span className="text-blue-700 font-medium">{formatINR(row.debit)}</span> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {row.credit > 0 ? <span className="text-green-700 font-medium">{formatINR(row.credit)}</span> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right">{balLabel(row.runningDr)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-gray-600">Closing Balance</td>
                      <td className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700">{formatINR(periodDebit)}</td>
                      <td className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700">{formatINR(periodCredit)}</td>
                      <td className="px-4 py-2.5 text-right font-bold">{balLabel(closingDr)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden">
                <div className="px-4 py-2 bg-blue-50 border-b flex justify-between text-xs text-gray-500">
                  <span>Opening Balance</span>
                  <span className="font-medium">{balLabel(openingNetDr)}</span>
                </div>
                <div className="divide-y">
                  {rows.map((row) => (
                    <div key={row.id} className="px-4 py-3">
                      <div className="flex justify-between mb-1">
                        <div>
                          <span className="text-xs font-mono text-gray-500">{row.voucherNo}</span>
                          <span className="ml-2 text-xs text-gray-400">{VOUCHER_LABELS[row.voucherType] ?? row.voucherType}</span>
                        </div>
                        <span className="text-xs text-gray-400">{formatDate(row.date)}</span>
                      </div>
                      {row.narration && <p className="text-xs text-gray-500 mb-1 truncate">{row.narration}</p>}
                      <div className="flex justify-between text-sm">
                        <div className="flex gap-3">
                          {row.debit > 0 && (
                            <span className="text-blue-700">Dr {formatINR(row.debit)}</span>
                          )}
                          {row.credit > 0 && (
                            <span className="text-green-700">Cr {formatINR(row.credit)}</span>
                          )}
                        </div>
                        <span className="font-medium">{balLabel(row.runningDr)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2.5 bg-gray-50 border-t flex justify-between text-sm">
                  <span className="font-semibold text-gray-600">Closing Balance</span>
                  <span className="font-bold">{balLabel(closingDr)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) return { redirect: { destination: "/auth/login", permanent: false } };
  const firmId = session.user.firmId;

  const accountId = parseInt(ctx.params?.id as string);
  if (isNaN(accountId)) return { notFound: true };

  const account = await prisma.account.findFirst({
    where: { id: accountId, firmId },
    include: { parties: { select: { id: true, name: true, type: true } } },
  });
  if (!account) return { notFound: true };

  // Read is_govt_dues via raw SQL (column added via ALTER TABLE)
  type GovtRow = { is_govt_dues: number };
  const govtRows = await prisma.$queryRaw<GovtRow[]>`
    SELECT is_govt_dues FROM accounts WHERE id = ${accountId} AND firm_id = ${firmId}
  `;

  const { from, to } = ctx.query;
  const today = new Date();
  const fromDate = from
    ? new Date(from as string)
    : new Date(today.getFullYear(), today.getMonth(), 1);
  const toDate = to ? new Date(to as string) : new Date(today);
  toDate.setHours(23, 59, 59, 999);

  type SumRow = { total_debit: string; total_credit: string };
  const [openingRows, entries] = await Promise.all([
    prisma.$queryRaw<SumRow[]>`
      SELECT COALESCE(SUM(jl.debit), 0)  AS total_debit,
             COALESCE(SUM(jl.credit), 0) AS total_credit
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE jl.account_id = ${accountId}
        AND je.firm_id = ${firmId}
        AND je.cancelled = 0
        AND je.date < ${fromDate}
    `,
    prisma.journalLine.findMany({
      where: {
        accountId,
        journalEntry: {
          firmId,
          cancelled: false,
          date: { gte: fromDate, lte: toDate },
        },
      },
      include: {
        journalEntry: {
          select: { date: true, voucherType: true, voucherNo: true, narration: true },
        },
      },
      orderBy: [{ journalEntry: { date: "asc" } }, { journalEntry: { id: "asc" } }],
    }),
  ]);

  return {
    props: {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        subType: account.subType,
        isGovtDues: Boolean(govtRows[0]?.is_govt_dues),
        party: account.parties[0] ?? null,
      },
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
      openingDr: Number(openingRows[0]?.total_debit ?? 0),
      openingCr: Number(openingRows[0]?.total_credit ?? 0),
      entries: entries.map((e) => ({
        id: e.id,
        date: e.journalEntry.date.toISOString().slice(0, 10),
        voucherType: e.journalEntry.voucherType,
        voucherNo: e.journalEntry.voucherNo,
        narration: e.narration ?? e.journalEntry.narration ?? "",
        debit: Number(e.debit),
        credit: Number(e.credit),
      })),
    },
  };
};
