import { useState, useEffect, useCallback } from "react";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Layout } from "@/components/layout/Layout";
import Link from "next/link";
import { useRouter } from "next/router";
import { Package, Plus, Search, X, ChevronRight } from "lucide-react";

interface TraderPurchase {
  id: number;
  billNo: string;
  date: string;
  traderName: string;
  totalItemAmount: number;
  netPayable: number;
  cancelled: boolean;
}

function inr(v: number) {
  return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TraderPurchaseListPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<TraderPurchase[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/purchases/trader");
      if (!r.ok) return;
      const j = await r.json();
      setPurchases(j.purchases ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const filtered = purchases.filter(
    (p) =>
      !search ||
      p.billNo.toLowerCase().includes(search.toLowerCase()) ||
      p.traderName.toLowerCase().includes(search.toLowerCase())
  );

  const totalAmount = filtered.reduce((s, p) => s + (p.cancelled ? 0 : p.netPayable), 0);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Trader Purchase (व्यापारी खरीद)</h1>
              <p className="text-sm text-gray-500">
                {purchases.filter((p) => !p.cancelled).length} entries
              </p>
            </div>
          </div>
          <Link
            href="/kharid/trader/new"
            className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-700"
          >
            <Plus className="w-4 h-4" /> New Purchase
          </Link>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Bill no. या trader नाम से खोजें..."
            className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-20" />
              {search ? "कोई entry नहीं मिली" : "अभी तक कोई trader purchase नहीं — New Purchase से शुरू करें"}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                      <th className="text-left px-5 py-3 font-medium">Date</th>
                      <th className="text-left px-4 py-3 font-medium">Bill No.</th>
                      <th className="text-left px-4 py-3 font-medium">Trader (व्यापारी)</th>
                      <th className="text-right px-4 py-3 font-medium">Item Total</th>
                      <th className="text-right px-4 py-3 font-medium">Net Payable</th>
                      <th className="text-center px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => router.push(`/kharid/trader/${p.id}`)}
                        className={`hover:bg-orange-50/40 cursor-pointer transition-colors ${p.cancelled ? "opacity-50" : ""}`}
                      >
                        <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">
                          {new Date(p.date).toLocaleDateString("en-IN", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded">
                            {p.billNo}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-gray-800">{p.traderName}</td>
                        <td className="text-right px-4 py-3.5 text-gray-600">₹{inr(p.totalItemAmount)}</td>
                        <td className="text-right px-4 py-3.5 font-semibold text-gray-900">
                          ₹{inr(p.netPayable)}
                        </td>
                        <td className="text-center px-4 py-3.5">
                          {p.cancelled ? (
                            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                              Cancelled
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 text-gray-300">
                          <ChevronRight className="w-4 h-4" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {filtered.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => router.push(`/kharid/trader/${p.id}`)}
                    className={`p-4 cursor-pointer hover:bg-orange-50/40 active:bg-orange-100 ${p.cancelled ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{p.traderName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(p.date).toLocaleDateString("en-IN", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">₹{inr(p.netPayable)}</p>
                        <span className="font-mono text-xs bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded">
                          {p.billNo}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Item Total: ₹{inr(p.totalItemAmount)}</span>
                      {p.cancelled ? (
                        <span className="text-red-500 font-medium">Cancelled</span>
                      ) : (
                        <span className="text-green-600 font-medium">Active</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer total */}
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center text-sm">
                <span className="text-gray-500">
                  {filtered.length} entries
                </span>
                <span className="font-bold text-gray-800">
                  Total: ₹{inr(totalAmount)}
                </span>
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
  if (!session) return { redirect: { destination: "/login", permanent: false } };
  return { props: {} };
};
