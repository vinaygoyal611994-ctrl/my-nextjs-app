import { useState, useEffect, useCallback } from "react";
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
import { Plus, ShoppingCart, X, IndianRupee, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface PurchaseRow {
  id: number;
  billNo: string;
  date: string;
  kisan: string;
  kisanId: number;
  village: string | null;
  totalAmount: number;
  netPayable: number;
  paid: number;
  purchaseType: string;
  itemCount: number;
}

interface BankAccount {
  id: number;
  bankName: string;
  accountNo: string;
}

type PayStatus = "paid" | "partial" | "pending";

function payStatus(netPayable: number, paid: number): PayStatus {
  if (paid >= netPayable - 0.01) return "paid";
  if (paid > 0) return "partial";
  return "pending";
}

function StatusBadge({ status, paid, netPayable }: { status: PayStatus; paid: number; netPayable: number }) {
  if (status === "paid")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full whitespace-nowrap">
        <CheckCircle2 className="w-3 h-3" /> Paid
      </span>
    );
  if (status === "partial")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full whitespace-nowrap">
        <Clock className="w-3 h-3" /> Partial ({formatINR(paid)} paid)
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">
      <AlertCircle className="w-3 h-3" /> Pending
    </span>
  );
}

function PayModal({
  purchase,
  bankAccounts,
  onClose,
  onSuccess,
}: {
  purchase: PurchaseRow;
  bankAccounts: BankAccount[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const remaining = Math.max(0, purchase.netPayable - purchase.paid);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: remaining.toFixed(2),
    mode: "cash",
    bankAccountId: "",
    narration: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { setErr("रकम सही डालें"); return; }
    if (amt > remaining + 0.01) { setErr(`रकम बाकी रकम (${formatINR(remaining)}) से ज्यादा नहीं हो सकती`); return; }
    if (form.mode !== "cash" && !form.bankAccountId) { setErr("Bank account चुनें"); return; }

    setSaving(true);
    setErr("");
    try {
      const r = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "payment",
          partyId: purchase.kisanId,
          amount: amt,
          date: form.date,
          mode: form.mode,
          bankAccountId: form.bankAccountId ? parseInt(form.bankAccountId) : undefined,
          narration: form.narration || `${purchase.billNo} ka payment`,
          allocations: [{ refType: "purchase", refId: purchase.id, amount: amt }],
        }),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error?.message ?? j.error ?? "Error saving"); return; }
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">Kisan ko Payment</h2>
            <p className="text-xs text-gray-500 mt-0.5">{purchase.billNo} — {purchase.kisan}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {/* Bill summary */}
        <div className="mx-5 mt-4 bg-gray-50 rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <p className="text-gray-400">कुल देय</p>
            <p className="font-bold text-gray-800">{formatINR(purchase.netPayable)}</p>
          </div>
          <div>
            <p className="text-gray-400">दिया जा चुका</p>
            <p className="font-bold text-green-600">{formatINR(purchase.paid)}</p>
          </div>
          <div>
            <p className="text-gray-400">बाकी</p>
            <p className="font-bold text-red-600">{formatINR(remaining)}</p>
          </div>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {err && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{err}</div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date (तारीख)</label>
            <input type="date" required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.date} onChange={(e) => set("date", e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Amount ₹ (रकम)</label>
            <input type="number" step="0.01" min="0.01" required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.amount} onChange={(e) => set("amount", e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mode (तरीका)</label>
            <div className="grid grid-cols-4 gap-2">
              {(["cash", "bank", "upi", "cheque"] as const).map((m) => (
                <button key={m} type="button" onClick={() => set("mode", m)}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    form.mode === m ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  }`}>
                  {m === "cash" ? "Cash" : m === "bank" ? "Bank" : m === "upi" ? "UPI" : "Cheque"}
                </button>
              ))}
            </div>
          </div>

          {form.mode !== "cash" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Bank Account <span className="text-red-500">*</span></label>
              {bankAccounts.length === 0 ? (
                <p className="text-xs text-red-500">कोई bank account नहीं मिला</p>
              ) : (
                <select required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.bankAccountId} onChange={(e) => set("bankAccountId", e.target.value)}>
                  <option value="">— Bank चुनें —</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={String(b.id)}>{b.bankName} — {b.accountNo.slice(-4).padStart(b.accountNo.length, "*")}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Narration (वैकल्पिक)</label>
            <input type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Note..." value={form.narration} onChange={(e) => set("narration", e.target.value)} />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving || remaining <= 0}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : "Pay Kisan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function KharidRegister({ purchases: initial }: { purchases: PurchaseRow[] }) {
  const router = useRouter();
  const [purchases, setPurchases] = useState(initial);
  const [modal, setModal] = useState<PurchaseRow | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  useEffect(() => {
    fetch("/api/bank-accounts")
      .then((r) => r.json())
      .then((d) => setBankAccounts(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Keep local state in sync when props change (after router.replace)
  useEffect(() => { setPurchases(initial); }, [initial]);

  function handlePaySuccess() {
    router.replace(router.asPath); // re-run GSSP to get fresh paid amounts
  }

  return (
    <Layout title="Purchase Register (खरीद रजिस्टर)">
      {modal && (
        <PayModal
          purchase={modal}
          bankAccounts={bankAccounts}
          onClose={() => setModal(null)}
          onSuccess={handlePaySuccess}
        />
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-600">
            <ShoppingCart size={18} />
            <span className="text-sm">{purchases.length} Slips (परचियाँ)</span>
          </div>
          <Link href="/kharid/new">
            <Button className="gap-2"><Plus size={16} /> New Purchase (नई खरीद)</Button>
          </Link>
        </div>

        <div className="bg-white rounded-lg border overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Slip No. (परची नं.)</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Farmer (किसान)</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Village</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Payable (देय)</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Payment Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Type</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {purchases.map((p) => {
                  const status = payStatus(p.netPayable, p.paid);
                  const remaining = Math.max(0, p.netPayable - p.paid);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/kharid/${p.id}`} className="text-primary hover:underline font-medium">
                          {p.billNo}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(p.date)}</td>
                      <td className="px-4 py-3 font-medium">{p.kisan}</td>
                      <td className="px-4 py-3 text-gray-500">{p.village ?? "—"}</td>
                      <td className="px-4 py-3 text-right">{formatINR(p.totalAmount)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">{formatINR(p.netPayable)}</td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={status} paid={p.paid} netPayable={p.netPayable} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={p.purchaseType === "khud" ? "default" : "secondary"}>
                          {p.purchaseType === "khud" ? "Own" : "Commission"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {status !== "paid" && (
                          <button
                            onClick={() => setModal(p)}
                            className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 font-medium whitespace-nowrap"
                          >
                            Pay ₹{formatINR(remaining)}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="md:hidden divide-y">
            {purchases.map((p) => {
              const status = payStatus(p.netPayable, p.paid);
              const remaining = Math.max(0, p.netPayable - p.paid);
              return (
                <div key={p.id} className="px-4 py-3">
                  <div className="flex justify-between items-start mb-1">
                    <Link href={`/kharid/${p.id}`} className="font-semibold text-primary hover:underline">
                      {p.billNo}
                    </Link>
                    <span className="text-gray-400 text-sm">{formatDate(p.date)}</span>
                  </div>
                  <p className="font-medium">{p.kisan} {p.village ? `— ${p.village}` : ""}</p>
                  <div className="flex justify-between mt-1 text-sm">
                    <span className="text-gray-500">Amount: {formatINR(p.totalAmount)}</span>
                    <span className="font-semibold text-green-600">Payable: {formatINR(p.netPayable)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <StatusBadge status={status} paid={p.paid} netPayable={p.netPayable} />
                    {status !== "paid" && (
                      <button onClick={() => setModal(p)}
                        className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 font-medium">
                        Pay ₹{formatINR(remaining)}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {purchases.length === 0 && (
            <div className="py-16 text-center text-gray-400">
              <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
              <p>No purchases found</p>
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

  // Ensure invoice_payments table exists
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      firm_id INT NOT NULL,
      payment_receipt_id INT NOT NULL,
      ref_type VARCHAR(20) NOT NULL,
      ref_id INT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_firm (firm_id),
      INDEX idx_payment (payment_receipt_id),
      INDEX idx_invoice (ref_type, ref_id)
    )
  `).catch(() => {});

  // Fetch paid amounts from invoice_payments for all purchase bills
  type PaidRow = { ref_id: bigint; paid: string };
  const paidRows = await prisma.$queryRaw<PaidRow[]>`
    SELECT ref_id, COALESCE(SUM(amount), 0) AS paid
    FROM invoice_payments
    WHERE firm_id = ${firmId} AND ref_type = 'purchase'
    GROUP BY ref_id
  `.catch(() => [] as PaidRow[]);

  const paidMap = new Map(paidRows.map((r) => [Number(r.ref_id), Number(r.paid)]));

  const purchases = await prisma.purchase.findMany({
    where: { firmId, cancelled: false },
    include: {
      kisan: { select: { id: true, name: true, village: true } },
      items: { select: { id: true } },
    },
    orderBy: { date: "desc" },
    take: 200,
  });

  return {
    props: {
      purchases: purchases.map((p) => ({
        id: p.id,
        billNo: p.billNo,
        date: p.date.toISOString(),
        kisan: p.kisan.name,
        kisanId: p.kisan.id,
        village: p.kisan.village,
        totalAmount: Number(p.totalAmount),
        netPayable: Number(p.netPayable),
        paid: paidMap.get(p.id) ?? 0,
        purchaseType: p.purchaseType,
        itemCount: p.items.length,
      })),
    },
  };
};
