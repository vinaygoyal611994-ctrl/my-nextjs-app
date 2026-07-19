import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { GetServerSideProps } from "next";
import {
  Wheat,
  LogOut,
  User,
  MapPin,
  Phone,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Store,
  CreditCard,
  ChevronRight,
  Loader2,
  Tractor,
  Info,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ensurePortalTables } from "@/lib/portal-tables";
import { getSession, COOKIE_NAME } from "@/lib/portal-session";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Transaction {
  id: number;
  type: "purchase" | "sale";
  date: string;
  billNo: string | null;
  amount: number;
  itemsSummary: string | null;
}

interface Payment {
  id: number;
  date: string;
  amount: number;
  paymentMode: string;
  type: string;
  narration: string | null;
}

interface PartyInfo {
  id: number;
  name: string;
  type: string;
  village: string | null;
  mobile: string | null;
}

interface DashboardProps {
  sessionName: string;
  sessionMobile: string;
  party: PartyInfo | null;
  balance: number;
  balanceType: "Dr" | "Cr";
  transactions: Transaction[];
  payments: Payment[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: "Cash",
  bank: "Bank",
  upi: "UPI",
  cheque: "Cheque",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PortalDashboard({
  sessionName,
  sessionMobile,
  party,
  balance,
  balanceType,
  transactions,
  payments,
}: DashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"transactions" | "account">("transactions");
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/portal/auth/logout", { method: "POST" });
      router.push("/portal/login");
    } catch {
      router.push("/portal/login");
    }
  }

  const partyType = party?.type ?? "";
  const partyTypeLabel =
    partyType === "kisan"
      ? "किसान"
      : partyType === "vyapari"
      ? "व्यापारी"
      : partyType === "transporter"
      ? "Transporter"
      : partyType;

  const partyTypeBadgeColor =
    partyType === "kisan"
      ? "bg-green-100 text-green-700"
      : partyType === "vyapari"
      ? "bg-blue-100 text-blue-700"
      : "bg-gray-100 text-gray-700";

