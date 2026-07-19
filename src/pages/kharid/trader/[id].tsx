import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Layout } from "@/components/layout/Layout";
import Link from "next/link";
import { ArrowLeft, Package, User, Calendar, FileText, Printer, Pencil } from "lucide-react";

interface PurchaseDetail {
  id: number;
  billNo: string;
  date: string;
  traderId: number;
  traderName: string;
  traderVillage: string | null;
  totalItemAmount: number;
  committeePct: number;
  committeeAmt: number;
  kkfPct: number;
  kkfAmt: number;
  mudatPct: number;
  mudatAmt: number;
  sgstPct: number;
  sgstAmt: number;
  cgstPct: number;
  cgstAmt: number;
  igstPct: number;
  igstAmt: number;
  netPayable: number;
  cancelled: boolean;
  createdAt: string;
}

interface PurchaseItem {
  id: number;
  itemName: string;
  unitWeightKg: number;
  quantityBags: number;
  totalWeightKg: number;
  ratePerQtl: number;
  amount: number;
  katautiKg: number;
  netWeightKg: number;
  effectiveRate: number;
}

function inr(v: number) {
  return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div className={`flex justify-between py-2 border-b border-gray-50 text-sm ${bold ? "font-semibold" : ""}`}>
      <span className="text-gray-500">{label}</span>
      <span className={color ?? "text-gray-900"}>{value}</span>
    </div>
  );
}

