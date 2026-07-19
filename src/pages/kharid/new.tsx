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
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatINR, todayISO } from "@/lib/utils";
import { Plus, Trash2, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

interface Item {
  id: number;
  name: string;
  hindiName: string | null;
  defaultUnitWeightKg: number;
}

interface Party {
  id: number;
  name: string;
  village: string | null;
}

const itemRowSchema = z.object({
  itemId: z.coerce.number().int().min(1, "Select a commodity (जिन्स चुनें)"),
  unitWeightKg: z.coerce.number().positive("Weight is required"),
  quantityBags: z.coerce.number().positive("Bags count is required"),
  totalWeightKg: z.coerce.number().positive(),
  ratePerQtl: z.coerce.number().positive("Rate (भाव) is required"),
  amount: z.coerce.number().positive(),
  katautiPct: z.coerce.number().min(0).default(0),
  katautiKg: z.coerce.number().min(0).default(0),
  netWeightKg: z.coerce.number().positive(),
});

const formSchema = z.object({
  kisanId: z.coerce.number().int().min(1, "Select a farmer (किसान चुनें)"),
  purchaseType: z.enum(["aadhat", "khud"]),
  date: z.string(),
  billNo: z.string().optional(),
  wagesAmount: z.coerce.number().min(0).default(0),
  advanceAdjusted: z.coerce.number().min(0).default(0),
  byajAdjusted: z.coerce.number().min(0).default(0),
  committeePct: z.coerce.number().min(0).default(0),
  kkfPct: z.coerce.number().min(0).default(0),
  items: z.array(itemRowSchema).min(1, "Add at least one commodity"),
});

type FormData = z.infer<typeof formSchema>;

export default function NewKharidPage({
  kisans,
  items,
  defaultKisanId,
  settings,
}: {
  kisans: Party[];
  items: Item[];
  defaultKisanId?: number;
  settings: { committeePct: number; kkfPct: number };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [kisanSearch, setKisanSearch] = useState("");
  const [showKisanList, setShowKisanList] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      kisanId: defaultKisanId ?? 0,
      purchaseType: "aadhat",
      date: todayISO(),
      billNo: "",
      wagesAmount: 0,
      advanceAdjusted: 0,
      byajAdjusted: 0,
      committeePct: settings.committeePct,
      kkfPct: settings.kkfPct,
      items: [
        {
          itemId: 0,
          unitWeightKg: 40,
          quantityBags: 0,
          totalWeightKg: 0,
          ratePerQtl: 0,
          amount: 0,
          katautiPct: 0,
          katautiKg: 0,
          netWeightKg: 0,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchItems = watch("items");
  const watchWages = Number(watch("wagesAmount")) || 0;
  const watchAdvance = Number(watch("advanceAdjusted")) || 0;
  const watchByaj = Number(watch("byajAdjusted")) || 0;
  const watchKisanId = watch("kisanId");
  const watchPurchaseType = watch("purchaseType");
  const watchCommitteePct = Number(watch("committeePct")) || 0;
  const watchKkfPct = Number(watch("kkfPct")) || 0;

  // Auto-compute totals when item rows change
  useEffect(() => {
    watchItems.forEach((item, idx) => {
      const bags = new Decimal(item.quantityBags || 0);
      const unitWt = new Decimal(item.unitWeightKg || 40);
      const totalWt = bags.mul(unitWt);
      const rate = new Decimal(item.ratePerQtl || 0);
      const netWt = totalWt.sub(new Decimal(item.katautiKg || 0));
      const amount = netWt.div(100).mul(rate);

      setValue(`items.${idx}.totalWeightKg`, totalWt.toDecimalPlaces(3).toNumber());
      setValue(`items.${idx}.netWeightKg`, netWt.toDecimalPlaces(3).toNumber());
      setValue(`items.${idx}.amount`, amount.toDecimalPlaces(2).toNumber());
    });
  }, [JSON.stringify(watchItems.map((i) => [i.quantityBags, i.unitWeightKg, i.ratePerQtl, i.katautiKg]))]);

  const totalAmount = watchItems.reduce((sum, i) => sum + (i.amount || 0), 0);
  const committeeAmt = watchPurchaseType === "khud" ? totalAmount * watchCommitteePct / 100 : 0;
  const kkfAmt = watchPurchaseType === "khud" ? totalAmount * watchKkfPct / 100 : 0;
  const netPayable = totalAmount - watchWages - watchAdvance - watchByaj;
  const totalStockCost = totalAmount + committeeAmt + kkfAmt;

  const selectedKisan = kisans.find((k) => k.id === Number(watchKisanId));
  const filteredKisans = kisanSearch
    ? kisans.filter(
        (k) =>
          k.name.toLowerCase().includes(kisanSearch.toLowerCase()) ||
          k.village?.toLowerCase().includes(kisanSearch.toLowerCase())
      )
    : kisans.slice(0, 20);

  async function onSubmit(data: FormData) {
    if (netPayable < 0) {
      toast.error("Deductions cannot exceed total amount");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? "Error");
      }
      const { purchaseId, billNo } = await res.json();
      toast.success(`Purchase (खरीद) ${billNo} saved!`);
      router.push(`/kharid/${purchaseId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout title="New Purchase (नई खरीद)">
      <div className="max-w-2xl mx-auto">
        <Link href="/kharid" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Purchase Register (खरीद रजिस्टर)
        </Link>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Header card */}
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <h2 className="font-semibold text-gray-800">Purchase Slip (खरीद परची)</h2>

            {/* Purchase type */}
            <div className="flex gap-3">
              {[
                { value: "aadhat", label: "Commission Purchase (आढ़त खरीद)" },
                { value: "khud", label: "Own Purchase (खुद की खरीद)" },
              ].map((t) => (
                <label key={t.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value={t.value} {...register("purchaseType")} />
                  <span className="text-sm font-medium">{t.label}</span>
                </label>
              ))}
            </div>

            {/* Kisan selector */}
            <div className="space-y-1.5 relative">
              <Label>Farmer (किसान) *</Label>
              {selectedKisan ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex-1">
                    <p className="font-semibold">{selectedKisan.name}</p>
                    {selectedKisan.village && <p className="text-xs text-gray-500">{selectedKisan.village}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setValue("kisanId", 0); setKisanSearch(""); }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div>
                  <Input
                    placeholder="Search farmer by name or village..."
                    value={kisanSearch}
                    onChange={(e) => { setKisanSearch(e.target.value); setShowKisanList(true); }}
                    onFocus={() => setShowKisanList(true)}
                  />
                  {showKisanList && (
                    <div className="absolute z-20 left-0 right-0 bg-white border rounded-md shadow-lg max-h-56 overflow-y-auto mt-1">
                      {filteredKisans.map((k) => (
                        <button
                          key={k.id}
                          type="button"
                          className="w-full text-left px-4 py-2.5 hover:bg-amber-50 text-sm"
                          onClick={() => {
                            setValue("kisanId", k.id);
                            setKisanSearch(k.name);
                            setShowKisanList(false);
                          }}
                        >
                          <span className="font-medium">{k.name}</span>
                          {k.village && <span className="text-gray-400 ml-1">— {k.village}</span>}
                        </button>
                      ))}
                      {filteredKisans.length === 0 && (
                        <p className="px-4 py-3 text-sm text-gray-400">No farmer found</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {errors.kisanId && <p className="text-xs text-red-500">Select a farmer (किसान चुनें)</p>}
            </div>

            {/* Date + Bill No */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" {...register("date")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="billNo">
                  Bill / Invoice No. <span className="text-gray-400 font-normal">(optional)</span>
                </Label>
                <Input
                  id="billNo"
                  placeholder="Leave blank to auto-generate"
                  {...register("billNo")}
                />
              </div>
            </div>
          </div>

          {/* Items section */}
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Commodity (जिन्स)</h3>
              <button
                type="button"
                onClick={() =>
                  append({
                    itemId: 0, unitWeightKg: 40, quantityBags: 0,
                    totalWeightKg: 0, ratePerQtl: 0, amount: 0,
                    katautiPct: 0, katautiKg: 0, netWeightKg: 0,
                  })
                }
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> Add Commodity (जिन्स जोड़ें)
              </button>
            </div>

            {fields.map((field, idx) => {
              const itemData = watchItems[idx];
              return (
                <div key={field.id} className="border rounded-lg p-3 space-y-3 bg-amber-50/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">Commodity #{idx + 1}</span>
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(idx)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {/* Item select */}
                  <div className="space-y-1">
                    <Label>Commodity (जिन्स) *</Label>
                    <select
                      {...register(`items.${idx}.itemId`)}
                      onChange={(e) => {
                        const item = items.find((i) => i.id === parseInt(e.target.value));
                        if (item) setValue(`items.${idx}.unitWeightKg`, item.defaultUnitWeightKg);
                        setValue(`items.${idx}.itemId`, parseInt(e.target.value));
                      }}
                      className="w-full h-10 border border-input rounded-md px-3 text-sm bg-background"
                    >
                      <option value="0">— Select commodity —</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>{i.hindiName || i.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Weight / qty / rate grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Weight per Bag (kg)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        {...register(`items.${idx}.unitWeightKg`)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Bags (बोरी) *</Label>
                      <Input type="number" step="0.5" min="0" {...register(`items.${idx}.quantityBags`)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Total Weight (kg)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        readOnly
                        className="bg-gray-50"
                        value={itemData?.totalWeightKg || 0}
                        {...register(`items.${idx}.totalWeightKg`)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Rate (भाव) (₹/quintal) *</Label>
                      <Input type="number" step="0.01" min="0" {...register(`items.${idx}.ratePerQtl`)} />
                    </div>
                  </div>

                  {/* Katauti (optional) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-gray-500">Deduction (kg)</Label>
                      <Input type="number" step="0.001" min="0" {...register(`items.${idx}.katautiKg`)} placeholder="0" />
                    </div>
                    <div className="space-y-1">
                      <Label>Net Weight (kg)</Label>
                      <Input readOnly className="bg-gray-50" value={itemData?.netWeightKg || 0} {...register(`items.${idx}.netWeightKg`)} />
                    </div>
                  </div>

                  {/* Line amount */}
                  <div className="flex justify-end">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Amount (रकम)</p>
                      <p className="text-lg font-bold text-gray-900">
                        {formatINR(itemData?.amount || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mandi Charges — only for khud (own) purchase */}
          {watchPurchaseType === "khud" && (
            <div className="bg-white rounded-lg border p-4 space-y-4">
              <h3 className="font-semibold text-gray-800">
                Mandi Charges (मंडी शुल्क)
                <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Own Purchase Only</span>
              </h3>

              <div className="space-y-3">
                {/* Committee */}
                <div className="flex items-center justify-between gap-4">
                  <Label className="whitespace-nowrap">Committee / Mandi Shulk (%)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="max-w-[120px]"
                      {...register("committeePct")}
                    />
                    <span className="text-sm font-medium text-gray-700 min-w-[100px] text-right">
                      {formatINR(committeeAmt)}
                    </span>
                  </div>
                </div>

                {/* KKF */}
                <div className="flex items-center justify-between gap-4">
                  <Label className="whitespace-nowrap">KKF (%)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="max-w-[120px]"
                      {...register("kkfPct")}
                    />
                    <span className="text-sm font-medium text-gray-700 min-w-[100px] text-right">
                      {formatINR(kkfAmt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Deductions & summary */}
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <h3 className="font-semibold text-gray-800">Deductions</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="wagesAmount" className="whitespace-nowrap">Labour Charges (हम्माली / तुलाई) (₹)</Label>
                <Input
                  id="wagesAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  className="max-w-[180px]"
                  {...register("wagesAmount")}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="advanceAdjusted" className="whitespace-nowrap">Advance Adjustment (उछंती समायोजन) (₹)</Label>
                <Input
                  id="advanceAdjusted"
                  type="number"
                  step="0.01"
                  min="0"
                  className="max-w-[180px]"
                  {...register("advanceAdjusted")}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="byajAdjusted" className="whitespace-nowrap">Interest Adjustment (ब्याज समायोजन) (₹)</Label>
                <Input
                  id="byajAdjusted"
                  type="number"
                  step="0.01"
                  min="0"
                  className="max-w-[180px]"
                  {...register("byajAdjusted")}
                />
              </div>
            </div>

            {/* Totals */}
            <div className="border-t pt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Amount (कुल रकम)</span>
                <span className="font-medium">{formatINR(totalAmount)}</span>
              </div>
              {watchPurchaseType === "khud" && (
                <>
                  <div className="flex justify-between text-blue-600">
                    <span>(+) Committee (मंडी शुल्क)</span>
                    <span>{formatINR(committeeAmt)}</span>
                  </div>
                  <div className="flex justify-between text-blue-600">
                    <span>(+) KKF</span>
                    <span>{formatINR(kkfAmt)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-red-600">
                <span>(-) Labour + Advance + Interest</span>
                <span>-{formatINR(watchWages + watchAdvance + watchByaj)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Farmer Payable (किसान को देना)</span>
                <span className={netPayable < 0 ? "text-red-600" : "text-green-600"}>
                  {formatINR(Math.max(0, netPayable))}
                </span>
              </div>
              {watchPurchaseType === "khud" && (
                <div className="flex justify-between text-sm font-semibold text-purple-700 bg-purple-50 px-3 py-2 rounded-md mt-1">
                  <span>Total Stock Cost (stock लागत)</span>
                  <span>{formatINR(totalStockCost)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Save */}
          <Button type="submit" disabled={loading} className="w-full h-12 text-base">
            {loading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...</>
            ) : (
              "Save Purchase Slip (खरीद परची सेव करें)"
            )}
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

  const [kisans, items, settingRows] = await Promise.all([
    prisma.party.findMany({
      where: { firmId, type: "kisan", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, village: true },
    }),
    prisma.item.findMany({
      where: { firmId, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.setting.findMany({
      where: { firmId },
      orderBy: { effectiveFrom: "desc" },
    }),
  ]);

  const settingMap: Record<string, string> = {};
  for (const s of settingRows) {
    if (!settingMap[s.key]) settingMap[s.key] = s.value;
  }
  const settings = {
    committeePct: parseFloat(settingMap["mandi_shulk_pct"] ?? "1"),
    kkfPct: parseFloat(settingMap["kkf_pct"] ?? "0.5"),
  };

  return {
    props: {
      kisans,
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        hindiName: i.hindiName,
        defaultUnitWeightKg: Number(i.defaultUnitWeightKg),
      })),
      defaultKisanId: ctx.query.kisanId ? parseInt(ctx.query.kisanId as string) : null,
      settings,
    },
  };
};