  return (
    <>
      <Head>
        <title>Dashboard — Digital Viyapar</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gray-50 font-sans">
        {/* ── Header ── */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
            {/* Brand */}
            <Link href="/digital-viyapar" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-green-600 flex items-center justify-center shadow">
                <Wheat size={16} className="text-white" />
              </div>
              <span className="text-base font-bold text-gray-900 hidden sm:block">
                Digital Viyapar
              </span>
            </Link>

            {/* User info + logout */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden xs:block">
                <p className="text-sm font-semibold text-gray-800 leading-tight">
                  नमस्ते, {sessionName}
                </p>
                {party && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${partyTypeBadgeColor}`}>
                    {partyTypeLabel}
                  </span>
                )}
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {loggingOut ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <LogOut size={15} />
                )}
                <span className="hidden sm:block">Logout</span>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">

          {/* ── Name + Badge (mobile) ── */}
          <div className="sm:hidden flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-gray-900">नमस्ते, {sessionName}</p>
              {party && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${partyTypeBadgeColor}`}>
                  {partyTypeLabel}
                </span>
              )}
            </div>
          </div>

          {/* ── Balance Card ── */}
          {party ? (
            <div
              className={`rounded-2xl p-6 text-white relative overflow-hidden shadow-lg ${
                balanceType === "Cr"
                  ? "bg-gradient-to-br from-green-500 to-green-600"
                  : "bg-gradient-to-br from-red-500 to-red-600"
              }`}
            >
              {/* Decorative blur */}
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />

              <div className="relative">
                <div className="flex items-center gap-2 mb-1">
                  {balanceType === "Cr" ? (
                    <TrendingUp size={18} className="text-green-200" />
                  ) : (
                    <TrendingDown size={18} className="text-red-200" />
                  )}
                  <p className="text-sm font-medium text-white/80">Outstanding Balance</p>
                </div>
                <p className="text-4xl font-bold tracking-tight mt-2">
                  {formatINR(balance)}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold px-3 py-1 rounded-full ${
                      balanceType === "Cr"
                        ? "bg-green-400/30 text-green-100"
                        : "bg-red-400/30 text-red-100"
                    }`}
                  >
                    {balanceType === "Cr" ? "✓ हमें देना है (Cr)" : "⚠ आप देंगे (Dr)"}
                  </span>
                </div>
                <p className="text-xs text-white/60 mt-2">
                  {balanceType === "Cr"
                    ? "आढ़तिया आपको यह amount देगा"
                    : "आपको आढ़तिया को यह amount देना है"}
                </p>
              </div>
            </div>
          ) : (
            /* No party linked */
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
              <Info size={22} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-amber-800 mb-1">Account linked नहीं है</h3>
                <p className="text-amber-700 text-sm">
                  आपका account अभी किसी party से linked नहीं है। अपने आढ़तिया से संपर्क करें और
                  वही mobile number use करके account बनाएं जो उनके पास registered है।
                </p>
              </div>
            </div>
          )}

          {/* ── Summary Row ── */}
          {party && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
                <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  {partyType === "kisan" ? (
                    <Tractor size={18} className="text-amber-600" />
                  ) : (
                    <ShoppingCart size={18} className="text-amber-600" />
                  )}
                </div>
                <p className="text-xl font-bold text-gray-900">{transactions.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {partyType === "kisan" ? "खरीद entries" : "Sale bills"}
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
                <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <CreditCard size={18} className="text-teal-600" />
                </div>
                <p className="text-xl font-bold text-gray-900">{payments.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">Payments</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
                <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Store size={18} className="text-purple-600" />
                </div>
                <p className="text-sm font-bold text-gray-900 leading-tight">
                  {formatINR(transactions.reduce((s, t) => s + t.amount, 0))}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Total Value</p>
              </div>
            </div>
          )}

          {/* ── Tabs ── */}
          {party && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Tab header */}
              <div className="flex border-b border-gray-100">
                <button
                  onClick={() => setActiveTab("transactions")}
                  className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                    activeTab === "transactions"
                      ? "text-amber-700 border-b-2 border-amber-500 bg-amber-50/50"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {partyType === "kisan" ? "खरीद (Purchases)" : "बिक्री (Sales)"}
                </button>
                <button
                  onClick={() => setActiveTab("account")}
                  className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                    activeTab === "account"
                      ? "text-amber-700 border-b-2 border-amber-500 bg-amber-50/50"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Account Info
                </button>
              </div>

              {/* Tab content */}
              {activeTab === "transactions" && (
                <div>
                  {transactions.length === 0 ? (
                    <div className="py-14 text-center text-gray-400">
                      <ShoppingCart size={36} className="mx-auto mb-3 opacity-20" />
                      <p className="text-sm">कोई transactions नहीं मिले</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {transactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/80 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                tx.type === "purchase"
                                  ? "bg-green-100"
                                  : "bg-blue-100"
                              }`}
                            >
                              {tx.type === "purchase" ? (
                                <Tractor size={16} className="text-green-600" />
                              ) : (
                                <Store size={16} className="text-blue-600" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {tx.billNo ? `Bill: ${tx.billNo}` : `#${tx.id}`}
                              </p>
                              {tx.itemsSummary && (
                                <p className="text-xs text-gray-400 truncate max-w-[180px]">
                                  {tx.itemsSummary}
                                </p>
                              )}
                              <p className="text-xs text-gray-400">{formatDate(tx.date)}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className="font-bold text-sm text-gray-900">
                              {formatINR(tx.amount)}
                            </p>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                tx.type === "purchase"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {tx.type === "purchase" ? "खरीद" : "बिक्री"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "account" && (
                <div className="p-5 space-y-4">
                  {/* Party details */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-bold text-gray-700 mb-3">Party Details</h3>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                        <User size={15} className="text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">नाम</p>
                        <p className="text-sm font-semibold text-gray-900">{party.name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Phone size={15} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Mobile</p>
                        <p className="text-sm font-semibold text-gray-900">{party.mobile ?? sessionMobile}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Info size={15} className="text-purple-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Type</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${partyTypeBadgeColor}`}>
                          {partyTypeLabel}
                        </span>
                      </div>
                    </div>

                    {party.village && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                          <MapPin size={15} className="text-green-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Village / City</p>
                          <p className="text-sm font-semibold text-gray-900">{party.village}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recent Payments */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <CreditCard size={15} className="text-teal-500" />
                      Recent Payments
                    </h3>
                    {payments.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl">
                        <CreditCard size={28} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm">कोई payment history नहीं</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {payments.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  p.type === "receipt"
                                    ? "bg-teal-100"
                                    : "bg-red-100"
                                }`}
                              >
                                <CreditCard
                                  size={14}
                                  className={p.type === "receipt" ? "text-teal-600" : "text-red-600"}
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-700 truncate">
                                  {p.type === "receipt" ? "जमा (Receipt)" : "नामे (Payment)"}
                                  {p.narration ? ` — ${p.narration}` : ""}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {formatDate(p.date)} ·{" "}
                                  {PAYMENT_MODE_LABELS[p.paymentMode] ?? p.paymentMode}
                                </p>
                              </div>
                            </div>
                            <p
                              className={`font-bold text-sm shrink-0 ml-3 ${
                                p.type === "receipt" ? "text-teal-600" : "text-red-600"
                              }`}
                            >
                              {formatINR(p.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* If no party, show payments anyway */}
          {!party && payments.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <CreditCard size={15} className="text-teal-500" />
                Recent Payments
              </h3>
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3"
                  >
                    <div>
                      <p className="text-xs font-semibold text-gray-700">
                        {p.type === "receipt" ? "जमा (Receipt)" : "नामे (Payment)"}
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(p.date)}</p>
                    </div>
                    <p className={`font-bold text-sm ${p.type === "receipt" ? "text-teal-600" : "text-red-600"}`}>
                      {formatINR(p.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Back link */}
          <div className="text-center pb-4">
            <Link
              href="/digital-viyapar"
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-amber-600 transition-colors"
            >
              <ChevronRight size={12} className="rotate-180" />
              Digital Viyapar Home
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}

// ── GSSP ──────────────────────────────────────────────────────────────────────

type PartyRow = {
  id: number | bigint;
  name: string;
  type: string;
  village: string | null;
  mobile: string | null;
};

type BalanceRow = { balance: string | number };

type PurchaseRow = {
  id: number | bigint;
  date: Date | string;
  bill_no: string | null;
  total_amount: string | number;
  items_summary: string | null;
};

type SaleRow = {
  id: number | bigint;
  date: Date | string;
  bill_no: string | null;
  grand_total: string | number;
  items_summary: string | null;
};

type PaymentRow = {
  id: number | bigint;
  date: Date | string;
  amount: string | number;
  payment_mode: string;
  type: string;
  narration: string | null;
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  // Parse cookie manually
  const cookieStr = ctx.req.headers.cookie ?? "";
  const cookies = Object.fromEntries(
    cookieStr.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k.trim(), v.join("=")];
    })
  );
  const token = cookies[COOKIE_NAME] ?? null;

  try {
    await ensurePortalTables();
    const session = await getSession(token);

    if (!session) {
      return { redirect: { destination: "/portal/login", permanent: false } };
    }

    const { firmId, partyId, name, mobile } = session;

    if (!partyId) {
      return {
        props: {
          sessionName: name,
          sessionMobile: mobile,
          party: null,
          balance: 0,
          balanceType: "Cr",
          transactions: [],
          payments: [],
        } satisfies DashboardProps,
      };
    }

    // Party details
    const partyRows = await prisma.$queryRaw<PartyRow[]>`
      SELECT id, name, type, village, mobile
      FROM parties
      WHERE id = ${partyId} AND firm_id = ${firmId} AND active = 1
      LIMIT 1
    `;

    if (!partyRows.length) {
      return {
        props: {
          sessionName: name,
          sessionMobile: mobile,
          party: null,
          balance: 0,
          balanceType: "Cr",
          transactions: [],
          payments: [],
        } satisfies DashboardProps,
      };
    }

    const party = partyRows[0];
    const partyType = party.type;

    // Outstanding balance
    const balRows = await prisma.$queryRaw<BalanceRow[]>`
      SELECT COALESCE(SUM(jl.debit - jl.credit), 0) AS balance
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      JOIN accounts a ON a.id = jl.account_id
      WHERE a.party_id = ${partyId} AND je.cancelled = 0
    `;

    const rawBalance = Number(balRows[0]?.balance ?? 0);
    const balanceType: "Dr" | "Cr" = rawBalance >= 0 ? "Dr" : "Cr";
    const balance = Math.abs(rawBalance);

    let transactions: Transaction[] = [];

    if (partyType === "kisan") {
      const rows = await prisma.$queryRaw<PurchaseRow[]>`
        SELECT
          p.id,
          p.date,
          p.bill_no,
          p.total_amount,
          GROUP_CONCAT(i.name ORDER BY i.name SEPARATOR ', ') AS items_summary
        FROM purchases p
        LEFT JOIN purchase_items pi2 ON pi2.purchase_id = p.id
        LEFT JOIN items i ON i.id = pi2.item_id
        WHERE p.kisan_id = ${partyId} AND p.firm_id = ${firmId} AND p.cancelled = 0
        GROUP BY p.id, p.date, p.bill_no, p.total_amount
        ORDER BY p.date DESC, p.id DESC
        LIMIT 20
      `;
      transactions = rows.map((r) => ({
        id: Number(r.id),
        type: "purchase" as const,
        date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
        billNo: r.bill_no,
        amount: Number(r.total_amount),
        itemsSummary: r.items_summary,
      }));
    } else if (partyType === "vyapari") {
      const rows = await prisma.$queryRaw<SaleRow[]>`
        SELECT
          s.id,
          s.date,
          s.bill_no,
          s.grand_total,
          GROUP_CONCAT(i.name ORDER BY i.name SEPARATOR ', ') AS items_summary
        FROM sales s
        LEFT JOIN sale_items si2 ON si2.sale_id = s.id
        LEFT JOIN items i ON i.id = si2.item_id
        WHERE s.vyapari_id = ${partyId} AND s.firm_id = ${firmId} AND s.cancelled = 0
        GROUP BY s.id, s.date, s.bill_no, s.grand_total
        ORDER BY s.date DESC, s.id DESC
        LIMIT 20
      `;
      transactions = rows.map((r) => ({
        id: Number(r.id),
        type: "sale" as const,
        date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
        billNo: r.bill_no,
        amount: Number(r.grand_total),
        itemsSummary: r.items_summary,
      }));
    }

    // Payments
    const paymentRows = await prisma.$queryRaw<PaymentRow[]>`
      SELECT id, date, amount, payment_mode, type, narration
      FROM payments_receipts
      WHERE party_id = ${partyId} AND firm_id = ${firmId}
      ORDER BY date DESC, id DESC
      LIMIT 10
    `;

    const payments: Payment[] = paymentRows.map((r) => ({
      id: Number(r.id),
      date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
      amount: Number(r.amount),
      paymentMode: r.payment_mode,
      type: r.type,
      narration: r.narration,
    }));

    return {
      props: {
        sessionName: name,
        sessionMobile: mobile,
        party: {
          id: Number(party.id),
          name: party.name,
          type: party.type,
          village: party.village ?? null,
          mobile: party.mobile ?? null,
        },
        balance,
        balanceType,
        transactions,
        payments,
      } satisfies DashboardProps,
    };
  } catch (err) {
    console.error("Dashboard GSSP error:", err);
    // On error, redirect to login
    return { redirect: { destination: "/portal/login", permanent: false } };
  }
};
