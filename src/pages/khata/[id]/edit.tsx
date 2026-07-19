import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PartyData {
  id: number; name: string; type: string; village: string | null;
  mobile: string | null; gstin: string | null; pan: string | null;
  paymentTermDays: number; byajRateOverride: number | null;
  monthlySalary: number | null;
  openingBalance: number; openingType: string;
}

const TYPE_OPTIONS = [
  { val: "kisan", label: "Farmer (किसान)" },
  { val: "vyapari", label: "Trader (व्यापारी)" },
  { val: "transporter", label: "Transporter" },
  { val: "palledar", label: "Palledar" },
  { val: "staff", label: "Staff (कर्मचारी)" },
  { val: "other", label: "Other" },
];

export default function EditPartyPage({ party }: { party: PartyData }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: party.name,
    type: party.type,
    village: party.village ?? "",
    mobile: party.mobile ?? "",
    gstin: party.gstin ?? "",
    pan: party.pan ?? "",
    paymentTermDays: String(party.paymentTermDays),
    byajRateOverride: party.byajRateOverride !== null ? String(party.byajRateOverride) : "",
    monthlySalary: party.monthlySalary !== null ? String(party.monthlySalary) : "",
    openingBalance: String(party.openingBalance),
    openingType: party.openingType,
  });

  function set(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name is required"); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/parties/${party.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          village: form.village || null,
          mobile: form.mobile || null,
          gstin: form.gstin || null,
          pan: form.pan || null,
          paymentTermDays: parseInt(form.paymentTermDays) || 0,
          byajRateOverride: form.byajRateOverride ? parseFloat(form.byajRateOverride) : null,
          monthlySalary: form.monthlySalary ? parseFloat(form.monthlySalary) : null,
          openingBalance: parseFloat(form.openingBalance) || 0,
          openingType: form.openingType,
        }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Error"); return; }
      toast.success("Details saved successfully");
      router.push(`/khata/${party.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout title={`Edit — ${party.name}`}>
      <div className="max-w-lg mx-auto space-y-4">
        <Link href={`/khata/${party.id}`} className="inline-flex items-center gap-1 text-sm text-gray-500">
          <ArrowLeft size={14} /> Back
        </Link>

        <form onSubmit={submit} className="bg-white rounded-lg border p-5 space-y-5">
          <h2 className="text-lg font-bold">Edit Party Details</h2>

          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((t) => (
                <button key={t.val} type="button"
                  onClick={() => set("type", t.val)}
                  className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                    form.type === t.val ? "bg-amber-700 text-white border-amber-700" : "bg-white text-gray-600 hover:border-amber-400"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Village</Label>
              <Input placeholder="Village name" value={form.village} onChange={(e) => set("village", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Mobile</Label>
              <Input placeholder="9XXXXXXXXX" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>GSTIN</Label>
              <Input placeholder="27AAAAA0000A1Z5" value={form.gstin} onChange={(e) => set("gstin", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>PAN</Label>
              <Input placeholder="AAAAA0000A" value={form.pan} onChange={(e) => set("pan", e.target.value)} />
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Financial Details</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Opening Balance (₹)</Label>
                <Input type="number" step="0.01" min="0" value={form.openingBalance} onChange={(e) => set("openingBalance", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Balance Type</Label>
                <div className="flex gap-2">
                  {["Dr", "Cr"].map((t) => (
                    <button key={t} type="button"
                      onClick={() => set("openingType", t)}
                      className={`flex-1 py-2 rounded-md border text-sm font-medium ${
                        form.openingType === t ? "bg-amber-700 text-white border-amber-700" : "bg-white text-gray-600"
                      }`}
                    >
                      {t === "Dr" ? "Receivable (Dr)" : "Payable (Cr)"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-1.5">
                <Label>Payment Terms (days)</Label>
                <Input type="number" min="0" value={form.paymentTermDays} onChange={(e) => set("paymentTermDays", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Interest Rate Override (ब्याज) (% / month)</Label>
                <Input type="number" step="0.01" min="0" placeholder="blank = default" value={form.byajRateOverride} onChange={(e) => set("byajRateOverride", e.target.value)} />
              </div>
            </div>
            {form.type === "staff" && (
              <div className="mt-4 space-y-1.5">
                <Label>Monthly Salary (मासिक वेतन) ₹</Label>
                <Input type="number" step="0.01" min="0" placeholder="e.g. 8000" value={form.monthlySalary} onChange={(e) => set("monthlySalary", e.target.value)} className="w-48" />
              </div>
            )}
          </div>

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save Details"}
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
  const id = parseInt(ctx.params?.id as string, 10);

  const party = await prisma.party.findFirst({ where: { id, firmId } });
  if (!party) return { notFound: true };

  return {
    props: {
      party: {
        id: party.id, name: party.name, type: party.type,
        village: party.village, mobile: party.mobile,
        gstin: party.gstin, pan: party.pan,
        paymentTermDays: party.paymentTermDays,
        byajRateOverride: party.byajRateOverride !== null ? Number(party.byajRateOverride) : null,
        monthlySalary: party.monthlySalary !== null ? Number(party.monthlySalary) : null,
        openingBalance: Number(party.openingBalance),
        openingType: party.openingType,
      } as PartyData,
    },
  };
};
