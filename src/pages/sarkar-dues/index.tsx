import { useState, useEffect, useCallback } from "react";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Layout } from "@/components/layout/Layout";
import {
  Landmark, Plus, X, ChevronDown, ChevronRight,
  CheckCircle2, AlertCircle, Clock, IndianRupee, Receipt,
} from "lucide-react";

interface DuesSummary {
  key: string;       // account code (e.g. "MSHK001", "TDS001")
  label: string;     // account name
  accountId: number | null;
  accumulated: number;
  paid: number;
  remaining: number;
}

interface BankAccount {
  id: number;
  bankName: string;
  accountNo: string;
  account: { id: number } | null;
}

interface PaymentHistory {
  id: number;
  duesType: string;
  label: string;
  date: string;
  periodFrom: string | null;
  periodTo: string | null;
  amount: number;
  challanNo: string | null;
  mode: string;
  bankName: string | null;
  narration: string | null;
}

// GST account codes — always grouped together
const GST_CODES = new Set(["SGST001", "CGST001", "IGST001"]);

const MODE_LABELS: Record<string, string> = {
  cash: "Cash", bank: "Bank", upi: "UPI", cheque: "Cheque",
};

function inr(v: number) {
  return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatusBadge({ remaining }: { remaining: number }) {
  if (remaining <= 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" /> Clear
      </span>
    );
  if (remaining < 5000)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
        <Clock className="w-3 h-3" /> Pending
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
      <AlertCircle className="w-3 h-3" /> Due
    </span>
  );
}

interface PayModalProps {
  open: boolean;
  defaultType?: string;
  defaultAmount?: number;
  summary: DuesSummary[];
  bankAccounts: BankAccount[];
  onClose: () => void;
  onSuccess: () => void;
}

