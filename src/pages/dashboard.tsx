import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Layout } from "@/components/layout/Layout";
import { formatINR, formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  ShoppingCart, Store, ArrowDownLeft, ArrowUpRight,
  AlertTriangle, Wallet, TrendingUp, TrendingDown,
  Users, Clock, Plus, Receipt, Coins, ArrowRight, Landmark,
} from "lucide-react";

interface RecentVoucher {
  id: number; voucherNo: string; voucherType: string;
  narration: string | null; totalDebit: number; date: string;
  refType: string | null; refId: number | null;
  partyName: string | null; billNo: string | null; link: string | null;
}

interface OverdueBill {
  id: number; vyapari: string; grandTotal: number; dueDate: string | null;
}

interface BankBalance {
  id: number; name: string; balance: number;
}

interface DashboardData {
  firmName: string;
  todayDate: string;
  aavakCount: number; aavakBags: number; aavakAmount: number;
  bikriCount: number; bikriAmount: number;
  cashBalance: number;
  bankAccounts: BankBalance[];
  totalBankBalance: number;
  advancesTotal: number; advancesCount: number;
  monthAavak: number; monthBikri: number; monthKharcha: number;
  overdueCount: number; overdueBills: OverdueBill[];
  recentVouchers: RecentVoucher[];
}

const VOUCHER_COLOR: Record<string, string> = {
  purchase: "bg-green-100 text-green-700",
  sale: "bg-blue-100 text-blue-700",
  receipt: "bg-teal-100 text-teal-700",
  payment: "bg-red-100 text-red-700",
  expense: "bg-orange-100 text-orange-700",
  advance: "bg-purple-100 text-purple-700",
};
const VOUCHER_LABEL: Record<string, string> = {
  purchase: "Purchase (खरीद)",
  sale: "Sale (बिक्री)",
  receipt: "Receipt (जमा)",
  payment: "Payment (नामे)",
  expense: "Expense (खर्चा)",
  advance: "Advance (उछंती)",
};

