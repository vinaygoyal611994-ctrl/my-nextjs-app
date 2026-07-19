import { useState, useEffect } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR, todayISO } from "@/lib/utils";
import { BarChart2, TrendingDown, TrendingUp, Scale, Printer, FileSpreadsheet, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { TrialBalanceLine } from "@/pages/api/reports/trial-balance";
import type { BalanceIssue } from "@/pages/api/reports/balance-check";

const TYPE_ORDER = ["asset", "liability", "income", "expense", "capital"];
const TYPE_LABEL: Record<string, string> = {
  asset: "Assets (संपत्ति)",
  liability: "Liabilities (देनदारियाँ)",
  income: "Income (आय)",
  expense: "Expenses (खर्चे)",
  capital: "Capital (पूँजी)",
};
const TYPE_COLOR: Record<string, string> = {
  asset: "text-blue-700 bg-blue-50",
  liability: "text-red-700 bg-red-50",
  income: "text-green-700 bg-green-50",
  expense: "text-orange-700 bg-orange-50",
  capital: "text-purple-700 bg-purple-50",
};

type Tab = "trial" | "pl" | "balance";

export default function HisaabKitabPage({ fyStart }: { fyStart: string }) {
  const today = todayISO();
  const [tab, setTab] = useState<Tab>("trial");
  const [from, setFrom] = useState(fyStart);
  const [to, setTo] = useState(today);
  const [lines, setLines] = useState<TrialBalanceLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkIssues, setCheckIssues] = useState<BalanceIssue[] | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    setCheckIssues(null);
    const res = await fetch(`/api/reports/trial-balance?from=${from}&to=${to}`);
    if (res.ok) setLines(await res.json());
    setLoading(false);
  }

  function downloadExcel() {
    window.location.href = `/api/reports/excel?from=${from}&to=${to}&tab=${tab}`;
  }

  function printPDF() {
    window.print();
  }

  // Group by type
  const byType = TYPE_ORDER.reduce<Record<string, TrialBalanceLine[]>>((acc, t) => {
    acc[t] = lines.filter((l) => l.type === t);
    return acc;
  }, {});

  // Totals for P&L
  const totalIncome = byType.income.reduce((s, l) => s + l.totalCredit - l.totalDebit, 0);
  const totalDirectExp = lines.filter((l) => l.type === "expense" && l.code.startsWith("PUR_")).reduce((s, l) => s + l.netBalance, 0);
  const totalIndirectExp = lines.filter((l) => l.type === "expense" && !l.code.startsWith("PUR_")).reduce((s, l) => s + l.netBalance, 0);
  const grossProfit = totalIncome - totalDirectExp;
  const netProfit = grossProfit - totalIndirectExp;

  // Totals for Balance Sheet
  const totalAssets = byType.asset.reduce((s, l) => s + Math.max(l.netBalance, 0), 0);
  const totalLiab = byType.liability.reduce((s, l) => s + Math.max(-l.netBalance, 0), 0);
  const totalCapital = byType.capital.reduce((s, l) => s + Math.max(-l.netBalance, 0), 0) + netProfit;

  // Grand totals for trial balance
  const grandDr = lines.reduce((s, l) => s + l.totalDebit, 0);
  const grandCr = lines.reduce((s, l) => s + l.totalCredit, 0);

  const bsDiff = Math.abs(totalAssets - totalLiab - totalCapital);

  // Auto-fetch diagnostics whenever the balance sheet is unbalanced
  useEffect(() => {
    if (bsDiff < 1 || lines.length === 0) { setCheckIssues(null); return; }
    setCheckLoading(true);
    fetch("/api/reports/balance-check")
      .then(r => r.json())
      .then(d => setCheckIssues(Array.isArray(d.issues) ? d.issues : []))
      .catch(() => setCheckIssues([]))
      .finally(() => setCheckLoading(false));
  }, [bsDiff, lines.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Layout title="Reports (हिसाब-किताब)">
      {/* Print CSS — hides everything except report content */}
      <style>{`
        @media print {
          header, nav, aside, .no-print { display: none !important; }
          body { background: white !important; }
          .print-title { display: block !important; }
        }
        .print-title { display: none; }
      `}</style>

      <div className="space-y-4">
        {/* Print header (visible only when printing) */}
        <div className="print-title text-center mb-4">
          <h1 className="text-xl font-bold">मंडी खाता — Reports</h1>
          <p className="text-sm text-gray-500">Period: {from} to {to}</p>
        </div>

        {/* Date range + fetch */}
        <div className="no-print flex flex-wrap items-center gap-3 bg-white rounded-lg border p-3">
          <BarChart2 size={18} className="text-amber-600" />
          <span className="font-medium text-gray-700 text-sm">Period:</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40 h-9" />
          <span className="text-gray-400 text-sm">to</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40 h-9" />
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            {loading ? "Loading..." : "View"}
          </Button>

          {/* Download buttons */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={downloadExcel}
              disabled={lines.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <FileSpreadsheet size={15} />
              Excel
            </button>
            <button
              onClick={printPDF}
              disabled={lines.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Printer size={15} />
              Print / PDF
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="no-print flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {([
            { key: "trial", label: "Trial Balance (तलपट)" },
            { key: "pl", label: "Profit & Loss (लाभ-हानि)" },
            { key: "balance", label: "Balance Sheet" },
          ] as { key: Tab; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t.key ? "bg-white shadow text-amber-700" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Trial Balance */}
        {tab === "trial" && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="bg-amber-50 px-4 py-3 border-b">
              <h2 className="font-bold text-gray-700">Trial Balance (तलपट)</h2>
              <p className="text-xs text-gray-400">Summary of all accounts — debit and credit</p>
            </div>

            {loading ? (
              <div className="py-16 text-center text-gray-400">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-600">Account</th>
                      <th className="text-right px-4 py-3 text-gray-600">Payment (नामे) (Dr)</th>
                      <th className="text-right px-4 py-3 text-gray-600">Receipt (जमा) (Cr)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TYPE_ORDER.map((type) => {
                      const group = byType[type];
                      if (!group.length) return null;
                      const gDr = group.reduce((s, l) => s + l.totalDebit, 0);
                      const gCr = group.reduce((s, l) => s + l.totalCredit, 0);
                      return (
                        <>
                          <tr key={`head-${type}`} className={`${TYPE_COLOR[type]} font-semibold text-xs uppercase`}>
                            <td className="px-4 py-2" colSpan={3}>{TYPE_LABEL[type]}</td>
                          </tr>
                          {group.map((l) => (
                            <tr key={l.accountId} className="border-b hover:bg-gray-50">
                              <td className="px-4 py-2.5 pl-8">{l.name}</td>
                              <td className="px-4 py-2.5 text-right font-mono">
                                {l.totalDebit > 0 ? formatINR(l.totalDebit) : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono">
                                {l.totalCredit > 0 ? formatINR(l.totalCredit) : "—"}
                              </td>
                            </tr>
                          ))}
                          <tr key={`sub-${type}`} className="bg-gray-50 text-xs font-semibold">
                            <td className="px-4 py-1.5 pl-8 text-gray-500">Sub-total</td>
                            <td className="px-4 py-1.5 text-right">{formatINR(gDr)}</td>
                            <td className="px-4 py-1.5 text-right">{formatINR(gCr)}</td>
                          </tr>
                        </>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-400">
                    <tr className="font-bold text-base">
                      <td className="px-4 py-3">Grand Total</td>
                      <td className="px-4 py-3 text-right text-red-700">{formatINR(grandDr)}</td>
                      <td className="px-4 py-3 text-right text-green-700">{formatINR(grandCr)}</td>
                    </tr>
                    {Math.abs(grandDr - grandCr) > 0.01 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-2 text-center text-xs text-red-500">
                          ⚠ Trial balance not balanced — difference: {formatINR(Math.abs(grandDr - grandCr))}
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Profit & Loss */}
        {tab === "pl" && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="bg-green-50 px-4 py-3 border-b flex items-center gap-2">
                <TrendingUp size={16} className="text-green-600" />
                <h2 className="font-bold text-gray-700">Income (आय)</h2>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {byType.income.map((l) => (
                    <tr key={l.accountId} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2.5">{l.name}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-green-700">
                        {formatINR(l.totalCredit - l.totalDebit)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-green-50 font-bold border-t-2">
                    <td className="px-4 py-3">Total Income</td>
                    <td className="px-4 py-3 text-right text-green-700">{formatINR(totalIncome)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="bg-orange-50 px-4 py-3 border-b flex items-center gap-2">
                <TrendingDown size={16} className="text-orange-600" />
                <h2 className="font-bold text-gray-700">Direct Expenses (Purchase)</h2>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {lines.filter((l) => l.type === "expense" && l.code.startsWith("PUR_")).map((l) => (
                    <tr key={l.accountId} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2.5">{l.name}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-red-600">{formatINR(l.netBalance)}</td>
                    </tr>
                  ))}
                  <tr className="bg-orange-50 font-bold border-t-2">
                    <td className="px-4 py-3">Total Direct Expenses</td>
                    <td className="px-4 py-3 text-right text-red-700">{formatINR(totalDirectExp)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Gross Profit */}
            <div className={`rounded-lg border p-4 flex justify-between items-center font-bold text-lg ${grossProfit >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <span>Gross Profit (सकल लाभ)</span>
              <span className={grossProfit >= 0 ? "text-green-700" : "text-red-700"}>{formatINR(grossProfit)}</span>
            </div>

            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b">
                <h2 className="font-bold text-gray-700">Indirect Expenses (अप्रत्यक्ष खर्चे)</h2>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {lines.filter((l) => l.type === "expense" && !l.code.startsWith("PUR_")).map((l) => (
                    <tr key={l.accountId} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2.5">{l.name}</td>
                      <td className="px-4 py-2.5 text-right text-red-600">{formatINR(l.netBalance)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold border-t-2">
                    <td className="px-4 py-3">Total Indirect Expenses</td>
                    <td className="px-4 py-3 text-right text-red-700">{formatINR(totalIndirectExp)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Net Profit */}
            <div className={`rounded-lg border p-5 flex justify-between items-center font-bold text-xl ${netProfit >= 0 ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
              <span>Net Profit / Loss (शुद्ध लाभ / हानि)</span>
              <span className={netProfit >= 0 ? "text-green-700" : "text-red-700"}>{formatINR(netProfit)}</span>
            </div>
          </div>
        )}

        {/* Balance Sheet */}
        {tab === "balance" && (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Assets */}
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="bg-blue-50 px-4 py-3 border-b flex items-center gap-2">
                <Scale size={16} className="text-blue-600" />
                <h2 className="font-bold text-gray-700">Assets (संपत्ति)</h2>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {byType.asset.map((l) => (
                    <tr key={l.accountId} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2.5">{l.name}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatINR(Math.abs(l.netBalance))}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50 font-bold border-t-2">
                    <td className="px-4 py-3">Total Assets</td>
                    <td className="px-4 py-3 text-right text-blue-700">{formatINR(totalAssets)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Liabilities + Capital */}
            <div className="space-y-4">
              <div className="bg-white rounded-lg border overflow-hidden">
                <div className="bg-red-50 px-4 py-3 border-b">
                  <h2 className="font-bold text-gray-700">Liabilities (देनदारियाँ)</h2>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {byType.liability.map((l) => (
                      <tr key={l.accountId} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2.5">{l.name}</td>
                        <td className="px-4 py-2.5 text-right">{formatINR(Math.abs(l.netBalance))}</td>
                      </tr>
                    ))}
                    <tr className="bg-red-50 font-bold border-t-2">
                      <td className="px-4 py-3">Total Liabilities</td>
                      <td className="px-4 py-3 text-right text-red-700">{formatINR(totalLiab)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-white rounded-lg border overflow-hidden">
                <div className="bg-purple-50 px-4 py-3 border-b">
                  <h2 className="font-bold text-gray-700">Capital + Profit (पूँजी)</h2>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {byType.capital.map((l) => (
                      <tr key={l.accountId} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2.5">{l.name}</td>
                        <td className="px-4 py-2.5 text-right">{formatINR(Math.abs(l.netBalance))}</td>
                      </tr>
                    ))}
                    <tr className="hover:bg-gray-50 border-b">
                      <td className="px-4 py-2.5 text-gray-500">Net Profit (this year)</td>
                      <td className={`px-4 py-2.5 text-right ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatINR(netProfit)}
                      </td>
                    </tr>
                    <tr className="bg-purple-50 font-bold border-t-2">
                      <td className="px-4 py-3">Total Capital</td>
                      <td className="px-4 py-3 text-right text-purple-700">{formatINR(totalCapital)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className={`rounded-lg border p-4 flex justify-between font-bold ${bsDiff < 1 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <span>Balance Check</span>
                <span className={bsDiff < 1 ? "text-green-700" : "text-red-700"}>
                  {bsDiff < 1
                    ? "✓ Balanced"
                    : `Difference: ${formatINR(bsDiff)}`}
                </span>
              </div>

              {/* Diagnostic panel — shown only when unbalanced */}
              {bsDiff >= 1 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <h3 className="font-semibold text-amber-800 text-sm">
                      Difference की वजह (Why Balance Sheet doesn't match)
                    </h3>
                  </div>

                  {checkLoading ? (
                    <p className="text-sm text-amber-600">जाँच हो रही है...</p>
                  ) : checkIssues && checkIssues.length > 0 ? (
                    <ul className="space-y-2 mt-1">
                      {checkIssues.map((issue, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
                          {issue.type === "rounding" ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          ) : (
                            <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                          )}
                          <span>{issue.message}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-amber-600">कारण ढूंढ रहे हैं...</p>
                  )}

                  <p className="text-xs text-amber-500 mt-3 border-t border-amber-200 pt-2">
                    आम भाषा में: Balance Sheet तब balance होती है जब हर transaction दोनों तरफ (Debit + Credit) दर्ज हो।
                    ऊपर दिए कारण ठीक करने के बाद दोबारा View दबाएँ।
                  </p>
                </div>
              )}
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

  const firm = await prisma.firm.findUnique({ where: { id: firmId }, select: { fyStart: true } });

  return {
    props: {
      fyStart: firm?.fyStart.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    },
  };
};
