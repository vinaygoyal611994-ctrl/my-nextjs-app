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
import { useRouter } from "next/router";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, Banknote, CreditCard, Smartphone, FileText } from "lucide-react";

interface AccOption { id: number; name: string; }
interface BankAcc { id: number; bankName: string; accountNo: string }

const MODE_OPTIONS = [
  { val: "cash", label: "Cash", icon: Banknote },
  { val: "bank", label: "Bank", icon: CreditCard },
  { val: "upi", label: "UPI", icon: Smartphone },
  { val: "cheque", label: "Cheque", icon: FileText },
];

export default function NewKharchaPage({ expenseAccounts, banks }: { expenseAccounts: AccOption[]; banks: BankAcc[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: todayISO(),
    accountId: "",
    amount: "",
    mode: "cash",
    bankAccountId: banks[0]?.id ? String(banks[0].id) : "",
    narration: "",
  });

  function set(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.accountId) { toast.error("Select an account"); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error("Enter a valid amount"); return; }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        date: form.date,
        accountId: parseInt(form.accountId),
        amount: parseFloat(form.amount),
        mode: form.mode,
        narration: form.narration || undefined,
      };
      if (form.mode !== "cash" && form.bankAccountId) {
        payload.bankAccountId = parseInt(form.bankAccountId);
      }

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Error"); return; }
      toast.success("Expense (खर्चा) recorded successfully");
      router.push("/kharcha");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout title="New Expense (नया खर्चा)">
      <div className="max-w-lg mx-auto space-y-4">
        <Link href="/kharcha" className="inline-flex items-center gap-1 text-sm text-gray-500">
          <ArrowLeft size={14} /> Expense Register (खर्चा रजिस्टर)
        </Link>

        <form onSubmit={submit} className="bg-white rounded-lg border p-5 space-y-5">
          <h2 className="text-lg font-bold text-orange-700">Record New Expense (नया खर्चा दर्ज करें)</h2>

          {/* Date */}
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </div>

          {/* Expense Account */}
          <div className="space-y-1.5">
            <Label>Expense Type (Account)</Label>
            <select
              value={form.accountId}
              onChange={(e) => set("accountId", e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">-- Select Account --</option>
              {expenseAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label>Amount (रकम) (₹)</Label>
            <Input
              type="number" step="0.01" min="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
            />
            {form.amount && parseFloat(form.amount) > 0 && (
              <p className="text-xs text-gray-400">{formatINR(parseFloat(form.amount))}</p>
            )}
          </div>

          {/* Payment Mode */}
          <div className="space-y-1.5">
            <Label>Payment Mode</Label>
            <div className="grid grid-cols-4 gap-2">
              {MODE_OPTIONS.map((m) => (
                <button
                  key={m.val} type="button"
                  onClick={() => set("mode", m.val)}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-xs font-medium transition-colors ${
                    form.mode === m.val
                      ? "bg-orange-600 text-white border-orange-600"
                      : "bg-white text-gray-600 hover:border-orange-400"
                  }`}
                >
                  <m.icon size={16} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bank account dropdown */}
          {form.mode !== "cash" && banks.length > 0 && (
            <div className="space-y-1.5">
              <Label>Bank Account (बैंक खाता)</Label>
              <select
                value={form.bankAccountId}
                onChange={(e) => set("bankAccountId", e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} — A/C ...{b.accountNo.slice(-4)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {form.mode !== "cash" && banks.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
              No bank accounts added. <Link href="/settings/opening-balance" className="underline">Add bank accounts →</Link>
            </p>
          )}

          {/* Narration */}
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Input
              placeholder="e.g. April rent"
              value={form.narration}
              onChange={(e) => set("narration", e.target.value)}
            />
          </div>

          <Button type="submit" disabled={saving} className="w-full bg-orange-600 hover:bg-orange-700">
            {saving ? "Saving..." : "Record Expense (खर्चा दर्ज करें)"}
          </Button>
        </form>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) return { redirect: { destination: "/auth/login", permanent: false } };
  const firmId = session.user.firmId;

  const [accounts, banks] = await Promise.all([
    prisma.account.findMany({
      where: { firmId, type: "expense", active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.bankAccount.findMany({
      where: { firmId, active: true },
      orderBy: { id: "asc" },
      select: { id: true, bankName: true, accountNo: true },
    }),
  ]);

  return { props: { expenseAccounts: accounts, banks } };
};
