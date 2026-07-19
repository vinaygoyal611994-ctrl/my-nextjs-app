import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatINR, formatDate, todayISO } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, Coins, Search, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

interface AdvanceRow {
  id: number; kisanId: number; kisanName: string; kisanVillage: string | null;
  date: string; amount: number; mode: string; byajRatePct: number;
  status: string; amountRecovered: number; outstanding: number;
}
interface KisanOption { id: number; name: string; village: string | null; }
interface BankOption { id: number; bankName: string; accountNo: string; }

const STATUS_LABEL: Record<string, string> = { open: "Open", partial: "Partial", closed: "Closed" };
const STATUS_COLOR: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  partial: "bg-yellow-100 text-yellow-700",
  closed: "bg-green-100 text-green-700",
};
const MODE_LABEL: Record<string, string> = { cash: "Cash", bank: "Bank", upi: "UPI", cheque: "Cheque" };

export default function UchantiPage({
  advances: initAdvances, kisans, byajRate, banks,
}: { advances: AdvanceRow[]; kisans: KisanOption[]; byajRate: number; banks: BankOption[] }) {

  const [advances, setAdvances] = useState(initAdvances);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [kisanQuery, setKisanQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // New advance form
  const [form, setForm] = useState({
    kisanId: "", date: todayISO(), amount: "",
    mode: "cash", bankAccountId: banks[0]?.id ? String(banks[0].id) : "",
    byajRatePct: String(byajRate),
  });

  // Recovery form state per advance
  const [recovery, setRecovery] = useState<Record<number, {
    amount: string; date: string; mode: string; bankAccountId: string; saving: boolean;
  }>>({});

  function setF(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  function initRecovery(a: AdvanceRow) {
    setRecovery((r) => ({
      ...r,
      [a.id]: r[a.id] ?? {
        amount: String(a.outstanding), date: todayISO(),
        mode: "cash", bankAccountId: banks[0]?.id ? String(banks[0].id) : "", saving: false,
      },
    }));
    setExpandedId((prev) => (prev === a.id ? null : a.id));
  }

  function setR(id: number, key: string, val: string) {
    setRecovery((r) => ({ ...r, [id]: { ...r[id], [key]: val } }));
  }

  // Submit new advance
  async function submitAdvance(e: React.FormEvent) {
    e.preventDefault();
    if (!form.kisanId) { toast.error("किसान चुनें"); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error("राशि दर्ज करें"); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        kisanId: parseInt(form.kisanId), date: form.date,
        amount: parseFloat(form.amount), mode: form.mode,
        byajRatePct: parseFloat(form.byajRatePct) || 0,
      };
      if (form.mode !== "cash" && form.bankAccountId) payload.bankAccountId = parseInt(form.bankAccountId);
      const res = await fetch("/api/advances", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Error"); return; }
      toast.success("Advance (उछंती) दर्ज हो गई");
      window.location.reload();
    } finally { setSaving(false); }
  }

  // Submit recovery
  async function submitRecovery(a: AdvanceRow) {
    const r = recovery[a.id];
    if (!r) return;
    if (!r.amount || parseFloat(r.amount) <= 0) { toast.error("राशि दर्ज करें"); return; }
    if (parseFloat(r.amount) > a.outstanding) { toast.error(`राशि बकाया (${formatINR(a.outstanding)}) से अधिक नहीं हो सकती`); return; }

    setRecovery((prev) => ({ ...prev, [a.id]: { ...prev[a.id], saving: true } }));
    try {
      const payload: Record<string, unknown> = {
        amount: parseFloat(r.amount), date: r.date, mode: r.mode,
      };
      if (r.mode !== "cash" && r.bankAccountId) payload.bankAccountId = parseInt(r.bankAccountId);
      const res = await fetch(`/api/advances/${a.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Error"); return; }
      const data = await res.json();
      toast.success(`₹${r.amount} recovered. Status: ${data.newStatus}`);
      // Update local state
      setAdvances((prev) => prev.map((x) =>
        x.id === a.id
          ? { ...x, amountRecovered: data.newRecovered, outstanding: a.amount - data.newRecovered, status: data.newStatus }
          : x
      ).filter((x) => x.status !== "closed"));
      setExpandedId(null);
    } finally {
      setRecovery((prev) => ({ ...prev, [a.id]: { ...prev[a.id], saving: false } }));
    }
  }

  const filteredKisans = kisans.filter(
    (k) => k.name.toLowerCase().includes(kisanQuery.toLowerCase()) || (k.village ?? "").toLowerCase().includes(kisanQuery.toLowerCase())
  );

  const shown = search
    ? advances.filter((a) => a.kisanName.toLowerCase().includes(search.toLowerCase()) || (a.kisanVillage ?? "").toLowerCase().includes(search.toLowerCase()))
    : advances;

  const totalOutstanding = shown.reduce((s, a) => s + a.outstanding, 0);

  return (
    <Layout title="Advance Register (उछंती रजिस्टर)">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Coins size={20} className="text-amber-600" />
            <span className="text-sm text-gray-600">{shown.length} open advances</span>
            {totalOutstanding > 0 && (
              <span className="text-sm font-semibold text-red-600">Outstanding: {formatINR(totalOutstanding)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search farmer..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-44 h-9" />
            </div>
            <Button onClick={() => setShowForm(!showForm)} className="gap-2 bg-amber-600 hover:bg-amber-700">
              <Plus size={16} /> New Advance (नई उछंती)
            </Button>
          </div>
        </div>

        {/* New advance form */}
        {showForm && (
          <form onSubmit={submitAdvance} className="bg-amber-50 rounded-lg border border-amber-200 p-5 space-y-4">
            <h3 className="font-semibold text-amber-800">Record New Advance (नई उछंती दर्ज करें)</h3>

            <div className="space-y-1.5">
              <Label>Farmer (किसान) *</Label>
              <Input placeholder="Search farmer by name / village..." value={kisanQuery}
                onChange={(e) => setKisanQuery(e.target.value)} />
              {kisanQuery && filteredKisans.length > 0 && (
                <div className="border rounded-md bg-white divide-y max-h-48 overflow-y-auto shadow-sm">
                  {filteredKisans.slice(0, 8).map((k) => (
                    <button key={k.id} type="button"
                      onClick={() => { setF("kisanId", String(k.id)); setKisanQuery(`${k.name}${k.village ? ` (${k.village})` : ""}`); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50">
                      <span className="font-medium">{k.name}</span>
                      {k.village && <span className="text-gray-400 ml-2">— {k.village}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setF("date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₹) *</Label>
                <Input type="number" step="0.01" min="0.01" placeholder="0.00"
                  value={form.amount} onChange={(e) => setF("amount", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Mode</Label>
                <select value={form.mode} onChange={(e) => setF("mode", e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm">
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Interest Rate (% / month)</Label>
                <Input type="number" step="0.01" min="0" placeholder="1.5"
                  value={form.byajRatePct} onChange={(e) => setF("byajRatePct", e.target.value)} />
              </div>
            </div>

            {form.mode !== "cash" && banks.length > 0 && (
              <div className="space-y-1.5">
                <Label>Bank Account</Label>
                <select value={form.bankAccountId} onChange={(e) => setF("bankAccountId", e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm">
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>{b.bankName} — …{b.accountNo.slice(-4)}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={saving} className="bg-amber-600 hover:bg-amber-700">
                {saving ? "Saving..." : "Record Advance (उछंती दर्ज करें)"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {/* Advance list */}
        <div className="bg-white rounded-lg border overflow-hidden">
          {shown.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Coins size={40} className="mx-auto mb-3 opacity-30" />
              <p>{search ? "No matching advances" : "No outstanding advances"}</p>
            </div>
          ) : (
            <div className="divide-y">
              {shown.map((a) => {
                const isExpanded = expandedId === a.id;
                const r = recovery[a.id];
                return (
                  <div key={a.id}>
                    {/* Main row */}
                    <div className="px-4 py-3 flex flex-wrap items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{a.kisanName}</span>
                          {a.kisanVillage && <span className="text-xs text-gray-400">— {a.kisanVillage}</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[a.status]}`}>
                            {STATUS_LABEL[a.status]}
                          </span>
                          <span className="text-xs text-gray-400">{MODE_LABEL[a.mode]}</span>
                          <span className="text-xs text-gray-400">{formatDate(a.date)}</span>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-1 text-sm">
                          <span className="text-gray-500">Advance: <span className="font-medium text-gray-700">{formatINR(a.amount)}</span></span>
                          {a.amountRecovered > 0 && (
                            <span className="text-green-600">Recovered: <span className="font-medium">{formatINR(a.amountRecovered)}</span></span>
                          )}
                          <span className="text-red-600 font-semibold">Outstanding: {formatINR(a.outstanding)}</span>
                          {a.byajRatePct > 0 && <span className="text-gray-400 text-xs">Interest: {a.byajRatePct}%/mo</span>}
                        </div>
                      </div>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => initRecovery(a)}
                        className="gap-1 text-xs border-green-300 text-green-700 hover:bg-green-50"
                      >
                        <RotateCcw size={13} />
                        Recover (वापसी)
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </Button>
                    </div>

                    {/* Recovery form */}
                    {isExpanded && r && (
                      <div className="bg-green-50 border-t border-green-200 px-4 py-4">
                        <h4 className="text-sm font-semibold text-green-800 mb-3">
                          Record Recovery — {a.kisanName} (Outstanding: {formatINR(a.outstanding)})
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Amount (₹) *</Label>
                            <Input type="number" step="0.01" min="0.01" max={a.outstanding}
                              value={r.amount} onChange={(e) => setR(a.id, "amount", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Date</Label>
                            <Input type="date" value={r.date} onChange={(e) => setR(a.id, "date", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Mode</Label>
                            <select value={r.mode} onChange={(e) => setR(a.id, "mode", e.target.value)}
                              className="w-full border rounded-md px-2 py-2 text-sm">
                              <option value="cash">Cash</option>
                              <option value="bank">Bank</option>
                              <option value="upi">UPI</option>
                              <option value="cheque">Cheque</option>
                            </select>
                          </div>
                          {r.mode !== "cash" && banks.length > 0 && (
                            <div className="space-y-1">
                              <Label className="text-xs">Bank Account</Label>
                              <select value={r.bankAccountId} onChange={(e) => setR(a.id, "bankAccountId", e.target.value)}
                                className="w-full border rounded-md px-2 py-2 text-sm">
                                {banks.map((b) => (
                                  <option key={b.id} value={b.id}>{b.bankName} …{b.accountNo.slice(-4)}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" disabled={r.saving} onClick={() => submitRecovery(a)}
                            className="bg-green-600 hover:bg-green-700 text-white">
                            {r.saving ? "Saving..." : "Record Recovery (वापसी दर्ज करें)"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setExpandedId(null)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Total */}
        {shown.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex justify-between items-center">
            <span className="font-medium text-gray-600">Total Outstanding (कुल बकाया)</span>
            <span className="text-xl font-bold text-red-600">{formatINR(totalOutstanding)}</span>
          </div>
        )}
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) return { redirect: { destination: "/auth/login", permanent: false } };
  const firmId = session.user.firmId;

  const [advances, kisans, byajSetting, banks] = await Promise.all([
    prisma.advance.findMany({
      where: { firmId, status: { not: "closed" } },
      include: { kisan: { select: { name: true, village: true } } },
      orderBy: { date: "desc" },
      take: 500,
    }),
    prisma.party.findMany({
      where: { firmId, type: "kisan", active: true },
      select: { id: true, name: true, village: true },
      orderBy: { name: "asc" },
    }),
    prisma.setting.findFirst({
      where: { firmId, key: "byaj_pct_month" }, orderBy: { effectiveFrom: "desc" },
    }),
    prisma.bankAccount.findMany({
      where: { firmId, active: true }, orderBy: { id: "asc" },
      select: { id: true, bankName: true, accountNo: true },
    }),
  ]);

  return {
    props: {
      byajRate: parseFloat(byajSetting?.value ?? "1.5"),
      kisans,
      banks,
      advances: advances.map((a) => ({
        id: a.id, kisanId: a.kisanId, kisanName: a.kisan.name, kisanVillage: a.kisan.village,
        date: a.date.toISOString(), amount: Number(a.amount), mode: a.mode,
        byajRatePct: Number(a.byajRatePct), status: a.status,
        amountRecovered: Number(a.amountRecovered),
        outstanding: Number(a.amount) - Number(a.amountRecovered),
      })),
    },
  };
};
