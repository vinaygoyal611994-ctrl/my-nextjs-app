import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR, formatDate, todayISO } from "@/lib/utils";
import Link from "next/link";
import { Plus, Receipt, Search } from "lucide-react";

interface ExpenseRow {
  id: number; date: string; accountName: string;
  amount: number; mode: string; narration: string | null;
  bankName: string | null; bankAccountNo: string | null;
}

const MODE_LABEL: Record<string, string> = {
  cash: "Cash", bank: "Bank", upi: "UPI", cheque: "Cheque",
};

export default function KharchaPage({
  expenses, from: initFrom, to: initTo, total,
}: { expenses: ExpenseRow[]; from: string; to: string; total: number }) {
  const [from, setFrom] = useState(initFrom);
  const [to, setTo] = useState(initTo);
  const [search, setSearch] = useState("");

  function go() {
    window.location.href = `/kharcha?from=${from}&to=${to}`;
  }

  const shown = search
    ? expenses.filter((e) =>
        e.accountName.toLowerCase().includes(search.toLowerCase()) ||
        e.narration?.toLowerCase().includes(search.toLowerCase()) ||
        e.mode.toLowerCase().includes(search.toLowerCase())
      )
    : expenses;

  return (
    <Layout title="Expense Register (खर्चा रजिस्टर)">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-white rounded-lg border p-2.5 flex-wrap">
            <Receipt size={16} className="text-orange-600" />
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36 h-8 text-sm" />
            <span className="text-gray-400 text-sm">to</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36 h-8 text-sm" />
            <Button variant="outline" size="sm" onClick={go} className="h-8">View</Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search expense..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-48 h-9"
              />
            </div>
            <Link href="/kharcha/new">
              <Button className="gap-2 bg-orange-600 hover:bg-orange-700"><Plus size={16} /> New Expense</Button>
            </Link>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-lg border overflow-hidden">
          {shown.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Receipt size={40} className="mx-auto mb-3 opacity-30" />
              <p>No expenses in this period</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-orange-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Expense Account</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Description</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Mode</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount (रकम)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {shown.map((e) => (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500">{formatDate(e.date)}</td>
                        <td className="px-4 py-3 font-medium">{e.accountName}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{e.narration ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{MODE_LABEL[e.mode] ?? e.mode}</span>
                          {e.bankName && (
                            <p className="text-xs text-gray-400 mt-0.5">{e.bankName} …{e.bankAccountNo?.slice(-4)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">{formatINR(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y">
                {shown.map((e) => (
                  <div key={e.id} className="px-4 py-3">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium">{e.accountName}</span>
                      <span className="font-bold text-red-600">{formatINR(e.amount)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{formatDate(e.date)}</span>
                      <span>
                        {MODE_LABEL[e.mode] ?? e.mode}
                        {e.bankName && ` · ${e.bankName} …${e.bankAccountNo?.slice(-4)}`}
                      </span>
                    </div>
                    {e.narration && <p className="text-xs text-gray-400 mt-0.5">{e.narration}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Total */}
        {shown.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex justify-between items-center">
            <span className="font-medium text-gray-600">
              Total Expense (कुल खर्चा)
              {search && <span className="text-xs text-gray-400 ml-2">{shown.length} matching</span>}
            </span>
            <span className="text-xl font-bold text-red-600">{formatINR(shown.reduce((s, e) => s + e.amount, 0))}</span>
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

  const today = todayISO();
  const from = (ctx.query.from as string) ?? today.slice(0, 7) + "-01";
  const to = (ctx.query.to as string) ?? today;

  const dayEnd = new Date(to); dayEnd.setHours(23, 59, 59, 999);

  type RawRow = {
    id: number; date: Date; account_name: string;
    amount: string; mode: string; narration: string | null;
    bank_name: string | null; account_no: string | null;
  };

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT e.id, e.date, a.name AS account_name, e.amount, e.mode, e.narration,
           ba.bank_name, ba.account_no
    FROM expenses e
    JOIN accounts a ON a.id = e.account_id
    LEFT JOIN bank_accounts ba ON ba.id = e.bank_account_id
    WHERE e.firm_id = ${firmId}
      AND e.date >= ${new Date(from)}
      AND e.date <= ${dayEnd}
    ORDER BY e.date DESC
    LIMIT 200
  `;

  const expenses: ExpenseRow[] = rows.map((r) => ({
    id: Number(r.id),
    date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
    accountName: r.account_name,
    amount: Number(r.amount),
    mode: r.mode,
    narration: r.narration,
    bankName: r.bank_name,
    bankAccountNo: r.account_no,
  }));

  return {
    props: {
      from, to,
      expenses,
      total: expenses.reduce((s, r) => s + r.amount, 0),
    },
  };
};