export default function Dashboard({ data }: { data: DashboardData }) {
  const dateObj = new Date(data.todayDate);
  const dayName = dateObj.toLocaleDateString("en-IN", { weekday: "long" });
  const fullDate = dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const monthProfit = data.monthBikri - data.monthAavak - data.monthKharcha;

  return (
    <Layout title="Dashboard">
      <div className="space-y-5">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{data.firmName}</h1>
            <p className="text-sm text-gray-500">{dayName}, {fullDate}</p>
          </div>
          {/* Quick action buttons */}
          <div className="flex flex-wrap gap-2">
            <Link href="/kharid/new">
              <button className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
                <Plus size={13} /><ShoppingCart size={13} /> Purchase
              </button>
            </Link>
            <Link href="/bikri/new">
              <button className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
                <Plus size={13} /><Store size={13} /> Sale
              </button>
            </Link>
            <Link href="/jama-naame/jama">
              <button className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
                <ArrowDownLeft size={13} /> Receipt (जमा)
              </button>
            </Link>
            <Link href="/jama-naame/naame">
              <button className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
                <ArrowUpRight size={13} /> Payment (नामे)
              </button>
            </Link>
            <Link href="/kharcha/new">
              <button className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
                <Receipt size={13} /> Expense (खर्चा)
              </button>
            </Link>
          </div>
        </div>

        {/* ── 4 Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <ShoppingCart size={18} className="text-green-600" />
              </div>
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Today</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{data.aavakCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Purchase slips · {data.aavakBags.toFixed(0)} bags</p>
            <p className="text-sm font-semibold text-green-600 mt-1">{formatINR(data.aavakAmount)}</p>
            <Link href="/kharid" className="text-xs text-gray-400 hover:text-green-600 flex items-center gap-0.5 mt-2">
              Purchase Register <ArrowRight size={10} />
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Store size={18} className="text-blue-600" />
              </div>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Today</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{data.bikriCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Sale bills (बिल)</p>
            <p className="text-sm font-semibold text-blue-600 mt-1">{formatINR(data.bikriAmount)}</p>
            <Link href="/bikri" className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-0.5 mt-2">
              Sale Register <ArrowRight size={10} />
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Wallet size={18} className="text-amber-600" />
              </div>
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Now</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{formatINR(data.cashBalance)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Cash in Hand (नकद)</p>
            <p className="text-sm text-gray-400 mt-1">&nbsp;</p>
            <Link href="/roznamcha/cashbook" className="text-xs text-gray-400 hover:text-amber-600 flex items-center gap-0.5 mt-2">
              Cash Book <ArrowRight size={10} />
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Coins size={18} className="text-purple-600" />
              </div>
              <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">Pending</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{data.advancesCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Farmers with advance (उछंती)</p>
            <p className="text-sm font-semibold text-purple-600 mt-1">{formatINR(data.advancesTotal)}</p>
            <Link href="/uchanti" className="text-xs text-gray-400 hover:text-purple-600 flex items-center gap-0.5 mt-2">
              Advance Register <ArrowRight size={10} />
            </Link>
          </div>
        </div>

        {/* ── Bank Balances ── */}
        {data.bankAccounts.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <Landmark size={15} className="text-indigo-500" />
                Bank Balances (बैंक शेष)
              </h3>
              <span className="text-sm font-bold text-indigo-700">
                Total: {formatINR(data.totalBankBalance)}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {data.bankAccounts.map((bank) => (
                <div key={bank.id} className="bg-indigo-50 rounded-lg px-4 py-3 flex flex-col gap-1">
                  <p className="text-xs text-indigo-500 font-medium truncate">{bank.name}</p>
                  <p className={`text-base font-bold ${bank.balance >= 0 ? "text-indigo-700" : "text-red-600"}`}>
                    {formatINR(Math.abs(bank.balance))}
                  </p>
                  {bank.balance < 0 && (
                    <p className="text-xs text-red-500">Overdraft</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── This month + Overdue ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Monthly summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Clock size={14} className="text-gray-400" />
              This Month Summary
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-600">Total Purchase (खरीद)</span>
                </div>
                <span className="font-semibold text-green-600">{formatINR(data.monthAavak)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-sm text-gray-600">Total Sale (बिक्री)</span>
                </div>
                <span className="font-semibold text-blue-600">{formatINR(data.monthBikri)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                  <span className="text-sm text-gray-600">Total Expense (खर्चा)</span>
                </div>
                <span className="font-semibold text-orange-600">{formatINR(data.monthKharcha)}</span>
              </div>
              <div className="border-t pt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {monthProfit >= 0
                    ? <TrendingUp size={14} className="text-green-500" />
                    : <TrendingDown size={14} className="text-red-500" />}
                  <span className="text-sm font-medium text-gray-700">Est. Profit (लाभ)</span>
                </div>
                <span className={`font-bold text-base ${monthProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatINR(Math.abs(monthProfit))}
                </span>
              </div>
            </div>
          </div>

          {/* Overdue bills */}
          <div className="bg-white rounded-xl border border-gray-200 col-span-1 lg:col-span-2 overflow-hidden">
            <div className={`px-4 py-3 border-b flex items-center justify-between ${data.overdueCount > 0 ? "bg-red-50" : "bg-gray-50"}`}>
              <h3 className="font-semibold flex items-center gap-2 text-gray-700">
                <AlertTriangle size={14} className={data.overdueCount > 0 ? "text-red-500" : "text-gray-300"} />
                Overdue Payments (बकाया भुगतान)
                {data.overdueCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{data.overdueCount}</span>
                )}
              </h3>
              <Link href="/bikri" className="text-xs text-gray-400 hover:text-gray-600">View all</Link>
            </div>
            {data.overdueBills.length === 0 ? (
              <div className="py-10 text-center text-gray-400">
                <Users size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">All payments are on time</p>
              </div>
            ) : (
              <div className="divide-y">
                {data.overdueBills.map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-4 py-3 hover:bg-red-50 transition-colors">
                    <div>
                      <p className="font-medium text-sm text-gray-800">{b.vyapari}</p>
                      {b.dueDate && (
                        <p className="text-xs text-red-500">Due was: {formatDate(b.dueDate)}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">{formatINR(b.grandTotal)}</p>
                      <Link href={`/bikri/${b.id}`} className="text-xs text-gray-400 hover:underline">View →</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Recent transactions ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">Recent Transactions (हाल के लेनदेन)</h3>
            <Link href="/roznamcha" className="text-xs text-amber-600 hover:underline flex items-center gap-1">
              Daybook <ArrowRight size={11} />
            </Link>
          </div>
          {data.recentVouchers.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">
              No transactions today
            </div>
          ) : (
            <div className="divide-y">
              {data.recentVouchers.map((v) => {
                const display = v.partyName ?? v.narration ?? "—";
                const sub = v.billNo
                  ? `${v.billNo} · ${v.voucherNo}`
                  : v.narration && v.narration !== v.partyName
                    ? `${v.narration} · ${v.voucherNo}`
                    : v.voucherNo;
                const inner = (
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 ${VOUCHER_COLOR[v.voucherType] ?? "bg-gray-100 text-gray-600"}`}>
                        {VOUCHER_LABEL[v.voucherType] ?? v.voucherType}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{display}</p>
                        <p className="text-xs text-gray-400 font-mono truncate">{sub}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="font-semibold text-sm text-gray-800">{formatINR(v.totalDebit)}</p>
                      <p className="text-xs text-gray-400">{formatDate(v.date)}</p>
                    </div>
                  </>
                );
                return v.link ? (
                  <Link key={v.id} href={v.link} className="flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors">
                    {inner}
                  </Link>
                ) : (
                  <div key={v.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                    {inner}
                  </div>
                );
              })}
            </div>
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
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const todayStr = today.toISOString().slice(0, 10);

  const [purchases, sales, monthPurchases, monthSales, monthExpenses,
    advancesAgg, overdueBills] = await Promise.all([
    prisma.purchase.findMany({
      where: { firmId, date: { gte: today, lte: todayEnd }, cancelled: false },
      include: { items: { select: { quantityBags: true } } },
    }),
    prisma.sale.findMany({
      where: { firmId, date: { gte: today, lte: todayEnd }, cancelled: false },
      select: { grandTotal: true },
    }),
    prisma.purchase.aggregate({
      where: { firmId, date: { gte: monthStart }, cancelled: false },
      _sum: { totalAmount: true },
    }),
    prisma.sale.aggregate({
      where: { firmId, date: { gte: monthStart }, cancelled: false },
      _sum: { grandTotal: true },
    }),
    prisma.expense.aggregate({
      where: { firmId, date: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.advance.aggregate({
      where: { firmId, status: { in: ["open", "partial"] } },
      _sum: { amount: true }, _count: true,
    }),
    prisma.sale.findMany({
      where: { firmId, cancelled: false, paymentDueDate: { lt: today } },
      include: { vyapari: { select: { name: true } } },
      orderBy: { paymentDueDate: "asc" },
      take: 5,
    }),
  ]);

  // Enriched recent vouchers — JOIN to get party name + bill number
  type RichRow = {
    id: bigint; voucher_no: string; voucher_type: string;
    narration: string | null; total_debit: string;
    date: Date; ref_type: string | null; ref_id: bigint | null;
    bill_no: string | null; party_name: string | null;
  };
  const richRows = await prisma.$queryRaw<RichRow[]>`
    SELECT
      je.id, je.voucher_no, je.voucher_type, je.narration,
      je.total_debit, je.date, je.ref_type, je.ref_id,
      CASE
        WHEN je.ref_type = 'purchase' THEN p.bill_no
        WHEN je.ref_type = 'sale'     THEN s.bill_no
        ELSE NULL
      END AS bill_no,
      CASE
        WHEN je.ref_type = 'purchase'              THEN kisan.name
        WHEN je.ref_type = 'sale'                  THEN vyapari.name
        WHEN je.ref_type IN ('payment','receipt')  THEN COALESCE(pay_party.name, di.debit_acc_name)
        WHEN je.ref_type = 'advance'               THEN adv_kisan.name
        ELSE di.debit_acc_name
      END AS party_name
    FROM journal_entries je
    LEFT JOIN purchases p          ON je.ref_type = 'purchase'              AND p.id    = je.ref_id
    LEFT JOIN parties kisan        ON kisan.id    = p.kisan_id
    LEFT JOIN sales s              ON je.ref_type = 'sale'                  AND s.id    = je.ref_id
    LEFT JOIN parties vyapari      ON vyapari.id  = s.vyapari_id
    LEFT JOIN payments_receipts pr ON je.ref_type IN ('payment','receipt')  AND pr.id   = je.ref_id
    LEFT JOIN parties pay_party    ON pay_party.id = pr.party_id
    LEFT JOIN advances adv         ON je.ref_type = 'advance'               AND adv.id  = je.ref_id
    LEFT JOIN parties adv_kisan    ON adv_kisan.id = adv.kisan_id
    LEFT JOIN (
      SELECT jl2.journal_entry_id, MIN(a2.name) AS debit_acc_name
      FROM journal_lines jl2
      JOIN accounts a2 ON a2.id = jl2.account_id AND a2.firm_id = ${firmId}
      WHERE jl2.debit > 0
      GROUP BY jl2.journal_entry_id
    ) di ON di.journal_entry_id = je.id
    WHERE je.firm_id = ${firmId} AND je.cancelled = 0 AND je.date = ${todayStr}
    ORDER BY je.id DESC
    LIMIT 15
  `;

  // Cash balance via raw SQL (same pattern as cashbook)
  type BalRow = { balance: string };
  const [cashRows, bankRows] = await Promise.all([
    prisma.$queryRaw<BalRow[]>`
      SELECT COALESCE(SUM(jl.debit - jl.credit), 0) AS balance
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      JOIN accounts a ON a.id = jl.account_id
      WHERE a.firm_id = ${firmId} AND a.code = 'CASH001' AND je.cancelled = 0
    `,
    prisma.$queryRaw<Array<{ id: number; name: string; balance: string }>>`
      SELECT a.id, a.name,
             COALESCE(SUM(jl.debit - jl.credit), 0) AS balance
      FROM accounts a
      LEFT JOIN journal_lines jl ON jl.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.cancelled = 0
      WHERE a.firm_id = ${firmId} AND a.sub_type = 'bank' AND a.active = 1
      GROUP BY a.id, a.name
      ORDER BY a.name ASC
    `,
  ]);

  const cashBalance = Number(cashRows[0]?.balance ?? 0);
  const bankAccounts = bankRows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    balance: Number(r.balance),
  }));
  const totalBankBalance = bankAccounts.reduce((s, b) => s + b.balance, 0);

  return {
    props: {
      data: {
        firmName: session.user.firmName,
        todayDate: today.toISOString(),
        aavakCount: purchases.length,
        aavakBags: purchases.reduce((s, p) => s + p.items.reduce((si, i) => si + Number(i.quantityBags), 0), 0),
        aavakAmount: purchases.reduce((s, p) => s + Number(p.totalAmount), 0),
        bikriCount: sales.length,
        bikriAmount: sales.reduce((s, sale) => s + Number(sale.grandTotal), 0),
        cashBalance,
        bankAccounts,
        totalBankBalance,
        advancesTotal: Number(advancesAgg._sum?.amount ?? 0),
        advancesCount: advancesAgg._count,
        monthAavak: Number(monthPurchases._sum?.totalAmount ?? 0),
        monthBikri: Number(monthSales._sum?.grandTotal ?? 0),
        monthKharcha: Number(monthExpenses._sum?.amount ?? 0),
        overdueCount: overdueBills.length,
        overdueBills: overdueBills.map((s) => ({
          id: s.id, vyapari: s.vyapari.name,
          grandTotal: Number(s.grandTotal),
          dueDate: s.paymentDueDate?.toISOString() ?? null,
        })),
        recentVouchers: richRows.map((r) => {
          const refType = r.ref_type ?? null;
          const refId = r.ref_id ? Number(r.ref_id) : null;
          let link: string | null = null;
          if (refType === "purchase" && refId) link = `/kharid/${refId}`;
          else if (refType === "sale" && refId) link = `/bikri/${refId}`;
          else if (refType === "payment" || refType === "receipt") link = "/jama-naame";
          else if (refType === "advance") link = "/uchanti";
          else if (refType === "expense") link = "/kharcha";
          else if (refType === "hammali_payment") link = "/hammali";
          else if (refType === "dues_payment") link = "/sarkar-dues";
          return {
            id: Number(r.id),
            voucherNo: r.voucher_no,
            voucherType: r.voucher_type,
            narration: r.narration,
            totalDebit: Number(r.total_debit),
            date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
            refType,
            refId,
            partyName: r.party_name ?? null,
            billNo: r.bill_no ?? null,
            link,
          };
        }),
      } as DashboardData,
    },
  };
};
