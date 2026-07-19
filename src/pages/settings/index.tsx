import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Settings, Percent, Package, Warehouse, DollarSign } from "lucide-react";
import Link from "next/link";

interface RateSetting {
  key: string;
  label: string;
  value: string;
  unit: string;
}

interface SettingsData {
  firm: { id: number; name: string; address: string | null; gstin: string | null; pan: string | null };
  rates: RateSetting[];
  items: { id: number; name: string; hindiName: string | null; defaultUnitWeightKg: number }[];
  isMalik: boolean;
}

const RATE_KEYS: { key: string; label: string; unit: string; defaultVal: string }[] = [
  { key: "commission_pct", label: "Commission/Dami (आढ़त) (%)", unit: "%", defaultVal: "2.0" },
  { key: "mandi_shulk_pct", label: "Committee / Mandi Shulk (मंडी शुल्क) (%)", unit: "%", defaultVal: "1.0" },
  { key: "kkf_pct", label: "KKF (%)", unit: "%", defaultVal: "0.5" },
  { key: "byaj_pct_month", label: "Interest Rate (ब्याज) (% / month)", unit: "% / month", defaultVal: "1.5" },
  { key: "hammali_per_bag", label: "Labour Charges (हम्माली) per Bag (₹)", unit: "₹ / bag", defaultVal: "5" },
  { key: "mudat_pct", label: "Mudat (%)", unit: "%", defaultVal: "0" },
];

export default function SettingsPage({ data }: { data: SettingsData }) {
  const [rates, setRates] = useState<Record<string, string>>(
    Object.fromEntries(data.rates.map((r) => [r.key, r.value]))
  );
  const [savingRates, setSavingRates] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemHindi, setNewItemHindi] = useState("");
  const [newItemWeight, setNewItemWeight] = useState("40");
  const [addingItem, setAddingItem] = useState(false);

  async function saveRates() {
    setSavingRates(true);
    try {
      for (const [key, value] of Object.entries(rates)) {
        await fetch("/api/settings/rates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
        });
      }
      toast.success("Rates (दरें) saved successfully!");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSavingRates(false);
    }
  }

  async function addItem() {
    if (!newItemName) return;
    setAddingItem(true);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newItemName,
          hindiName: newItemHindi,
          defaultUnitWeightKg: parseFloat(newItemWeight),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${newItemName} added!`);
      setNewItemName(""); setNewItemHindi(""); setNewItemWeight("40");
      window.location.reload();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setAddingItem(false);
    }
  }

  if (!data.isMalik) {
    return (
      <Layout title="Firm Settings">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardContent className="pt-6 text-center text-gray-500">
              <Settings size={40} className="mx-auto mb-3 opacity-30" />
              <p>Only the Owner (मालिक) can view settings.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Firm Settings">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Opening Balance shortcut */}
        <Link href="/settings/opening-balance">
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-4 hover:bg-amber-100 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-600 rounded-lg">
                <DollarSign size={18} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-amber-800">Opening Balance Setup</p>
                <p className="text-xs text-amber-600">Set cash, bank &amp; party opening balances for FY start</p>
              </div>
            </div>
            <span className="text-amber-600 text-sm font-medium">Setup →</span>
          </div>
        </Link>

        {/* Firm info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings size={18} /> Firm (दुकान) Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-gray-500">Name: </span><strong>{data.firm.name}</strong></p>
            {data.firm.address && <p><span className="text-gray-500">Address: </span>{data.firm.address}</p>}
            {data.firm.gstin && <p><span className="text-gray-500">GSTIN: </span>{data.firm.gstin}</p>}
            {data.firm.pan && <p><span className="text-gray-500">PAN: </span>{data.firm.pan}</p>}
          </CardContent>
        </Card>

        {/* Rates panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent size={18} /> Rates (दरें)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {RATE_KEYS.map((r) => (
              <div key={r.key} className="flex items-center justify-between gap-4">
                <Label className="text-sm">{r.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    className="w-28 text-right"
                    value={rates[r.key] ?? r.defaultVal}
                    onChange={(e) => setRates((prev) => ({ ...prev, [r.key]: e.target.value }))}
                  />
                  <span className="text-xs text-gray-400 w-16">{r.unit}</span>
                </div>
              </div>
            ))}
            <Button onClick={saveRates} disabled={savingRates} className="w-full mt-2">
              {savingRates ? "Saving..." : "Save Rates (दरें सेव करें)"}
            </Button>
            <p className="text-xs text-gray-400">
              * Changing rates will not affect previously saved slips.
            </p>
          </CardContent>
        </Card>

        {/* Items / Jins */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package size={18} /> Commodities (जिन्स)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="divide-y">
              {data.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <span className="font-medium">{item.hindiName || item.name}</span>
                    {item.hindiName && <span className="text-gray-400 ml-1">({item.name})</span>}
                  </div>
                  <span className="text-gray-500">{item.defaultUnitWeightKg} kg / bag</span>
                </div>
              ))}
            </div>

            {/* Add new item */}
            <div className="border-t pt-3 space-y-3">
              <p className="text-sm font-medium">Add New Commodity (नया जिन्स जोड़ें)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Name (Hindi)</Label>
                  <Input value={newItemHindi} onChange={(e) => setNewItemHindi(e.target.value)} placeholder="सरसों" />
                </div>
                <div>
                  <Label className="text-xs">Name (English)</Label>
                  <Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Sarson" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Weight per Bag (kg)</Label>
                <Input type="number" step="0.1" value={newItemWeight} onChange={(e) => setNewItemWeight(e.target.value)} className="w-32" />
              </div>
              <Button onClick={addItem} disabled={addingItem || !newItemName} size="sm">
                + Add Commodity (जिन्स जोड़ें)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) return { redirect: { destination: "/auth/login", permanent: false } };
  const firmId = session.user.firmId;
  const isMalik = session.user.role === "malik";

  const [firm, settingsRaw, items] = await Promise.all([
    prisma.firm.findUnique({ where: { id: firmId } }),
    prisma.setting.findMany({ where: { firmId }, orderBy: { effectiveFrom: "desc" } }),
    prisma.item.findMany({ where: { firmId, active: true }, orderBy: { name: "asc" } }),
  ]);

  // Get latest value for each key
  const rateMap: Record<string, string> = {};
  for (const s of settingsRaw) {
    if (!rateMap[s.key]) rateMap[s.key] = s.value;
  }

  const rates: RateSetting[] = RATE_KEYS.map((r) => ({
    key: r.key,
    label: r.label,
    value: rateMap[r.key] ?? r.defaultVal,
    unit: r.unit,
  }));

  return {
    props: {
      data: {
        firm: { id: firm!.id, name: firm!.name, address: firm!.address, gstin: firm!.gstin, pan: firm!.pan },
        rates,
        items: items.map((i) => ({ id: i.id, name: i.name, hindiName: i.hindiName, defaultUnitWeightKg: Number(i.defaultUnitWeightKg) })),
        isMalik,
      },
    },
  };
};