export default function TraderPurchaseDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
  const [items, setItems]       = useState<PurchaseItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/purchases/trader?id=${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((j) => {
        if (!j) return;
        setPurchase(j.purchase);
        setItems(j.items ?? []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
      </Layout>
    );
  }

  if (notFound || !purchase) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-10 text-center text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Purchase not found</p>
          <Link href="/kharid/trader" className="text-orange-600 hover:underline text-sm mt-2 inline-block">
            ← Back to list
          </Link>
        </div>
      </Layout>
    );
  }

  const gstAmt = purchase.sgstAmt + purchase.cgstAmt + purchase.igstAmt;
  const stockCost = purchase.totalItemAmount + purchase.committeeAmt + purchase.kkfAmt + purchase.mudatAmt;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 print:px-0 print:py-2">
        {/* Back + actions */}
        <div className="flex items-center justify-between print:hidden">
          <Link
            href="/kharid/trader"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft size={14} /> Trader Purchase List
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href={`/kharid/trader/update/${purchase.id}`}
              className="flex items-center gap-1.5 border border-orange-200 text-orange-700 rounded-lg px-3 py-1.5 text-sm hover:bg-orange-50"
            >
              <Pencil size={14} /> Edit
            </Link>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <Printer size={14} /> Print
            </button>
          </div>
        </div>

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Trader Purchase</h1>
                <span className="font-mono text-sm text-orange-700 bg-orange-50 px-2 py-0.5 rounded">
                  {purchase.billNo}
                </span>
              </div>
            </div>
            {purchase.cancelled && (
              <span className="text-sm font-semibold text-red-600 bg-red-50 px-3 py-1 rounded-full">
                CANCELLED
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Date</p>
                <p className="font-medium text-gray-800">
                  {new Date(purchase.date).toLocaleDateString("en-IN", {
                    day: "2-digit", month: "long", year: "numeric",
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Trader (व्यापारी)</p>
                <p className="font-medium text-gray-800">{purchase.traderName}</p>
                {purchase.traderVillage && (
                  <p className="text-xs text-gray-400">{purchase.traderVillage}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-800">Commodity Details (जिन्स विवरण)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="text-left px-5 py-3 font-medium">Commodity</th>
                  <th className="text-right px-3 py-3 font-medium">Bags</th>
                  <th className="text-right px-3 py-3 font-medium">Wt (kg)</th>
                  <th className="text-right px-3 py-3 font-medium">Rate/Qtl</th>
                  <th className="text-right px-3 py-3 font-medium">Katauti</th>
                  <th className="text-right px-3 py-3 font-medium">Net Wt</th>
                  <th className="text-right px-5 py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-800">{item.itemName}</td>
                    <td className="text-right px-3 py-3 text-gray-600">{item.quantityBags}</td>
                    <td className="text-right px-3 py-3 text-gray-600">{item.totalWeightKg}</td>
                    <td className="text-right px-3 py-3 text-gray-600">₹{item.ratePerQtl}</td>
                    <td className="text-right px-3 py-3 text-gray-500">
                      {item.katautiKg > 0 ? `${item.katautiKg} kg` : "—"}
                    </td>
                    <td className="text-right px-3 py-3 text-gray-700 font-medium">{item.netWeightKg} kg</td>
                    <td className="text-right px-5 py-3 font-semibold text-gray-900">₹{inr(item.amount)}</td>
                  </tr>
                ))}
                {/* Effective rate note */}
                {items.map((item) => (
                  item.effectiveRate !== item.ratePerQtl ? (
                    <tr key={`eff-${item.id}`} className="bg-purple-50/40">
                      <td colSpan={6} className="px-5 py-1.5 text-xs text-purple-600">
                        {item.itemName} — Effective Stock Rate (incl. fees): ₹{item.effectiveRate}/qtl
                      </td>
                      <td />
                    </tr>
                  ) : null
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-5 py-3 text-gray-700">Total</td>
                  <td className="text-right px-3 py-3 text-gray-700">
                    {items.reduce((s, i) => s + i.quantityBags, 0)} bags
                  </td>
                  <td colSpan={4} />
                  <td className="text-right px-5 py-3 text-gray-900 text-base">
                    ₹{inr(purchase.totalItemAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Charges + Summary side by side on desktop */}
        <div className="grid md:grid-cols-2 gap-5">
          {/* Mandi Charges */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Mandi Charges (मंडी शुल्क)</h2>
            <div>
              {purchase.committeeAmt > 0 && (
                <Row
                  label={`Committee (${purchase.committeePct}%)`}
                  value={`₹${inr(purchase.committeeAmt)}`}
                />
              )}
              {purchase.kkfAmt > 0 && (
                <Row
                  label={`KKF (${purchase.kkfPct}%)`}
                  value={`₹${inr(purchase.kkfAmt)}`}
                />
              )}
              {purchase.mudatAmt > 0 && (
                <Row
                  label={`Mudat / Bhaav Badha (${purchase.mudatPct}%)`}
                  value={`₹${inr(purchase.mudatAmt)}`}
                />
              )}
              {purchase.committeeAmt === 0 && purchase.kkfAmt === 0 && purchase.mudatAmt === 0 && (
                <p className="text-xs text-gray-400 py-2">कोई मंडी शुल्क नहीं</p>
              )}
            </div>

            {gstAmt > 0 && (
              <>
                <h2 className="font-semibold text-gray-800 mt-4 mb-3">GST</h2>
                <div>
                  {purchase.sgstAmt > 0 && (
                    <Row label={`SGST (${purchase.sgstPct}%)`} value={`₹${inr(purchase.sgstAmt)}`} />
                  )}
                  {purchase.cgstAmt > 0 && (
                    <Row label={`CGST (${purchase.cgstPct}%)`} value={`₹${inr(purchase.cgstAmt)}`} />
                  )}
                  {purchase.igstAmt > 0 && (
                    <Row label={`IGST (${purchase.igstPct}%)`} value={`₹${inr(purchase.igstAmt)}`} />
                  )}
                </div>
              </>
            )}
          </div>

          {/* Financial Summary */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Summary (सारांश)</h2>
            <div>
              <Row label="Item Total (माल रकम)" value={`₹${inr(purchase.totalItemAmount)}`} />
              {purchase.committeeAmt > 0 && (
                <Row label="(+) Committee" value={`₹${inr(purchase.committeeAmt)}`} color="text-blue-600" />
              )}
              {purchase.kkfAmt > 0 && (
                <Row label="(+) KKF" value={`₹${inr(purchase.kkfAmt)}`} color="text-blue-600" />
              )}
              {purchase.mudatAmt > 0 && (
                <Row label="(+) Mudat" value={`₹${inr(purchase.mudatAmt)}`} color="text-blue-600" />
              )}
              {purchase.sgstAmt > 0 && (
                <Row label="(+) SGST" value={`₹${inr(purchase.sgstAmt)}`} color="text-orange-600" />
              )}
              {purchase.cgstAmt > 0 && (
                <Row label="(+) CGST" value={`₹${inr(purchase.cgstAmt)}`} color="text-orange-600" />
              )}
              {purchase.igstAmt > 0 && (
                <Row label="(+) IGST" value={`₹${inr(purchase.igstAmt)}`} color="text-orange-600" />
              )}

              <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-gray-700">Net Payable to Trader</span>
                  <span className="font-bold text-green-700 text-base">₹{inr(purchase.netPayable)}</span>
                </div>
                <div className="flex justify-between text-sm bg-purple-50 px-3 py-2 rounded-lg">
                  <span className="font-semibold text-purple-700">Total Stock Cost</span>
                  <span className="font-bold text-purple-700">₹{inr(stockCost)}</span>
                </div>
              </div>
            </div>
          </div>
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
