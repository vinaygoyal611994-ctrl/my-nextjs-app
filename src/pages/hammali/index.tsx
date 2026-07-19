import { useState, useEffect, useCallback } from "react";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Layout } from "@/components/layout/Layout";
import { Users, Plus, X, CheckCircle2, AlertCircle } from "lucide-react";

interface Summary {
  accountId: number | null;
  accumulated: number;
  paid: number;
  outstanding: number;
}

interface PayRecord {
  id: number;
  voucherNo: string;
  date: string;
  amount: number;
  narration: string | null;
}

interface BankAccount {
  id: number;
  bankName: string;
  accountNo: string;
}

function inr(v: number) {
  return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PayModal({
  outstanding,
  bankAccounts,
  onClose,
  onSuccess,
}: {
  outstanding: number;
  bankAccounts: BankAccount[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    date:          new Date().toISOString().slice(0, 10),
    amount:        outstanding > 0 ? outstanding.toFixed(2) : "",
    mode:          "cash",
    bankAccountId: "",
    narration:     "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { setErr("रकम सही डालें"); return; }
    if (form.mode !== "cash" && !form.bankAccountId) { setErr("Bank account चुनें"); return; }
    setSaving(true); setErr("");
    try {
      const r = await fetch("/api/hammali", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date:          form.date,
          amount:        amt,
          mode:          form.mode,
          bankAccountId: form.bankAccountId ? parseInt(form.bankAccountId) : undefined,
          narration:     form.narration || "Hammali / Labour charges",
        }),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? "Error saving"); return; }
      onSuccess();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">Hammali Payment</h2>
            <p className="text-xs text-gray-400">Outstanding: ₹{inr(outstanding)}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          {err && <div className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-200">{err}</div>}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Date (तारीख)</label>
              <input type="date" required
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5"
                value={form.date} onChange={e => set("date", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Amount ₹ (रकम)</label>
              <input type="number" step="0.01" min="0.01" required
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5"
                value={form.amount} onChange={e => set("amount", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Mode (तरीका)</label>
            <div className="grid grid-cols-4 gap-1 mt-0.5">
              {(["cash","bank","upi","cheque"] as const).map(m => (
                <button key={m} type="button" onClick={() => set("mode", m)}
                  className={`py-1 rounded-lg text-xs border transition-colors ${form.mode===m?"bg-blue-600 text-white border-blue-600":"border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                  {m==="cash"?"Cash":m==="bank"?"Bank":m==="upi"?"UPI":"Cheque"}
                </button>
              ))}
            </div>
          </div>

          {form.mode !== "cash" && (
            <div>
              <label className="text-xs text-gray-500">Bank Account <span className="text-red-500">*</span></label>
              {bankAccounts.length === 0 ? (
                <p className="text-xs text-red-500 mt-0.5">कोई bank account नहीं मिला</p>
              ) : (
                <select required
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5"
                  value={form.bankAccountId} onChange={e => set("bankAccountId", e.target.value)}>
                  <option value="">— Bank चुनें —</option>
                  {bankAccounts.map(b => (
                    <option key={b.id} value={String(b.id)}>{b.bankName} — {b.accountNo.slice(-4).padStart(b.accountNo.length, "*")}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500">Narration (वैकल्पिक)</label>
            <input type="text"
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5"
              placeholder="जैसे: Palledar wages 1-15 July"
              value={form.narration} onChange={e => set("narration", e.target.value)} />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function HammaliPage() {
  const [summary, setSummary]       = useState<Summary>({ accountId: null, accumulated: 0, paid: 0, outstanding: 0 });
  const [history, setHistory]       = useState<PayRecord[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);

  useEffect(() => {
    fetch("/api/bank-accounts")
      .then(r => r.json())
      .then(d => setBankAccounts(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/hammali");
      if (!r.ok) return;
      const j = await r.json();
      setSummary({ accountId: j.accountId, accumulated: j.accumulated, paid: j.paid, outstanding: j.outstanding });
      if (Array.isArray(j.history)) setHistory(j.history);
    } catch { /* keep existing */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  return (
    <Layout>
      {showModal && (
        <PayModal
          outstanding={summary.outstanding}
          bankAccounts={bankAccounts}
          onClose={() => setShowModal(false)}
          onSuccess={fetchData}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Hammali Payment (हम्माली भुगतान)</h1>
              <p className="text-sm text-gray-500">Purchases से काटी गई wages — Labourers को दें</p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            disabled={summary.outstanding <= 0.01}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" /> Record Payment
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <p className="text-xs text-amber-600 font-medium mb-1">Wages Collected (बना)</p>
            <p className="text-2xl font-bold text-amber-700">₹{inr(summary.accumulated)}</p>
            <p className="text-xs text-amber-500 mt-1">Purchases से काटी गई labour wages</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
            <p className="text-xs text-green-600 font-medium mb-1">Paid to Labour (दिया)</p>
            <p className="text-2xl font-bold text-green-700">₹{inr(summary.paid)}</p>
          </div>
          <div className={`border rounded-2xl p-4 ${summary.outstanding > 0 ? "bg-red-50 border-red-100" : "bg-green-50 border-green-100"}`}>
            <p className={`text-xs font-medium mb-1 ${summary.outstanding > 0 ? "text-red-600" : "text-green-600"}`}>
              Outstanding (बाकी)
            </p>
            <p className={`text-2xl font-bold ${summary.outstanding > 0 ? "text-red-700" : "text-green-700"}`}>
              ₹{inr(summary.outstanding)}
            </p>
            {summary.outstanding <= 0 && (
              <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> All clear!
              </p>
            )}
          </div>
        </div>

        {/* How it works */}
        {summary.accumulated === 0 && !loading && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">कैसे काम करता है?</p>
            <p>जब आप एक Purchase (खरीद) में Labour Charges / Wages काटते हैं, वो रकम यहाँ दिखेगी।</p>
            <p className="mt-1">फिर यहाँ से Palledar / Labour को payment record कर सकते हैं।</p>
          </div>
        )}

        {/* Payment history */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-800">Payment History (भुगतान इतिहास)</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>कोई payment दर्ज नहीं</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="text-left px-5 py-3 font-medium">Voucher No.</th>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Narration</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map(h => (
                  <tr key={h.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-mono text-xs text-blue-700">{h.voucherNo}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(h.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{h.narration ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-700">₹{inr(h.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50">
                  <td colSpan={3} className="px-5 py-2.5 text-xs font-medium text-gray-500">Total Paid</td>
                  <td className="px-4 py-2.5 text-right font-bold text-green-700">₹{inr(summary.paid)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) return { redirect: { destination: "/auth/login", permanent: false } };
  return { props: {} };
};
