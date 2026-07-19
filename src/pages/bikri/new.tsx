import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Decimal from "decimal.js";
import { toast } from "sonner";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatINR, todayISO } from "@/lib/utils";
import { Plus, Trash2, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Item { id: number; name: string; hindiName: string | null; defaultUnitWeightKg: number }
interface Party { id: number; name: string; village: string | null; gstin: string | null }
interface Settings { damiPct: number; committeePct: number; kkfPct: number; mudatPct: number }

const itemRowSchema = z.object({
  itemId: z.coerce.number().int().min(1),
  unitWeightKg: z.coerce.number().positive(),
  quantityBags: z.coerce.number().positive(),
  totalWeightKg: z.coerce.number().positive(),
  ratePerQtl: z.coerce.number().positive(),
  amount: z.coerce.number().positive(),
});

const formSchema = z.object({
  vyapariId: z.coerce.number().int().min(1, "Select a trader (व्यापारी चुनें)"),
  date: z.string(),
  billNo: z.string().optional(),
  items: z.array(itemRowSchema).min(1),
  wagesAmount: z.coerce.number().min(0).default(0),
  damiPct: z.coerce.number().min(0).default(0),
  committeePct: z.coerce.number().min(0).default(0),
  kkfPct: z.coerce.number().min(0).default(0),
  mudatPct: z.coerce.number().min(0).default(0),
  gstType: z.enum(["intra", "inter"]).default("intra"),
  sgstPct: z.coerce.number().min(0).default(0),
  cgstPct: z.coerce.number().min(0).default(0),
  igstPct: z.coerce.number().min(0).default(0),
  vehicleNo: z.string().optional(),
  driverName: z.string().optional(),
  biltyNo: z.string().optional(),
  paymentDueDate: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function NewBikriPage({
  vyaparis, items, settings, defaultVyapariId,
}: {
  vyaparis: Party[]; items: Item[]; settings: Settings; defaultVyapariId?: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showList, setShowList] = useState(false);

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vyapariId: defaultVyapariId ?? 0,
      date: todayISO(),
      billNo: "",
      wagesAmount: 0,
      damiPct: settings.damiPct,
      committeePct: settings.committeePct,
      kkfPct: settings.kkfPct,
      mudatPct: settings.mudatPct,
      gstType: "intra",
      sgstPct: 0, cgstPct: 0, igstPct: 0,
      items: [{ itemId: 0, unitWeightKg: 40, quantityBags: 0, totalWeightKg: 0, ratePerQtl: 0, amount: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchItems = watch("items");
  const watchVyapariId = watch("vyapariId");
  const wWages = watch("wagesAmount") || 0;
  const wDami = watch("damiPct") || 0;
  const wCommittee = watch("committeePct") || 0;
  const wKkf = watch("kkfPct") || 0;
  const wMudat = watch("mudatPct") || 0;
  const wGstType = watch("gstType");
  const wSgst = watch("sgstPct") || 0;
  const wCgst = watch("cgstPct") || 0;
  const wIgst = watch("igstPct") || 0;

  // Auto-compute item amounts
  useEffect(() => {
    watchItems.forEach((item, idx) => {
      const bags = new Decimal(item.quantityBags || 0);
      const wt = bags.mul(item.unitWeightKg || 40);
      const amount = wt.div(100).mul(item.ratePerQtl || 0);
      setValue(`items.${idx}.totalWeightKg`, wt.toDecimalPlaces(3).toNumber());
      setValue(`items.${idx}.amount`, amount.toDecimalPlaces(2).toNumber());
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(watchItems.map((i) => [i.quantityBags, i.unitWeightKg, i.ratePerQtl]))]);

  const maalAmount = watchItems.reduce((s, i) => s + (i.amount || 0), 0);
  const damiAmt = maalAmount * wDami / 100;
  const committeeAmt = maalAmount * wCommittee / 100;
  const kkfAmt = maalAmount * wKkf / 100;
  const mudatAmt = maalAmount * wMudat / 100;
  const taxable = maalAmount + wWages + damiAmt + committeeAmt + kkfAmt + mudatAmt;
  const sgstAmt = taxable * wSgst / 100;
  const cgstAmt = taxable * wCgst / 100;
  const igstAmt = taxable * wIgst / 100;
  const grandTotal = taxable + sgstAmt + cgstAmt + igstAmt;

  const selectedVyapari = vyaparis.find((v) => v.id === Number(watchVyapariId));
  const filtered = search
    ? vyaparis.filter((v) => v.name.toLowerCase().includes(search.toLowerCase()))
    : vyaparis.slice(0, 20);

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      const { saleId, billNo } = await res.json();
      toast.success(`Sale (बिक्री) ${billNo} saved!`);
      router.push(`/bikri/${saleId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout title="New Sale (नई बिक्री)">
      <div className="max-w-2xl mx-auto">
        <Link href="/bikri" className="inline-flex items-center gap-1 text-sm text-gray-500 mb-4">
          <ArrowLeft size={14} /> Sale Register (बिक्री रजिस्टर)
        </Link>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Header */}
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <h2 className="font-semibold text-gray-800">Sale Bill (बिक्री बिल)</h2>

            {/* Vyapari selector */}
            <div className="space-y-1.5 relative">
              <Label>Trader (व्यापारी) / Mill *</Label>
              {selectedVyapari ? (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div>
                    <p className="font-semibold">{selectedVyapari.name}</p>
                    {selectedVyapari.village && <p className="text-xs text-gray-500">{selectedVyapari.village}</p>}
                    {selectedVyapari.gstin && <p className="text-xs text-gray-400">GSTIN: {selectedVyapari.gstin}</p>}
                  </div>
                  <button type="button" onClick={() => { setValue("vyapariId", 0); setSearch(""); }}
                    className="text-xs text-red-500">Change</button>
                </div>
              ) : (
                <div>
                  <Input placeholder="Search trader..."
                    value={search} onChange={(e) => { setSearch(e.target.value); setShowList(true); }}
                    onFocus={() => setShowList(true)} />
                  {showList && (
                    <div className="absolute z-20 left-0 right-0 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                      {filtered.map((v) => (
                        <button key={v.id} type="button"
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
                          onClick={() => { setValue("vyapariId", v.id); setSearch(v.name); setShowList(false); }}>
                          <span className="font-medium">{v.name}</span>
                          {v.village && <span className="text-gray-400 ml-1">— {v.village}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {errors.vyapariId && <p className="text-xs text-red-500">Select a trader (व्यापारी चुनें)</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" {...register("date")} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Due Date</Label>
                <Input type="date" {...register("paymentDueDate")} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>
                  Bill / Invoice No. <span className="text-gray-400 font-normal">(optional — leave blank to auto-generate)</span>
                </Label>
                <Input placeholder="e.g. INV-2026-001 or as per physical bill" {...register("billNo")} />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Commodity (जिन्स)</h3>
              <button type="button" onClick={() => append({ itemId: 0, unitWeightKg: 40, quantityBags: 0, totalWeightKg: 0, ratePerQtl: 0, amount: 0 })}
                className="text-sm text-primary hover:underline flex items-center gap-1">
                <Plus size={14} /> Add Commodity (जिन्स जोड़ें)
              </button>
            </div>

            {fields.map((field, idx) => {
              const item = watchItems[idx];
              return (
                <div key={field.id} className="border rounded-lg p-3 space-y-3 bg-blue-50/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">Commodity #{idx + 1}</span>
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(idx)} className="text-red-400"><Trash2 size={16} /></button>
                    )}
                  </div>
                  <div>
                    <Label>Commodity (जिन्स) *</Label>
                    <select {...register(`items.${idx}.itemId`)}
                      onChange={(e) => {
                        const rec = items.find((i) => i.id === parseInt(e.target.value));
                        if (rec) setValue(`items.${idx}.unitWeightKg`, rec.defaultUnitWeightKg);
                        setValue(`items.${idx}.itemId`, parseInt(e.target.value));
                      }}
                      className="w-full h-10 border border-input rounded-md px-3 text-sm bg-background mt-1">
                      <option value="0">— Select —</option>
                      {items.map((i) => <option key={i.id} value={i.id}>{i.hindiName || i.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Weight per Bag (kg)</Label>
                      <Input type="number" step="0.001" {...register(`items.${idx}.unitWeightKg`)} /></div>
                    <div><Label>Bags (बोरी) *</Label>
                      <Input type="number" step="0.5" {...register(`items.${idx}.quantityBags`)} /></div>
                    <div><Label>Total Weight (kg)</Label>
                      <Input readOnly className="bg-gray-50" value={item?.totalWeightKg || 0} {...register(`items.${idx}.totalWeightKg`)} /></div>
                    <div><Label>Rate (भाव) (₹/quintal) *</Label>
                      <Input type="number" step="0.01" {...register(`items.${idx}.ratePerQtl`)} /></div>
                  </div>
                  <div className="text-right font-bold text-blue-700">{formatINR(item?.amount || 0)}</div>
                </div>
              );
            })}
          </div>

          {/* Charges block */}
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <h3 className="font-semibold">Charges (from buyer)</h3>

            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "wagesAmount" as const, label: "Labour Charges (हम्माली) (₹)", step: "1" },
              ].map(({ key, label, step }) => (
                <div key={key} className="space-y-1">
                  <Label>{label}</Label>
                  <Input type="number" step={step} min="0" {...register(key)} />
                </div>
              ))}
              {[
                { key: "damiPct" as const, label: "Commission/Dami (%)" },
                { key: "committeePct" as const, label: "Committee (%)" },
                { key: "kkfPct" as const, label: "KKF (%)" },
                { key: "mudatPct" as const, label: "Mudat (%)" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label>{label}</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" step="0.01" min="0" className="flex-1" {...register(key)} />
                    <span className="text-xs text-gray-400 w-16">{formatINR(maalAmount * (watch(key) || 0) / 100)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* GST block */}
            <div className="border-t pt-3">
              <div className="flex items-center gap-4 mb-3">
                <Label className="font-semibold">GST</Label>
                <label className="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="radio" value="intra" {...register("gstType")} /> Intra-state (SGST+CGST)
                </label>
                <label className="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="radio" value="inter" {...register("gstType")} /> Inter-state (IGST)
                </label>
              </div>
              {wGstType === "intra" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>SGST (%)</Label>
                    <Input type="number" step="0.01" min="0" {...register("sgstPct")} /></div>
                  <div><Label>CGST (%)</Label>
                    <Input type="number" step="0.01" min="0" {...register("cgstPct")} /></div>
                </div>
              ) : (
                <div><Label>IGST (%)</Label>
                  <Input type="number" step="0.01" min="0" {...register("igstPct")} /></div>
              )}
            </div>
          </div>

          {/* Vehicle/Bilty */}
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <h3 className="font-semibold text-gray-700">Vehicle / Bilty (optional)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vehicle No.</Label><Input {...register("vehicleNo")} placeholder="RJ-XX-XXXX" /></div>
              <div><Label>Driver Name</Label><Input {...register("driverName")} /></div>
              <div><Label>Bilty No.</Label><Input {...register("biltyNo")} /></div>
            </div>
          </div>

          {/* Bill summary */}
          <div className="bg-amber-50 rounded-lg border border-amber-200 p-4 space-y-2 text-sm">
            <h3 className="font-bold text-gray-800 mb-3">Bill Summary</h3>
            <div className="flex justify-between"><span>Goods Amount</span><span>{formatINR(maalAmount)}</span></div>
            <div className="flex justify-between text-gray-600"><span>(+) Labour Charges (हम्माली)</span><span>{formatINR(wWages)}</span></div>
            <div className="flex justify-between text-gray-600"><span>(+) Commission/Dami ({wDami}%)</span><span>{formatINR(damiAmt)}</span></div>
            <div className="flex justify-between text-gray-600"><span>(+) Committee ({wCommittee}%)</span><span>{formatINR(committeeAmt)}</span></div>
            <div className="flex justify-between text-gray-600"><span>(+) KKF ({wKkf}%)</span><span>{formatINR(kkfAmt)}</span></div>
            {mudatAmt > 0 && <div className="flex justify-between text-gray-600"><span>(+) Mudat</span><span>{formatINR(mudatAmt)}</span></div>}
            <div className="flex justify-between font-semibold border-t pt-2"><span>Total (excl. GST)</span><span>{formatINR(taxable)}</span></div>
            {sgstAmt > 0 && <div className="flex justify-between text-gray-600"><span>SGST</span><span>{formatINR(sgstAmt)}</span></div>}
            {cgstAmt > 0 && <div className="flex justify-between text-gray-600"><span>CGST</span><span>{formatINR(cgstAmt)}</span></div>}
            {igstAmt > 0 && <div className="flex justify-between text-gray-600"><span>IGST</span><span>{formatINR(igstAmt)}</span></div>}
            <div className="flex justify-between text-lg font-bold border-t pt-2 text-blue-700">
              <span>Total Bill Amount</span><span>{formatINR(grandTotal)}</span>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full h-12 text-base">
            {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...</> : "Save Sale Bill (बिक्री बिल सेव करें)"}
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

  const [vyaparis, items, settingsRaw] = await Promise.all([
    prisma.party.findMany({
      where: { firmId, type: "vyapari", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, village: true, gstin: true },
    }),
    prisma.item.findMany({ where: { firmId, active: true }, orderBy: { name: "asc" } }),
    prisma.setting.findMany({ where: { firmId }, orderBy: { effectiveFrom: "desc" } }),
  ]);

  const settingMap: Record<string, string> = {};
  for (const s of settingsRaw) if (!settingMap[s.key]) settingMap[s.key] = s.value;

  return {
    props: {
      vyaparis,
      items: items.map((i) => ({ id: i.id, name: i.name, hindiName: i.hindiName, defaultUnitWeightKg: Number(i.defaultUnitWeightKg) })),
      settings: {
        damiPct: parseFloat(settingMap["commission_pct"] ?? "2"),
        committeePct: parseFloat(settingMap["mandi_shulk_pct"] ?? "1"),
        kkfPct: parseFloat(settingMap["kkf_pct"] ?? "0.5"),
        mudatPct: parseFloat(settingMap["mudat_pct"] ?? "0"),
      },
      defaultVyapariId: ctx.query.vyapariId ? parseInt(ctx.query.vyapariId as string) : null,
    },
  };
};
