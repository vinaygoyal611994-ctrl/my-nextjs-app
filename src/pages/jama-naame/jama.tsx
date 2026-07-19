import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayISO } from "@/lib/utils";
import { Loader2, ArrowLeft, Banknote, CreditCard, Smartphone, FileText, Receipt, CheckSquare } from "lucide-react";
import Link from "next/link";

interface Party { id: number; name: string; type: string; village: string | null }
interface BankAcc { id: number; bankName: string; accountNo: string }
interface OutstandingInvoice {
  id: number;
  billNo: string;
  date: string;
  total: number;
  paid: number;
  remaining: number;
  refType: "sale";
}

const schema = z.object({
  partyId: z.coerce.number().int().min(1, "Select a party"),
  amount: z.coerce.number().positive("Amount is required"),
  mode: z.enum(["cash", "bank", "upi", "cheque"]),
  date: z.string(),
  chequeNo: z.string().optional(),
  chequeDate: z.string().optional(),
  narration: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const MODE_OPTIONS = [
  { value: "cash",   label: "Cash",   icon: Banknote },
  { value: "bank",   label: "Bank",   icon: CreditCard },
  { value: "upi",    label: "UPI",    icon: Smartphone },
  { value: "cheque", label: "Cheque", icon: FileText },
];

function inr(v: number) {
  return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function JamaPage({ parties, banks, defaultPartyId }: { parties: Party[]; banks: BankAcc[]; defaultPartyId?: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showList, setShowList] = useState(false);
  const [bankAccountId, setBankAccountId] = useState<string>(banks[0]?.id ? String(banks[0].id) : "");

  // Invoice allocation state
  const [outstanding, setOutstanding] = useState<OutstandingInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [allocations, setAllocations] = useState<Map<number, number>>(new Map()); // invoiceId → amount

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { partyId: defaultPartyId ?? 0, mode: "cash", date: todayISO() },
  });

  const watchMode    = watch("mode");
  const watchPartyId = watch("partyId");
  const selectedParty = parties.find((p) => p.id === Number(watchPartyId));

  const filtered = search
    ? parties.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.village?.toLowerCase().includes(search.toLowerCase()))
    : parties.slice(0, 20);

  // Fetch outstanding invoices when party changes (only for vyapari)
  useEffect(() => {
    if (!watchPartyId || watchPartyId === 0) {
      setOutstanding([]);
      setAllocations(new Map());
      return;
    }
    const party = parties.find((p) => p.id === Number(watchPartyId));
    if (party?.type !== "vyapari") {
      setOutstanding([]);
      setAllocations(new Map());
      return;
    }
    setLoadingInvoices(true);
    fetch(`/api/payments/outstanding?partyId=${watchPartyId}&voucherType=receipt`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setOutstanding(Array.isArray(data) ? data : []))
      .catch(() => setOutstanding([]))
      .finally(() => setLoadingInvoices(false));
    setAllocations(new Map());
  }, [watchPartyId, parties]);

  const allocatedTotal = Array.from(allocations.values()).reduce((s, v) => s + v, 0);

  function toggleInvoice(inv: OutstandingInvoice, checked: boolean) {
    setAllocations((prev) => {
      const next = new Map(prev);
      if (checked) next.set(inv.id, inv.remaining);
      else next.delete(inv.id);
      const newTotal = Array.from(next.values()).reduce((s, v) => s + v, 0);
      if (next.size > 0) setValue("amount", Math.round(newTotal * 100) / 100);
      return next;
    });
  }

  function updateAllocationAmount(id: number, value: string) {
    const num = parseFloat(value) || 0;
    setAllocations((prev) => {
      const next = new Map(prev);
      if (num > 0) next.set(id, num);
      else next.delete(id);
      const newTotal = Array.from(next.values()).reduce((s, v) => s + v, 0);
      if (next.size > 0) setValue("amount", Math.round(newTotal * 100) / 100);
      return next;
    });
  }

  function selectAllInvoices() {
    const next = new Map(outstanding.map((inv) => [inv.id, inv.remaining]));
    setAllocations(next);
    const total = outstanding.reduce((s, inv) => s + inv.remaining, 0);
    setValue("amount", Math.round(total * 100) / 100);
  }

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const allocationsList = outstanding
        .filter((inv) => allocations.has(inv.id))
        .map((inv) => ({
          refType: inv.refType,
          refId: inv.id,
          amount: allocations.get(inv.id)!,
        }));

      const payload: Record<string, unknown> = { ...data, type: "receipt" };
      if (data.mode !== "cash" && bankAccountId) payload.bankAccountId = parseInt(bankAccountId);
      if (allocationsList.length) payload.allocations = allocationsList;

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Error");
      const { voucherNo } = await res.json();
      toast.success(`Receipt (जमा) ${voucherNo} saved!`);
      router.push("/jama-naame");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout title="New Receipt (जमा)">
      <div className="max-w-lg mx-auto">
        <Link href="/jama-naame" className="inline-flex items-center gap-1 text-sm text-gray-500 mb-4">
          <ArrowLeft size={14} /> Receipt & Payment (जमा-नामे)
        </Link>

        <div className="bg-white rounded-lg border p-5 space-y-4">
          <h2 className="font-semibold text-green-700 flex items-center gap-2">
            <Receipt size={18} /> Receipt (जमा) — Money Received
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Party selector */}
            <div className="space-y-1.5 relative">
              <Label>Trader / Farmer *</Label>
              {selectedParty ? (
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                  <div>
                    <p className="font-semibold">{selectedParty.name}</p>
                    {selectedParty.village && <p className="text-xs text-gray-500">{selectedParty.village}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setValue("partyId", 0); setSearch(""); setOutstanding([]); setAllocations(new Map()); }}
                    className="text-xs text-red-500"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div>
                  <Input
                    placeholder="Search by name or village..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setShowList(true); }}
                    onFocus={() => setShowList(true)}
                  />
                  {showList && (
                    <div className="absolute z-20 left-0 right-0 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                      {filtered.length === 0 && <div className="px-3 py-2 text-sm text-gray-400">No party found</div>}
                      {filtered.map((p) => (
                        <button key={p.id} type="button"
                          className="w-full text-left px-3 py-2 hover:bg-amber-50 text-sm"
                          onClick={() => { setValue("partyId", p.id); setSearch(p.name); setShowList(false); }}>
                          <span className="font-medium">{p.name}</span>
                          {p.village && <span className="text-gray-400 ml-1">— {p.village}</span>}
                          <span className="text-xs text-gray-300 ml-2">{p.type}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {errors.partyId && <p className="text-xs text-red-500">Select a party</p>}
            </div>

            {/* Outstanding invoices (only for vyapari) */}
            {selectedParty?.type === "vyapari" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-gray-700">Outstanding Bills (बकाया बिल)</Label>
                  {outstanding.length > 0 && (
                    <button
                      type="button"
                      onClick={selectAllInvoices}
                      className="text-xs text-green-600 flex items-center gap-1 hover:underline"
                    >
                      <CheckSquare size={12} /> Select All
                    </button>
                  )}
                </div>

                {loadingInvoices ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-3 border rounded-lg px-3">
                    <Loader2 size={14} className="animate-spin" /> Loading invoices...
                  </div>
                ) : outstanding.length === 0 ? (
                  <div className="text-sm text-gray-400 bg-gray-50 border rounded-lg px-3 py-2.5">
                    No pending invoices — or skip allocation and enter amount below
                  </div>
                ) : (
                  <div className="border rounded-lg divide-y max-h-52 overflow-y-auto">
                    {outstanding.map((inv) => {
                      const isChecked = allocations.has(inv.id);
                      const allocAmt  = allocations.get(inv.id) ?? inv.remaining;
                      return (
                        <div key={inv.id} className={`flex items-center gap-3 px-3 py-2.5 ${isChecked ? "bg-green-50" : "hover:bg-gray-50"}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => toggleInvoice(inv, e.target.checked)}
                            className="accent-green-600 w-4 h-4 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono bg-green-100 text-green-800 px-1.5 py-0.5 rounded">{inv.billNo}</span>
                              <span className="text-xs text-gray-400">
                                {new Date(inv.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              Total ₹{inr(inv.total)}
                              {inv.paid > 0 && <> · Paid ₹{inr(inv.paid)}</>}
                              {" · "}<span className="text-orange-600 font-medium">Due ₹{inr(inv.remaining)}</span>
                            </div>
                          </div>
                          {isChecked && (
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max={inv.remaining}
                              value={allocAmt}
                              onChange={(e) => updateAllocationAmount(inv.id, e.target.value)}
                              className="w-28 border border-green-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {allocations.size > 0 && (
                  <div className="flex justify-between text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <span className="text-gray-600">{allocations.size} bill{allocations.size > 1 ? "s" : ""} selected</span>
                    <span className="font-semibold text-green-700">Allocated: ₹{inr(allocatedTotal)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Amount + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="amount">
                  Amount (रकम) (₹) *
                  {allocations.size > 0 && <span className="text-xs text-green-600 ml-1">(auto-filled)</span>}
                </Label>
                <Input id="amount" type="number" step="0.01" min="0" {...register("amount")} placeholder="0.00" />
                {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" {...register("date")} />
              </div>
            </div>

            {/* Payment mode */}
            <div className="space-y-1.5">
              <Label>Payment Mode</Label>
              <div className="grid grid-cols-4 gap-2">
                {MODE_OPTIONS.map((m) => (
                  <label key={m.value} className="cursor-pointer">
                    <input type="radio" value={m.value} {...register("mode")} className="sr-only" />
                    <div className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-colors ${
                      watchMode === m.value
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-green-400"
                    }`}>
                      <m.icon size={16} />
                      {m.label}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Bank account dropdown */}
            {watchMode !== "cash" && banks.length > 0 && (
              <div className="space-y-1.5">
                <Label>Bank Account (बैंक खाता)</Label>
                <select
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} — A/C ...{b.accountNo.slice(-4)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {watchMode !== "cash" && banks.length === 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
                No bank accounts added.{" "}
                <Link href="/settings/opening-balance" className="underline">Add bank accounts →</Link>
              </p>
            )}

            {watchMode === "cheque" && (
              <div className="grid grid-cols-2 gap-3 border rounded-md p-3 bg-gray-50">
                <div className="space-y-1">
                  <Label>Cheque Number</Label>
                  <Input {...register("chequeNo")} placeholder="123456" />
                </div>
                <div className="space-y-1">
                  <Label>Cheque Date</Label>
                  <Input type="date" {...register("chequeDate")} />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="narration">Remarks (optional)</Label>
              <Input id="narration" {...register("narration")} placeholder="Optional..." />
            </div>

            <Button type="submit" disabled={loading} className="w-full h-11 bg-green-600 hover:bg-green-700">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Receipt (जमा सेव करें)
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

  const [parties, banks] = await Promise.all([
    prisma.party.findMany({
      where: { firmId, active: true, type: { in: ["vyapari", "kisan", "other"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true, village: true },
    }),
    prisma.bankAccount.findMany({
      where: { firmId, active: true },
      orderBy: { id: "asc" },
      select: { id: true, bankName: true, accountNo: true },
    }),
  ]);

  return {
    props: {
      parties,
      banks,
      defaultPartyId: ctx.query.partyId ? parseInt(ctx.query.partyId as string) : null,
    },
  };
};