function PayModal({ open, defaultType, defaultAmount, summary, bankAccounts, onClose, onSuccess }: PayModalProps) {
  const firstKey = summary[0]?.key ?? "";
  const [form, setForm] = useState({
    duesType:      defaultType ?? firstKey,
    date:          new Date().toISOString().slice(0, 10),
    periodFrom:    "",
    periodTo:      "",
    amount:        defaultAmount ? String(defaultAmount.toFixed(2)) : "",
    mode:          "cash",
    bankAccountId: "",
    challanNo:     "",
    narration:     "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const needsBank = form.mode !== "cash";

  useEffect(() => {
    if (open) {
      setForm((f) => ({
        ...f,
        duesType:      defaultType ?? firstKey,
        amount:        defaultAmount ? String(defaultAmount.toFixed(2)) : "",
        bankAccountId: "",
      }));
      setErr("");
    }
  }, [open, defaultType, defaultAmount, firstKey]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { setErr("राशि सही डालें"); return; }
    if (needsBank && !form.bankAccountId) { setErr("कृपया bank account चुनें"); return; }

    setSaving(true);
    try {
      const r = await fetch("/api/dues/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duesType:      form.duesType,
          date:          form.date,
          periodFrom:    form.periodFrom    || undefined,
          periodTo:      form.periodTo      || undefined,
          amount:        amt,
          mode:          form.mode,
          bankAccountId: form.bankAccountId ? parseInt(form.bankAccountId) : undefined,
          challanNo:     form.challanNo     || undefined,
          narration:     form.narration     || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error?.message ?? j.error ?? "Error"); return; }
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Receipt className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Sarkar Dues Payment</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {err && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {err}
            </div>
          )}

          {/* Dues Type — dynamic from summary */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Dues Type (किस्म)</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.duesType}
              onChange={(e) => set("duesType", e.target.value)}
            >
              {summary.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Payment Date (तारीख)</label>
            <input
              type="date" required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>

          {/* Period From–To */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Period From (वैकल्पिक)</label>
              <input type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.periodFrom} onChange={(e) => set("periodFrom", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Period To (तक)</label>
              <input type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.periodTo} onChange={(e) => set("periodTo", e.target.value)} />
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Amount ₹ (राशि)</label>
            <input type="number" step="0.01" min="0.01" required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
          </div>

          {/* Mode */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Payment Mode</label>
            <div className="grid grid-cols-4 gap-2">
              {(["cash", "bank", "upi", "cheque"] as const).map((m) => (
                <button key={m} type="button" onClick={() => set("mode", m)}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    form.mode === m ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  }`}>
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {needsBank && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Bank Account <span className="text-red-500">*</span>
              </label>
              {bankAccounts.length === 0 ? (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                  कोई bank account नहीं मिला — Settings में जाकर bank add करें
                </p>
              ) : (
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.bankAccountId} onChange={(e) => set("bankAccountId", e.target.value)} required={needsBank}>
                  <option value="">— Bank चुनें —</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {b.bankName} — {b.accountNo.slice(-4).padStart(b.accountNo.length, "*")}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Challan No */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Challan / Receipt No. (वैकल्पिक)</label>
            <input type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Challan number..." value={form.challanNo} onChange={(e) => set("challanNo", e.target.value)} />
          </div>

          {/* Narration */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Narration (वैकल्पिक)</label>
            <input type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Note..." value={form.narration} onChange={(e) => set("narration", e.target.value)} />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : "Pay & Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SummaryRow({ row, onPay }: { row: DuesSummary; onPay: () => void }) {
  return (
    <tr className="hover:bg-gray-50/50">
      <td className="px-5 py-3 font-medium text-gray-800">{row.label}</td>
      <td className="text-right px-4 py-3 text-gray-600">₹{inr(row.accumulated)}</td>
      <td className="text-right px-4 py-3 text-green-600">₹{inr(row.paid)}</td>
      <td className={`text-right px-4 py-3 font-semibold ${row.remaining > 0 ? "text-red-600" : "text-green-600"}`}>
        ₹{inr(row.remaining)}
      </td>
      <td className="text-center px-4 py-3"><StatusBadge remaining={row.remaining} /></td>
      <td className="px-4 py-3">
        {row.remaining > 0 && (
          <button onClick={onPay} className="text-sm text-blue-600 hover:underline font-medium">Pay</button>
        )}
      </td>
    </tr>
  );
}

export default function SarkarDuesPage() {
  const [summary, setSummary]       = useState<DuesSummary[]>([]);
  const [history, setHistory]       = useState<PaymentHistory[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading]       = useState(true);
  const [gstExpanded, setGstExpanded] = useState(false);
  const [histFrom, setHistFrom]     = useState("");
  const [histTo, setHistTo]         = useState("");
  const [modal, setModal]           = useState<{ open: boolean; type?: string; amount?: number }>({ open: false });

  useEffect(() => {
    fetch("/api/bank-accounts")
      .then((r) => r.json())
      .then((d: BankAccount[]) => setBankAccounts(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (histFrom) params.set("from", histFrom);
      if (histTo)   params.set("to", histTo);
      const r = await fetch(`/api/dues?${params}`);
      if (!r.ok) return;
      const j = await r.json();
      if (Array.isArray(j.summary)) setSummary(j.summary);
      if (Array.isArray(j.history)) setHistory(j.history);
    } catch {
      // keep existing data
    } finally {
      setLoading(false);
    }
  }, [histFrom, histTo]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const get = (key: string) => summary.find((s) => s.key === key);

  // Split summary into: GST group, and standalone rows (everything else)
  const gstItems      = summary.filter((s) => GST_CODES.has(s.key));
  const standaloneRows = summary.filter((s) => !GST_CODES.has(s.key));

  const gstAccum  = gstItems.reduce((s, d) => s + d.accumulated, 0);
  const gstPaid   = gstItems.reduce((s, d) => s + d.paid, 0);
  const gstRemain = gstItems.reduce((s, d) => s + d.remaining, 0);

  const totalRemaining = summary.reduce((s, d) => s + Math.max(d.remaining, 0), 0);
  const totalPaid      = summary.reduce((s, d) => s + d.paid, 0);
  const totalAccum     = summary.reduce((s, d) => s + d.accumulated, 0);

  const openModal = (type: string) => {
    const row = get(type);
    setModal({ open: true, type, amount: row && row.remaining > 0 ? row.remaining : undefined });
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Landmark className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Sarkar Dues (सरकारी देय)</h1>
              <p className="text-sm text-gray-500">Committee · KKF · GST · TDS — accumulated vs paid</p>
            </div>
          </div>
          <button
            onClick={() => setModal({ open: true })}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Record Payment
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
            <p className="text-xs text-orange-600 font-medium mb-1">Total Accumulated (बना)</p>
            <p className="text-2xl font-bold text-orange-700">₹{inr(totalAccum)}</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
            <p className="text-xs text-green-600 font-medium mb-1">Total Paid (चुकाया)</p>
            <p className="text-2xl font-bold text-green-700">₹{inr(totalPaid)}</p>
          </div>
          <div className={`border rounded-2xl p-4 ${totalRemaining > 0 ? "bg-red-50 border-red-100" : "bg-green-50 border-green-100"}`}>
            <p className={`text-xs font-medium mb-1 ${totalRemaining > 0 ? "text-red-600" : "text-green-600"}`}>
              Total Remaining (बाकी)
            </p>
            <p className={`text-2xl font-bold ${totalRemaining > 0 ? "text-red-700" : "text-green-700"}`}>
              ₹{inr(totalRemaining)}
            </p>
          </div>
        </div>

        {/* Summary Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-800">Dues Summary</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              नया dues account जोड़ने के लिए: Accounts → New Account → Liability / Payable → &quot;Sarkari Dues&quot; checkbox ✓
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
          ) : summary.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              <IndianRupee className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>कोई dues account नहीं मिला</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="text-left px-5 py-3 font-medium">Category</th>
                  <th className="text-right px-4 py-3 font-medium">Accumulated (बना)</th>
                  <th className="text-right px-4 py-3 font-medium">Paid (चुकाया)</th>
                  <th className="text-right px-4 py-3 font-medium">Remaining (बाकी)</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {/* Standalone rows (committee, kkf, tds, any custom) */}
                {standaloneRows.map((row) => (
                  <SummaryRow key={row.key} row={row} onPay={() => openModal(row.key)} />
                ))}

                {/* GST Total row (collapsible) — only show if any GST accounts exist */}
                {gstItems.length > 0 && (
                  <>
                    <tr className="bg-blue-50/50">
                      <td className="px-5 py-3">
                        <button
                          className="flex items-center gap-2 font-semibold text-blue-700"
                          onClick={() => setGstExpanded((v) => !v)}
                        >
                          {gstExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          GST Total
                        </button>
                      </td>
                      <td className="text-right px-4 py-3 font-medium text-gray-700">₹{inr(gstAccum)}</td>
                      <td className="text-right px-4 py-3 font-medium text-green-700">₹{inr(gstPaid)}</td>
                      <td className={`text-right px-4 py-3 font-semibold ${gstRemain > 0 ? "text-red-600" : "text-green-600"}`}>
                        ₹{inr(gstRemain)}
                      </td>
                      <td className="text-center px-4 py-3"><StatusBadge remaining={gstRemain} /></td>
                      <td className="px-4 py-3"></td>
                    </tr>
                    {gstExpanded && gstItems.map((row) => (
                      <tr key={row.key} className="bg-blue-50/20">
                        <td className="px-5 py-2.5 pl-10 text-gray-600 text-xs">{row.label}</td>
                        <td className="text-right px-4 py-2.5 text-xs text-gray-600">₹{inr(row.accumulated)}</td>
                        <td className="text-right px-4 py-2.5 text-xs text-green-600">₹{inr(row.paid)}</td>
                        <td className={`text-right px-4 py-2.5 text-xs font-medium ${row.remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                          ₹{inr(row.remaining)}
                        </td>
                        <td className="text-center px-4 py-2.5"><StatusBadge remaining={row.remaining} /></td>
                        <td className="px-4 py-2.5">
                          {row.remaining > 0 && (
                            <button onClick={() => openModal(row.key)} className="text-xs text-blue-600 hover:underline font-medium">Pay</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Payment History */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-800">Payment History (भुगतान इतिहास)</h2>
            <div className="flex items-center gap-2 text-sm">
              <input type="date"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={histFrom} onChange={(e) => setHistFrom(e.target.value)} />
              <span className="text-gray-400 text-xs">to</span>
              <input type="date"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={histTo} onChange={(e) => setHistTo(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              <IndianRupee className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>कोई भुगतान दर्ज नहीं — &quot;Record Payment&quot; से शुरू करें</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500">
                    <th className="text-left px-5 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-right px-4 py-3 font-medium">Amount</th>
                    <th className="text-left px-4 py-3 font-medium">Mode</th>
                    <th className="text-left px-4 py-3 font-medium">Challan No.</th>
                    <th className="text-left px-4 py-3 font-medium">Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 text-gray-700 whitespace-nowrap">
                        {new Date(h.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                          h.duesType === "MSHK001" || h.duesType === "committee" ? "bg-purple-100 text-purple-700" :
                          h.duesType === "KKFP001" || h.duesType === "kkf"       ? "bg-orange-100 text-orange-700" :
                          GST_CODES.has(h.duesType)                             ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {h.label}
                        </span>
                      </td>
                      <td className="text-right px-4 py-3 font-semibold text-gray-900">₹{inr(h.amount)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {MODE_LABELS[h.mode] ?? h.mode}
                        {h.bankName && <span className="block text-gray-400 text-xs">{h.bankName}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{h.challanNo ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {h.periodFrom && h.periodTo ? `${h.periodFrom} → ${h.periodTo}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <PayModal
        open={modal.open}
        defaultType={modal.type}
        defaultAmount={modal.amount}
        summary={summary}
        bankAccounts={bankAccounts}
        onClose={() => setModal({ open: false })}
        onSuccess={fetchData}
      />
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) return { redirect: { destination: "/login", permanent: false } };
  return { props: {} };
};
