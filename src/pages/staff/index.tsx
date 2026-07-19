import { useState } from "react";
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
import { Users, Plus, IndianRupee, Banknote, Smartphone, CreditCard } from "lucide-react";

interface StaffMember {
  id: number;
  name: string;
  mobile: string | null;
  monthlySalary: number | null;
  totalPaid: number;
  thisMonthPaid: number;
}

interface BankAccount {
  id: number; bankName: string; accountNo: string; glAccountId: number;
}

interface Props {
  staff: StaffMember[];
  banks: BankAccount[];
  currentMonth: string; // "2026-07"
}

const MODE_OPTIONS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "bank", label: "Bank", icon: CreditCard },
  { value: "upi", label: "UPI", icon: Smartphone },
];

export default function StaffPage({ staff, banks, currentMonth }: Props) {
  const [payingId, setPayingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    salaryDue: "",   // full salary for the month
    amountPaid: "",  // amount actually being paid now
    month: currentMonth,
    mode: "cash",
    bankAccountId: banks[0]?.id ? String(banks[0].id) : "",
    narration: "",
  });

  function openPay(s: StaffMember) {
    setPayingId(s.id);
    const sal = s.monthlySalary ? String(s.monthlySalary) : "";
    setForm((f) => ({ ...f, salaryDue: sal, amountPaid: sal }));
  }

  function set(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  const dueAmt = parseFloat(form.salaryDue) || 0;
  const paidAmt = parseFloat(form.amountPaid) || 0;
  const outstanding = dueAmt - paidAmt; // negative = advance given to staff

  async function paySalary(e: React.FormEvent) {
    e.preventDefault();
    if (!payingId) return;
    if (!form.salaryDue || dueAmt <= 0) { toast.error("Enter salary due amount"); return; }
    if (!form.amountPaid || paidAmt <= 0) { toast.error("Enter amount being paid"); return; }
    if (form.mode !== "cash" && !form.bankAccountId) { toast.error("Select a bank account"); return; }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        staffId: payingId,
        salaryDue: dueAmt,
        amountPaid: paidAmt,
        month: form.month,
        mode: form.mode,
        narration: form.narration || undefined,
      };
      if (form.mode !== "cash" && form.bankAccountId) {
        payload.bankAccountId = parseInt(form.bankAccountId);
      }

      const res = await fetch("/api/staff/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Error"); return; }
      toast.success(outstanding > 0
        ? `Salary saved! ₹${outstanding.toLocaleString("en-IN")} still owed to staff`
        : outstanding < 0
          ? `Salary + Advance saved! ₹${Math.abs(outstanding).toLocaleString("en-IN")} advance given`
          : "Salary paid in full!"
      );
      setPayingId(null);
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  const totalMonthlyPayroll = staff.reduce((s, p) => s + (p.monthlySalary ?? 0), 0);
  const totalThisMonthPaid = staff.reduce((s, p) => s + p.thisMonthPaid, 0);

  return (
    <Layout title="Staff & Salary (कर्मचारी)">
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users size={20} className="text-indigo-600" />
            <div>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-800">{staff.length}</span> staff members
              </p>
              <p className="text-xs text-gray-400">
                Monthly payroll: {formatINR(totalMonthlyPayroll)} · This month paid: {formatINR(totalThisMonthPaid)}
              </p>
            </div>
          </div>
          <Link href="/khata/new?type=staff">
            <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700">
              <Plus size={16} /> Add Staff (कर्मचारी जोड़ें)
            </Button>
          </Link>
        </div>

        {/* Staff list */}
        {staff.length === 0 ? (
          <div className="bg-white rounded-xl border py-16 text-center text-gray-400">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No staff members added yet</p>
            <p className="text-sm mt-1">Add staff from Account Book or click the button above</p>
          </div>
        ) : (
          <div className="space-y-3">
            {staff.map((s) => {
              const isThisMonthPaid = s.thisMonthPaid > 0;
              const due = (s.monthlySalary ?? 0) - s.thisMonthPaid;
              const isPaying = payingId === s.id;

              return (
                <div key={s.id} className="bg-white rounded-xl border overflow-hidden">
                  {/* Staff row */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                        {s.name[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800">{s.name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            isThisMonthPaid ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                          }`}>
                            {isThisMonthPaid ? "Paid" : "Pending"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {s.mobile ?? "No mobile"}
                          {s.monthlySalary ? ` · Salary: ${formatINR(s.monthlySalary)}/month` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        {s.thisMonthPaid > 0 && (
                          <p className="text-sm text-green-600 font-semibold">{formatINR(s.thisMonthPaid)} paid</p>
                        )}
                        {due > 0 && (
                          <p className="text-xs text-orange-600 font-medium">{formatINR(due)} due</p>
                        )}
                        {s.totalPaid > 0 && (
                          <p className="text-xs text-gray-400">Total: {formatINR(s.totalPaid)}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => isPaying ? setPayingId(null) : openPay(s)}
                          className={isPaying ? "bg-gray-200 text-gray-700 hover:bg-gray-300" : "bg-indigo-600 hover:bg-indigo-700 text-white"}
                          variant="ghost"
                        >
                          <IndianRupee size={14} className="mr-1" />
                          {isPaying ? "Cancel" : "Pay Salary"}
                        </Button>
                        <Link href={`/khata/${s.id}`}>
                          <Button size="sm" variant="outline">Ledger</Button>
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Pay salary form */}
                  {isPaying && (
                    <form onSubmit={paySalary} className="border-t bg-indigo-50 px-4 py-4 space-y-4">
                      <p className="text-sm font-semibold text-indigo-800">Pay Salary — {s.name}</p>

                      {/* Month */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Month *</Label>
                        <Input
                          type="month"
                          value={form.month}
                          onChange={(e) => set("month", e.target.value)}
                          className="bg-white w-48"
                        />
                      </div>

                      {/* Two amount fields */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-600">Salary Due for Month (₹)</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                            <Input
                              type="number" min="1" step="0.01" placeholder="9000"
                              value={form.salaryDue}
                              onChange={(e) => set("salaryDue", e.target.value)}
                              className="pl-7 bg-white"
                            />
                          </div>
                          <p className="text-xs text-gray-400">Full monthly salary amount</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-600">Paying Now (₹)</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                            <Input
                              type="number" min="1" step="0.01" placeholder="7000"
                              value={form.amountPaid}
                              onChange={(e) => set("amountPaid", e.target.value)}
                              className={`pl-7 bg-white font-semibold ${paidAmt < dueAmt && paidAmt > 0 ? "border-orange-400" : ""}`}
                            />
                          </div>
                          <p className="text-xs text-gray-400">Less = partial · More = includes advance</p>
                        </div>
                      </div>

                      {/* Outstanding / Advance indicator */}
                      {dueAmt > 0 && paidAmt > 0 && (
                        outstanding > 0 ? (
                          <div className="rounded-lg p-3 bg-orange-50 border border-orange-200 text-orange-700 text-sm font-medium flex items-center justify-between">
                            <div>
                              <p className="font-semibold">Outstanding (बाकी) — still owed to staff</p>
                              <p className="text-xs font-normal mt-0.5">Will appear in staff ledger. Pay later via Receipt / Payment.</p>
                            </div>
                            <span className="font-bold text-base ml-4">{formatINR(outstanding)}</span>
                          </div>
                        ) : outstanding < 0 ? (
                          <div className="rounded-lg p-3 bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium flex items-center justify-between">
                            <div>
                              <p className="font-semibold">Advance (अग्रिम) — staff will repay from future salary</p>
                              <p className="text-xs font-normal mt-0.5">Dr balance in staff ledger. Deduct from next month automatically.</p>
                            </div>
                            <span className="font-bold text-base ml-4">{formatINR(Math.abs(outstanding))}</span>
                          </div>
                        ) : (
                          <div className="rounded-lg p-3 bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
                            Full salary paid — nothing outstanding
                          </div>
                        )
                      )}

                      {/* Payment mode */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Payment Mode</Label>
                        <div className="flex gap-2">
                          {MODE_OPTIONS.map((m) => (
                            <button
                              key={m.value} type="button"
                              onClick={() => set("mode", m.value)}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                form.mode === m.value
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                              }`}
                            >
                              <m.icon size={14} /> {m.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Bank account selector */}
                      {form.mode !== "cash" && banks.length > 0 && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">From Bank Account</Label>
                          <select
                            value={form.bankAccountId}
                            onChange={(e) => set("bankAccountId", e.target.value)}
                            className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                          >
                            {banks.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.bankName} — A/C ...{b.accountNo.slice(-4)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Narration */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Narration (optional)</Label>
                        <Input
                          placeholder={`Salary for ${form.month}`}
                          value={form.narration}
                          onChange={(e) => set("narration", e.target.value)}
                          className="bg-white"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                          {saving ? "Saving..." : paidAmt > 0
                            ? outstanding > 0
                              ? `Pay ${formatINR(paidAmt)} + ₹${outstanding.toLocaleString("en-IN")} pending`
                              : outstanding < 0
                                ? `Pay ${formatINR(paidAmt)} (incl. ₹${Math.abs(outstanding).toLocaleString("en-IN")} advance)`
                                : `Pay ${formatINR(paidAmt)} — Full Salary`
                            : "Pay Salary"
                          }
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setPayingId(null)}>Cancel</Button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">
          All salary payments are recorded as expense entries and visible in the staff ledger.
        </p>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) return { redirect: { destination: "/auth/login", permanent: false } };
  const firmId = session.user.firmId;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = new Date(`${currentMonth}-01`);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [staffRaw, banks, salaryAcct] = await Promise.all([
    prisma.party.findMany({
      where: { firmId, type: "staff", active: true },
      orderBy: { name: "asc" },
    }),
    prisma.bankAccount.findMany({
      where: { firmId, active: true },
      include: { account: { select: { id: true } } },
      orderBy: { id: "asc" },
    }),
    prisma.account.findFirst({ where: { firmId, code: "SAL001" } }),
  ]);

  // Fetch salary expenses for these staff
  const staffIds = staffRaw.map((s) => s.id);
  const [allExpenses, thisMonthExpenses] = staffIds.length > 0
    ? await Promise.all([
        prisma.expense.findMany({
          where: { firmId, partyId: { in: staffIds } },
          select: { partyId: true, amount: true },
        }),
        prisma.expense.findMany({
          where: { firmId, partyId: { in: staffIds }, date: { gte: monthStart, lte: monthEnd } },
          select: { partyId: true, amount: true },
        }),
      ])
    : [[], []];

  const totalByStaff = new Map<number, number>();
  const thisMonthByStaff = new Map<number, number>();

  for (const e of allExpenses) {
    if (!e.partyId) continue;
    totalByStaff.set(e.partyId, (totalByStaff.get(e.partyId) ?? 0) + Number(e.amount));
  }
  for (const e of thisMonthExpenses) {
    if (!e.partyId) continue;
    thisMonthByStaff.set(e.partyId, (thisMonthByStaff.get(e.partyId) ?? 0) + Number(e.amount));
  }

  return {
    props: {
      currentMonth,
      staff: staffRaw.map((s) => ({
        id: s.id,
        name: s.name,
        mobile: s.mobile,
        monthlySalary: s.monthlySalary !== null ? Number(s.monthlySalary) : null,
        totalPaid: totalByStaff.get(s.id) ?? 0,
        thisMonthPaid: thisMonthByStaff.get(s.id) ?? 0,
      })),
      banks: banks.map((b) => ({
        id: b.id,
        bankName: b.bankName,
        accountNo: b.accountNo,
        glAccountId: b.account?.id ?? 0,
      })).filter((b) => b.glAccountId > 0),
    },
  };
};
