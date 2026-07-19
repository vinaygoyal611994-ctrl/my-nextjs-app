import { useState, useEffect } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatINR } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft, Wallet, Building2, Info, CheckCircle, Plus, Trash2,
} from "lucide-react";

interface BankAccount {
  id: number; bankName: string; accountNo: string; ifsc: string | null;
  accountId: number; accountName: string;
}

interface Party {
  id: number; name: string; type: string;
  openingBalance: number; openingType: string;
}

interface Props {
  fyStart: string; firmName: string;
  bankAccounts: BankAccount[];
  parties: Party[];
}

export default function OpeningBalancePage({ fyStart, firmName, bankAccounts: initBanks, parties }: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cash, setCash] = useState("");
  const [date, setDate] = useState(fyStart);
  const [banks, setBanks] = useState<BankAccount[]>(initBanks);
  const [bankAmounts, setBankAmounts] = useState<Record<number, string>>({});

  // New bank form
  const [showAddBank, setShowAddBank] = useState(false);
  const [newBank, setNewBank] = useState({ bankName: "", accountNo: "", ifsc: "" });
  const [addingBank, setAddingBank] = useState(false);

  // Load existing opening balance
  useEffect(() => {
    fetch("/api/settings/opening-balance").then((r) => r.json()).then((d) => {
      if (d.exists) {
        setCash(d.cash > 0 ? String(d.cash) : "");
        setDate(d.date ?? fyStart);
        setSaved(true);
        const amts: Record<number, string> = {};
        for (const b of d.banks ?? []) {
          if (b.amount > 0) amts[b.accountId] = String(b.amount);
        }
        setBankAmounts(amts);
      }
    });
  }, [fyStart]);

  const cashAmt = parseFloat(cash) || 0;
  const bankTotal = banks.reduce((s, b) => s + (parseFloat(bankAmounts[b.accountId] ?? "") || 0), 0);
  const totalAssets = cashAmt + bankTotal;

  const partyDr = parties.filter((p) => p.openingType === "Dr").reduce((s, p) => s + p.openingBalance, 0);
  const partyCr = parties.filter((p) => p.openingType === "Cr").reduce((s, p) => s + p.openingBalance, 0);
  const capital = totalAssets + partyDr - partyCr;

  async function save() {
    if (totalAssets === 0) { toast.error("Enter at least one amount"); return; }
    setSaving(true);
    try {
      const payload = {
        cash: cashAmt,
        date,
        banks: banks.map((b) => ({
          accountId: b.accountId,
          amount: parseFloat(bankAmounts[b.accountId] ?? "") || 0,
        })),
      };
      const res = await fetch("/api/settings/opening-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Error"); return; }
      toast.success("Opening balance saved successfully!");
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function addBank() {
    if (!newBank.bankName || !newBank.accountNo) { toast.error("Bank name and account number required"); return; }
    setAddingBank(true);
    try {
      const res = await fetch("/api/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBank),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Error"); return; }
      const created = await res.json();
      setBanks((prev) => [...prev, {
        id: created.id, bankName: created.bankName, accountNo: created.accountNo,
        ifsc: created.ifsc, accountId: created.accountId, accountName: created.account.name,
      }]);
      setNewBank({ bankName: "", accountNo: "", ifsc: "" });
      setShowAddBank(false);
      toast.success(`${created.bankName} added!`);
    } finally {
      setAddingBank(false);
    }
  }

  const kisans = parties.filter((p) => p.type === "kisan" && p.openingBalance > 0);
  const vyaparis = parties.filter((p) => p.type === "vyapari" && p.openingBalance > 0);

  return (
    <Layout title="Opening Balance Setup">
      <div className="max-w-2xl mx-auto space-y-5">

        <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={14} /> Back to Settings
        </Link>

        {/* Info banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Info size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">Opening Balance Setup — FY Start ({fyStart})</p>
            <p className="text-sm text-amber-700 mt-1">
              Enter cash and all bank balances of <strong>{firmName}</strong> on the first day of the financial year.
              Party balances are set from the Account Book individually.
            </p>
          </div>
        </div>

        {saved && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle size={16} /> Opening balance already saved — you can update it below.
          </div>
        )}

        {/* Main entry form */}
        <div className="bg-white rounded-xl border p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Cash &amp; Bank Balances</h2>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Opening Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44 h-8 text-sm" />
            </div>
          </div>

          {/* Cash */}
          <div className="flex items-center gap-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
            <div className="p-2 bg-amber-100 rounded-lg shrink-0">
              <Wallet size={18} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm text-gray-700">Cash in Hand (नकद हाथ में)</p>
              <p className="text-xs text-gray-400">Physical cash with the owner</p>
            </div>
            <div className="w-44">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                <Input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={cash} onChange={(e) => setCash(e.target.value)}
                  className="pl-7 text-right font-semibold"
                />
              </div>
              {cashAmt > 0 && <p className="text-xs text-amber-600 text-right mt-1">{formatINR(cashAmt)}</p>}
            </div>
          </div>

          {/* Bank accounts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm text-gray-700">Bank Accounts (बैंक खाते)</p>
              <button
                onClick={() => setShowAddBank(!showAddBank)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus size={13} /> Add Bank Account
              </button>
            </div>

            {/* Add bank form */}
            {showAddBank && (
              <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
                <p className="text-sm font-medium text-blue-800">Add New Bank Account</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Bank Name *</Label>
                    <Input
                      placeholder="e.g. SBI, HDFC, PNB"
                      value={newBank.bankName}
                      onChange={(e) => setNewBank((p) => ({ ...p, bankName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Account Number *</Label>
                    <Input
                      placeholder="Account No."
                      value={newBank.accountNo}
                      onChange={(e) => setNewBank((p) => ({ ...p, accountNo: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">IFSC Code (optional)</Label>
                  <Input
                    placeholder="SBIN0001234"
                    value={newBank.ifsc}
                    onChange={(e) => setNewBank((p) => ({ ...p, ifsc: e.target.value }))}
                    className="w-48"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addBank} disabled={addingBank} className="bg-blue-600 hover:bg-blue-700">
                    {addingBank ? "Adding..." : "Add Bank"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddBank(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {/* Bank list */}
            {banks.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-400 text-sm">
                No bank accounts added yet.
                <button onClick={() => setShowAddBank(true)} className="ml-1 text-blue-600 hover:underline">
                  Add your first bank account →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {banks.map((b) => (
                  <div key={b.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border">
                    <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                      <Building2 size={16} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-700">{b.bankName}</p>
                      <p className="text-xs text-gray-400">A/C: {b.accountNo}{b.ifsc ? ` · ${b.ifsc}` : ""}</p>
                    </div>
                    <div className="w-44">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                        <Input
                          type="number" min="0" step="0.01" placeholder="0.00"
                          value={bankAmounts[b.accountId] ?? ""}
                          onChange={(e) => setBankAmounts((prev) => ({ ...prev, [b.accountId]: e.target.value }))}
                          className="pl-7 text-right font-semibold"
                        />
                      </div>
                      {(parseFloat(bankAmounts[b.accountId] ?? "") || 0) > 0 && (
                        <p className="text-xs text-blue-600 text-right mt-1">
                          {formatINR(parseFloat(bankAmounts[b.accountId] ?? "") || 0)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg border p-4 space-y-2 text-sm">
            <p className="font-semibold text-gray-700 mb-3">Summary</p>
            {cashAmt > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Cash in Hand</span>
                <span className="font-medium">{formatINR(cashAmt)}</span>
              </div>
            )}
            {banks.map((b) => {
              const amt = parseFloat(bankAmounts[b.accountId] ?? "") || 0;
              if (!amt) return null;
              return (
                <div key={b.id} className="flex justify-between">
                  <span className="text-gray-500">{b.bankName} (A/C: ...{b.accountNo.slice(-4)})</span>
                  <span className="font-medium">{formatINR(amt)}</span>
                </div>
              );
            })}
            {partyDr > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Party Receivables (you will receive)</span>
                <span className="font-medium text-green-600">+ {formatINR(partyDr)}</span>
              </div>
            )}
            {partyCr > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Party Payables (you owe them)</span>
                <span className="font-medium text-red-600">− {formatINR(partyCr)}</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between font-bold text-base">
              <span>Owner Capital (मालिक पूँजी)</span>
              <span className="text-amber-700">{formatINR(capital)}</span>
            </div>
          </div>

          <Button onClick={save} disabled={saving} className="w-full bg-amber-600 hover:bg-amber-700 text-white h-11">
            {saving ? "Saving..." : saved ? "Update Opening Balance" : "Save Opening Balance"}
          </Button>
        </div>

        {/* Party balances */}
        {(kisans.length > 0 || vyaparis.length > 0) && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-700 text-sm">Party Opening Balances</h3>
              <Link href="/khata" className="text-xs text-amber-600 hover:underline">
                Edit in Account Book →
              </Link>
            </div>
            <div className="divide-y">
              {kisans.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-green-50 text-xs font-semibold text-green-700 uppercase tracking-wide">
                    Farmers (किसान) — {kisans.length}
                  </div>
                  {kisans.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50">
                      <Link href={`/khata/${p.id}/edit`} className="text-gray-700 hover:text-amber-600">{p.name}</Link>
                      <span className={p.openingType === "Dr" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        {formatINR(p.openingBalance)} {p.openingType === "Dr" ? "Receivable" : "Payable"}
                      </span>
                    </div>
                  ))}
                </>
              )}
              {vyaparis.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-blue-50 text-xs font-semibold text-blue-700 uppercase tracking-wide">
                    Traders (व्यापारी) — {vyaparis.length}
                  </div>
                  {vyaparis.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50">
                      <Link href={`/khata/${p.id}/edit`} className="text-gray-700 hover:text-amber-600">{p.name}</Link>
                      <span className={p.openingType === "Dr" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        {formatINR(p.openingBalance)} {p.openingType === "Dr" ? "Receivable" : "Payable"}
                      </span>
                    </div>
                  ))}
                </>
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
  if (session.user.role !== "malik") return { redirect: { destination: "/", permanent: false } };

  const firmId = session.user.firmId;

  const [firm, bankAccounts, parties] = await Promise.all([
    prisma.firm.findUnique({ where: { id: firmId }, select: { name: true, fyStart: true } }),
    prisma.bankAccount.findMany({
      where: { firmId, active: true },
      include: { account: { select: { id: true, name: true } } },
      orderBy: { id: "asc" },
    }),
    prisma.party.findMany({
      where: { firmId, active: true, type: { in: ["kisan", "vyapari"] } },
      select: { id: true, name: true, type: true, openingBalance: true, openingType: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    props: {
      fyStart: firm?.fyStart.toISOString().slice(0, 10) ?? "2026-04-01",
      firmName: firm?.name ?? "",
      bankAccounts: bankAccounts.map((b) => ({
        id: b.id, bankName: b.bankName, accountNo: b.accountNo, ifsc: b.ifsc,
        accountId: b.accountId!, accountName: b.account?.name ?? b.bankName,
      })),
      parties: parties.map((p) => ({
        id: p.id, name: p.name, type: p.type,
        openingBalance: Number(p.openingBalance), openingType: p.openingType,
      })),
    },
  };
};
