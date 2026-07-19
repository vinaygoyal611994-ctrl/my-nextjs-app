import { useState, useEffect } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatDate } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft, Printer, Pencil, X } from "lucide-react";

interface PaymentAllocation {
  voucherNo: string;
  date: string;
  mode: string;
  amount: number;
}

interface SaleDetail {
  id: number; billNo: string; date: string; vyapari: string; vyapariId: number;
  maalAmount: number; wagesAmount: number;
  damiPct: number; damiAmt: number;
  committeePct: number; committeeAmt: number;
  kkfPct: number; kkfAmt: number;
  mudatPct: number; mudatAmt: number;
  taxableAmount: number;
  sgstPct: number; sgstAmt: number;
  cgstPct: number; cgstAmt: number;
  igstPct: number; igstAmt: number;
  grandTotal: number;
  vehicleNo: string | null; driverName: string | null; biltyNo: string | null;
  paymentDueDate: string | null;
  items: { itemName: string; bags: number; weightKg: number; ratePerQtl: number; amount: number }[];
  payments: PaymentAllocation[];
  totalPaid: number;
}

function inr(v: number) {
  return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function QuickReceiveModal({
  sale, remaining, onClose, onSuccess,
}: { sale: SaleDetail; remaining: number; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: remaining.toFixed(2), mode: "cash", narration: "", bankAccountId: "" });
  const [banks, setBanks] = useState<{ id: number; bankName: string; accountNo: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    fetch("/api/bank-accounts").then(r => r.json()).then(d => {
      if (Array.isArray(d)) { setBanks(d); if (d.length > 0) set("bankAccountId", String(d[0].id)); }
    }).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { setErr("रकम सही डालें"); return; }
    if (amt > remaining + 0.01) { setErr(`बाकी रकम ₹${inr(remaining)} से ज्यादा नहीं हो सकती`); return; }
    setSaving(true); setErr("");
    try {
      const r = await fetch("/api/payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "receipt", partyId: sale.vyapariId, amount: amt, date: form.date, mode: form.mode, bankAccountId: form.mode !== "cash" && form.bankAccountId ? Number(form.bankAccountId) : undefined, narration: form.narration || `${sale.billNo} receipt`, allocations: [{ refType: "sale", refId: sale.id, amount: amt }] }),
      });
      if (!r.ok) { const j = await r.json(); setErr(j.error?.message ?? "Error"); return; }
      onSuccess(); onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b">
          <div><p className="font-semibold text-sm">Vyapari Receipt — {sale.billNo}</p><p className="text-xs text-gray-400">Baaki: ₹{inr(remaining)}</p></div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          {err && <div className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{err}</div>}
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-gray-500">Date</label><input type="date" required className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5" value={form.date} onChange={e => set("date", e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Amount ₹</label><input type="number" step="0.01" required className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5" value={form.amount} onChange={e => set("amount", e.target.value)} /></div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Mode</label>
            <div className="grid grid-cols-4 gap-1 mt-0.5">
              {(["cash","bank","upi","cheque"] as const).map(m => (
                <button key={m} type="button" onClick={() => set("mode", m)} className={`py-1 rounded-lg text-xs border ${form.mode===m?"bg-green-600 text-white border-green-600":"border-gray-200 text-gray-600"}`}>{m==="cash"?"Cash":m==="bank"?"Bank":m==="upi"?"UPI":"Cheque"}</button>
              ))}
            </div>
          </div>
          {form.mode !== "cash" && banks.length > 0 && (
            <div>
              <label className="text-xs text-gray-500">Bank Account (बैंक खाता)</label>
              <select className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5" value={form.bankAccountId} onChange={e => set("bankAccountId", e.target.value)}>
                {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} — ...{b.accountNo.slice(-4)}</option>)}
              </select>
            </div>
          )}
          <div><label className="text-xs text-gray-500">Narration</label><input type="text" className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5" placeholder="Note..." value={form.narration} onChange={e => set("narration", e.target.value)} /></div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50">{saving?"Saving...":"Mark Received"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BikriDetailPage({ sale }: { sale: SaleDetail }) {
  const router = useRouter();
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const remaining = sale.grandTotal - sale.totalPaid;
  return (
    <Layout title={`Bill — ${sale.billNo}`}>
      {showReceiveModal && (
        <QuickReceiveModal
          sale={sale} remaining={remaining}
          onClose={() => setShowReceiveModal(false)}
          onSuccess={() => router.replace(router.asPath)}
        />
      )}
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/bikri" className="inline-flex items-center gap-1 text-sm text-gray-500">
            <ArrowLeft size={14} /> Sale Register (बिक्री रजिस्टर)
          </Link>
          <div className="flex gap-2">
            {remaining > 0.01 && (
              <Link href={`/bikri/update/${sale.id}`}>
                <Button size="sm" variant="outline" className="gap-1 border-blue-300 text-blue-700 hover:bg-blue-50">
                  <Pencil size={14} /> Edit
                </Button>
              </Link>
            )}
            <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1">
              <Printer size={14} /> Print
            </Button>
          </div>
        </div>

        {/* Bill header */}
        <div className="bg-white rounded-lg border p-5 print:shadow-none">
          <div className="flex justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold">Sale Bill (बिक्री बिल)</h2>
              <p className="text-sm text-gray-500">Bill No. {sale.billNo}</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-medium">{formatDate(sale.date)}</p>
              {sale.paymentDueDate && (
                <p className="text-gray-500">Due: {formatDate(sale.paymentDueDate)}</p>
              )}
              {remaining <= 0.01 ? (
                <Badge className="mt-1 bg-green-100 text-green-700 border-green-200">Paid</Badge>
              ) : sale.totalPaid > 0 ? (
                <Badge className="mt-1 bg-amber-100 text-amber-700 border-amber-200">Partial</Badge>
              ) : (
                <Badge className="mt-1 bg-red-100 text-red-600 border-red-200">Unpaid</Badge>
              )}
            </div>
          </div>

          <div className="mb-4 p-3 bg-gray-50 rounded-md">
            <p className="text-xs text-gray-400 mb-0.5">Trader (व्यापारी)</p>
            <p className="font-semibold">
              <Link href={`/khata/${sale.vyapariId}`} className="text-primary hover:underline">
                {sale.vyapari}
              </Link>
            </p>
          </div>

          {/* Items table */}
          <table className="w-full text-sm mb-4">
            <thead className="border-b">
              <tr className="text-gray-500">
                <th className="text-left py-2">Commodity (जिन्स)</th>
                <th className="text-right py-2">Bags (बोरी)</th>
                <th className="text-right py-2">Weight (kg)</th>
                <th className="text-right py-2">Rate (भाव)</th>
                <th className="text-right py-2">Amount (रकम)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sale.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-2 font-medium">{item.itemName}</td>
                  <td className="py-2 text-right">{item.bags}</td>
                  <td className="py-2 text-right">{item.weightKg.toFixed(2)}</td>
                  <td className="py-2 text-right">₹{item.ratePerQtl}/q</td>
                  <td className="py-2 text-right font-semibold">{formatINR(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Bill totals */}
          <div className="border-t pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Goods Amount</span><span className="font-medium">{formatINR(sale.maalAmount)}</span></div>
            {sale.wagesAmount > 0 && <div className="flex justify-between"><span className="text-gray-500">(+) Labour Charges (हम्माली)</span><span>{formatINR(sale.wagesAmount)}</span></div>}
            {sale.damiAmt > 0 && <div className="flex justify-between"><span className="text-gray-500">(+) Commission/Dami {sale.damiPct}%</span><span>{formatINR(sale.damiAmt)}</span></div>}
            {sale.committeeAmt > 0 && <div className="flex justify-between"><span className="text-gray-500">(+) Committee {sale.committeePct}%</span><span>{formatINR(sale.committeeAmt)}</span></div>}
            {sale.kkfAmt > 0 && <div className="flex justify-between"><span className="text-gray-500">(+) KKF {sale.kkfPct}%</span><span>{formatINR(sale.kkfAmt)}</span></div>}
            {sale.mudatAmt > 0 && <div className="flex justify-between"><span className="text-gray-500">(+) Mudat {sale.mudatPct}%</span><span>{formatINR(sale.mudatAmt)}</span></div>}
            <div className="flex justify-between font-semibold border-t pt-1.5"><span>Total (excl. GST)</span><span>{formatINR(sale.taxableAmount)}</span></div>
            {sale.sgstAmt > 0 && <div className="flex justify-between text-gray-500"><span>SGST {sale.sgstPct}%</span><span>{formatINR(sale.sgstAmt)}</span></div>}
            {sale.cgstAmt > 0 && <div className="flex justify-between text-gray-500"><span>CGST {sale.cgstPct}%</span><span>{formatINR(sale.cgstAmt)}</span></div>}
            {sale.igstAmt > 0 && <div className="flex justify-between text-gray-500"><span>IGST {sale.igstPct}%</span><span>{formatINR(sale.igstAmt)}</span></div>}
            <div className="flex justify-between text-lg font-bold border-t pt-2 text-blue-700">
              <span>Total Bill Amount</span><span>{formatINR(sale.grandTotal)}</span>
            </div>
          </div>

          {/* Vehicle info */}
          {(sale.vehicleNo || sale.biltyNo) && (
            <div className="mt-3 pt-3 border-t text-xs text-gray-500 flex flex-wrap gap-4">
              {sale.vehicleNo && <span>Vehicle: {sale.vehicleNo}</span>}
              {sale.driverName && <span>Driver: {sale.driverName}</span>}
              {sale.biltyNo && <span>Bilty: {sale.biltyNo}</span>}
            </div>
          )}
        </div>

        {/* Payment history */}
        <div className="bg-white rounded-lg border p-5 print:hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Payment History (भुगतान इतिहास)</h3>
            {remaining > 0.01 && (
              <button
                onClick={() => setShowReceiveModal(true)}
                className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700"
              >
                + Receive ₹{inr(remaining)}
              </button>
            )}
          </div>

          {sale.payments.length === 0 ? (
            <p className="text-sm text-gray-400">No payments recorded against this bill yet.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 border-b">
                  <tr>
                    <th className="text-left py-2">Voucher</th>
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">Mode</th>
                    <th className="text-right py-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sale.payments.map((p, i) => (
                    <tr key={i}>
                      <td className="py-2 font-mono text-xs text-green-700">{p.voucherNo}</td>
                      <td className="py-2 text-gray-600">{formatDate(p.date)}</td>
                      <td className="py-2 text-gray-500 capitalize">{p.mode}</td>
                      <td className="py-2 text-right font-semibold text-green-700">₹{inr(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t pt-2 mt-2 flex justify-between text-sm">
                <span className="text-gray-500">Total Paid</span>
                <span className="font-bold text-green-700">₹{inr(sale.totalPaid)}</span>
              </div>
              {remaining > 0.01 && (
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500">Remaining</span>
                  <span className="font-bold text-orange-600">₹{inr(remaining)}</span>
                </div>
              )}
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
  const id = parseInt(ctx.params?.id as string, 10);

  const sale = await prisma.sale.findFirst({
    where: { id, firmId },
    include: {
      vyapari: { select: { name: true } },
      items: { include: { item: { select: { name: true, hindiName: true } } } },
    },
  });
  if (!sale) return { notFound: true };

  // Fetch payment allocations (table may not exist yet)
  type PayRow = { voucher_no: string; date: Date; mode: string; amount: string };
  let payRows: PayRow[] = [];
  try {
    payRows = await prisma.$queryRaw<PayRow[]>`
      SELECT pr.voucher_no, pr.date, pr.mode, ip.amount
      FROM invoice_payments ip
      JOIN payments_receipts pr ON pr.id = ip.payment_receipt_id
      WHERE ip.ref_type = 'sale' AND ip.ref_id = ${id} AND ip.firm_id = ${firmId}
      ORDER BY pr.date ASC
    `;
  } catch { /* table not yet created — no payments exist */ }

  const payments: PaymentAllocation[] = payRows.map((r) => ({
    voucherNo: r.voucher_no,
    date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
    mode: r.mode,
    amount: Number(r.amount),
  }));
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  return {
    props: {
      sale: {
        id: sale.id, billNo: sale.billNo, date: sale.date.toISOString(),
        vyapari: sale.vyapari.name, vyapariId: sale.vyapariId,
        maalAmount: Number(sale.maalAmount), wagesAmount: Number(sale.wagesAmount),
        damiPct: Number(sale.damiPct), damiAmt: Number(sale.damiAmt),
        committeePct: Number(sale.committeePct), committeeAmt: Number(sale.committeeAmt),
        kkfPct: Number(sale.kkfPct), kkfAmt: Number(sale.kkfAmt),
        mudatPct: Number(sale.mudatPct), mudatAmt: Number(sale.mudatAmt),
        taxableAmount: Number(sale.taxableAmount),
        sgstPct: Number(sale.sgstPct), sgstAmt: Number(sale.sgstAmt),
        cgstPct: Number(sale.cgstPct), cgstAmt: Number(sale.cgstAmt),
        igstPct: Number(sale.igstPct), igstAmt: Number(sale.igstAmt),
        grandTotal: Number(sale.grandTotal),
        vehicleNo: sale.vehicleNo, driverName: sale.driverName, biltyNo: sale.biltyNo,
        paymentDueDate: sale.paymentDueDate?.toISOString() ?? null,
        items: sale.items.map((i) => ({
          itemName: i.item.hindiName || i.item.name,
          bags: Number(i.quantityBags),
          weightKg: Number(i.totalWeightKg),
          ratePerQtl: Number(i.ratePerQtl),
          amount: Number(i.amount),
        })),
        payments,
        totalPaid,
      } as SaleDetail,
    },
  };
};
