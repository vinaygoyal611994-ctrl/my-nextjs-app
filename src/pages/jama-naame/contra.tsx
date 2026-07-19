import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatINR, todayISO } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, ArrowLeftRight, Building2, Wallet } from "lucide-react";
import { useRouter } from "next/router";

interface BankAccount {
  id: number;
  bankName: string;
  accountNo: string;
  balance: number;
}

interface CashBalance {
  balance: number;
}

export default function ContraPage({
  banks,
  cashBalance,
}: {
  banks: BankAccount[];
  cashBalance: number;
}) {
  const router = useRouter();
  const [direction, setDirection] = useState<"bank_to_cash" | "cash_to_bank">("bank_to_cash");
  const [form, setForm] = useState({
    date: todayISO(),
    amount: "",
    bankAccountId: banks[0]?.id ? String(banks[0].id) : "",
    narration: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const selectedBank = banks.find((b) => String(b.id) === form.bankAccountId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { setErr("सही रकम डालें"); return; }
    if (!form.bankAccountId) { setErr("Bank account चुनें"); return; }
    if (direction === "bank_to_cash" && selectedBank && amt > selectedBank.balance + 0.01) {
      setErr(`Bank balance ₹${selectedBank.balance.toLocaleString("en-IN", { maximumFractionDigits: 2 })} से ज्यादा नहीं निकाल सकते`);
      return;
    }
    if (direction === "cash_to_bank" && amt > cashBalance + 0.01) {
      setErr(`Cash in Hand ₹${cashBalance.toLocaleString("en-IN", { maximumFractionDigits: 2 })} से ज्यादा नहीं जमा कर सकते`);
      return;
    }
    setSaving(true); setErr(""); setSuccess("");

    try {
      const r = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "contra",
          // mode encodes direction: "cash" = bank→cash, "bank" = cash→bank
          mode: direction === "bank_to_cash" ? "cash" : "bank",
          bankAccountId: Number(form.bankAccountId),
          amount: amt,
          date: form.date,
          narration: form.narration ||
            (direction === "bank_to_cash"
              ? `Bank withdrawal — ${selectedBank?.bankName}`
              : `Cash deposit — ${selectedBank?.bankName}`),
        }),
      });
      if (!r.ok) {
        const j = await r.json();
        setErr(j.error?.message ?? "Error saving entry");
        return;
      }
      const j = await r.json();
      setSuccess(`Contra entry saved — ${j.voucherNo}`);
      setForm((f) => ({ ...f, amount: "", narration: "" }));
      setTimeout(() => router.push("/jama-naame"), 1200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout title="Bank ↔ Cash Transfer (Contra)">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/jama-naame" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>

        <div className="bg-white rounded-lg border p-5 space-y-5">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={18} className="text-purple-600" />
            <h2 className="font-semibold text-gray-800">Bank ↔ Cash Transfer (Contra Entry)</h2>
          </div>

          {/* Current balances */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Wallet size={14} className="text-green-600" />
                <span className="text-xs text-green-700 font-medium">Cash in Hand</span>
              </div>
              <p className="font-bold text-green-700">{formatINR(cashBalance)}</p>
            </div>
            {selectedBank && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Building2 size={14} className="text-blue-600" />
                  <span className="text-xs text-blue-700 font-medium">{selectedBank.bankName}</span>
                </div>
                <p className="font-bold text-blue-700">{formatINR(selectedBank.balance)}</p>
              </div>
            )}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {err && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-md px-3 py-2">{err}</div>}
            {success && <div className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-md px-3 py-2">{success}</div>}

            {/* Direction */}
            <div className="space-y-2">
              <Label>Transfer Direction (दिशा)</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection("bank_to_cash")}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border-2 text-sm transition-colors ${
                    direction === "bank_to_cash"
                      ? "border-purple-500 bg-purple-50 text-purple-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <span className="text-lg">🏦 → 💵</span>
                  <span className="font-medium">Bank → Cash</span>
                  <span className="text-xs opacity-70">Cheque निकासी / ATM</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("cash_to_bank")}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border-2 text-sm transition-colors ${
                    direction === "cash_to_bank"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <span className="text-lg">💵 → 🏦</span>
                  <span className="font-medium">Cash → Bank</span>
                  <span className="text-xs opacity-70">Bank में जमा</span>
                </button>
              </div>
            </div>

            {/* Bank account */}
            {banks.length === 0 ? (
              <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3">
                कोई Bank Account नहीं है।{" "}
                <Link href="/settings/opening-balance" className="underline font-medium">Bank Account जोड़ें →</Link>
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label>Bank Account</Label>
                <select
                  value={form.bankAccountId}
                  onChange={(e) => set("bankAccountId", e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} — A/C ...{b.accountNo.slice(-4)} ({formatINR(b.balance)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Narration (optional)</Label>
              <Input
                placeholder={direction === "bank_to_cash" ? "e.g. PNB cheque withdrawal" : "e.g. Cash deposit PNB"}
                value={form.narration}
                onChange={(e) => set("narration", e.target.value)}
              />
            </div>

            {/* Summary */}
            {form.amount && parseFloat(form.amount) > 0 && (
              <div className="bg-gray-50 border rounded-md p-3 text-sm text-gray-600 space-y-1">
                <p className="font-medium text-gray-700">Journal Entry Preview:</p>
                {direction === "bank_to_cash" ? (
                  <>
                    <p>Cash in Hand <span className="font-semibold text-green-700">Dr ₹{parseFloat(form.amount).toLocaleString("en-IN")}</span></p>
                    <p>{selectedBank?.bankName ?? "Bank"} <span className="font-semibold text-red-600">Cr ₹{parseFloat(form.amount).toLocaleString("en-IN")}</span></p>
                  </>
                ) : (
                  <>
                    <p>{selectedBank?.bankName ?? "Bank"} <span className="font-semibold text-green-700">Dr ₹{parseFloat(form.amount).toLocaleString("en-IN")}</span></p>
                    <p>Cash in Hand <span className="font-semibold text-red-600">Cr ₹{parseFloat(form.amount).toLocaleString("en-IN")}</span></p>
                  </>
                )}
              </div>
            )}

            <Button
              type="submit"
              disabled={saving || banks.length === 0}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {saving ? "Saving..." : "Save Contra Entry (दर्ज करें)"}
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) return { redirect: { destination: "/auth/login", permanent: false } };
  const firmId = session.user.firmId;

  // Fetch bank accounts with their current GL balance
  type BankRow = { id: bigint; bank_name: string; account_no: string; balance: string };
  const bankRows = await prisma.$queryRaw<BankRow[]>`
    SELECT
      ba.id, ba.bank_name, ba.account_no,
      COALESCE(SUM(CASE WHEN je.cancelled = 0 THEN jl.debit - jl.credit ELSE 0 END), 0) AS balance
    FROM bank_accounts ba
    LEFT JOIN accounts a ON a.id = ba.account_id AND a.firm_id = ${firmId}
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE ba.firm_id = ${firmId} AND ba.active = 1
    GROUP BY ba.id, ba.bank_name, ba.account_no
    ORDER BY ba.id ASC
  `;

  // Fetch cash in hand balance
  type CashRow = { balance: string };
  const cashRows = await prisma.$queryRaw<CashRow[]>`
    SELECT COALESCE(SUM(CASE WHEN je.cancelled = 0 THEN jl.debit - jl.credit ELSE 0 END), 0) AS balance
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE a.firm_id = ${firmId} AND a.sub_type = 'cash' AND a.is_system = 1
  `;

  const banks: BankAccount[] = bankRows.map((r) => ({
    id: Number(r.id),
    bankName: r.bank_name,
    accountNo: r.account_no,
    balance: Number(r.balance),
  }));

  return {
    props: {
      banks,
      cashBalance: Number(cashRows[0]?.balance ?? 0),
    },
  };
};
