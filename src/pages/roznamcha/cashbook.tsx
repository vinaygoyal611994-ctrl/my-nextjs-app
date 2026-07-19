import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR, formatDate, todayISO } from "@/lib/utils";
import { Download } from "lucide-react";

interface CashEntry {
  id: number; date: string; voucherNo: string; narration: string | null;
  debit: number; credit: number;
}

export default function CashBookPage({
  entries, from: initFrom, to: initTo, openingBalance,
}: { entries: CashEntry[]; from: string; to: string; openingBalance: number }) {
  const [from, setFrom] = useState(initFrom);
  const [to, setTo] = useState(initTo);

  function go() { window.location.href = `/roznamcha/cashbook?from=${from}&to=${to}`; }

  // Running balance
  let running = openingBalance;
  const rows = entries.map((e) => {
    running = running + e.debit - e.credit;
    return { ...e, balance: running };
  });

  const totalDr = entries.reduce((s, e) => s + e.debit, 0);
  const totalCr = entries.reduce((s, e) => s + e.credit, 0);
  const closingBalance = openingBalance + totalDr - totalCr;

  async function exportExcel() {
    const res = await fetch(`/api/reports/cashbook-excel?from=${from}&to=${to}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cashbook_${from}_${to}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Layout title="Cash Book (नकद बही)">
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-white border rounded-lg p-3">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40 h-9" />
            <span className="text-gray-400 text-sm">to</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40 h-9" />
            <Button variant="outline" size="sm" onClick={go}>View</Button>
          </div>
          <Button variant="outline" className="gap-2" onClick={exportExcel}>
            <Download size={14} /> Excel
          </Button>
        </div>

        {/* Opening balance */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex justify-between text-sm">
          <span className="font-medium text-blue-700">Opening Balance</span>
          <span className="font-bold text-blue-700">{formatINR(openingBalance)}</span>
        </div>

        {/* Ledger table */}
        <div className="bg-white rounded-lg border overflow-hidden">
          {entries.length === 0 ? (
            <div className="py-12 text-center text-gray-400">No cash transactions in this period</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 text-gray-600">Voucher</th>
                    <th className="text-left px-4 py-3 text-gray-600">Description</th>
                    <th className="text-right px-4 py-3 text-gray-600">In (Dr)</th>
                    <th className="text-right px-4 py-3 text-gray-600">Out (Cr)</th>
                    <th className="text-right px-4 py-3 text-gray-600">Balance (बाकी)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{formatDate(r.date)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{r.voucherNo}</td>
                      <td className="px-4 py-2.5 text-gray-600">{r.narration ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-green-700">
                        {r.debit > 0 ? formatINR(r.debit) : ""}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-red-600">
                        {r.credit > 0 ? formatINR(r.credit) : ""}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-bold ${r.balance >= 0 ? "text-gray-800" : "text-red-600"}`}>
                        {formatINR(r.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 bg-amber-50">
                  <tr className="font-semibold">
                    <td colSpan={3} className="px-4 py-3 text-gray-600">Total</td>
                    <td className="px-4 py-3 text-right text-green-700">{formatINR(totalDr)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatINR(totalCr)}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatINR(closingBalance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Closing */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex justify-between">
          <span className="font-bold text-amber-800">Closing Balance</span>
          <span className="font-bold text-xl text-amber-800">{formatINR(closingBalance)}</span>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) return { redirect: { destination: "/auth/login", permanent: false } };
  const firmId = session.user.firmId;

  const today = todayISO();
  const from = (ctx.query.from as string) ?? today.slice(0, 7) + "-01";
  const to = (ctx.query.to as string) ?? today;

  const dayEnd = new Date(to); dayEnd.setHours(23, 59, 59, 999);
  const dayStart = new Date(from);

  // Get CASH001 account id
  const cashAcc = await prisma.account.findFirst({ where: { firmId, code: "CASH001" } });
  if (!cashAcc) return { props: { entries: [], from, to, openingBalance: 0 } };

  // Opening balance = all movements before `from`
  const openingAgg = await prisma.journalLine.aggregate({
    where: {
      accountId: cashAcc.id,
      journalEntry: { firmId, cancelled: false, date: { lt: dayStart } },
    },
    _sum: { debit: true, credit: true },
  });
  const openingBalance = Number(openingAgg._sum.debit ?? 0) - Number(openingAgg._sum.credit ?? 0);

  // Lines in range
  const lines = await prisma.journalLine.findMany({
    where: {
      accountId: cashAcc.id,
      journalEntry: { firmId, cancelled: false, date: { gte: dayStart, lte: dayEnd } },
    },
    include: { journalEntry: { select: { voucherNo: true, date: true, narration: true } } },
    orderBy: { journalEntry: { date: "asc" } },
  });

  return {
    props: {
      from, to,
      openingBalance,
      entries: lines.map((l) => ({
        id: l.id,
        date: l.journalEntry.date.toISOString(),
        voucherNo: l.journalEntry.voucherNo,
        narration: l.journalEntry.narration,
        debit: Number(l.debit),
        credit: Number(l.credit),
      })),
    },
  };
};
