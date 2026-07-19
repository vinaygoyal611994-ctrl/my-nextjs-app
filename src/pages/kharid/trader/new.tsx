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

interface Trader {
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
  traderId: z.coerce.number().int().min(1, "Select a trader (व्यापारी चुनें)"),
  date: z.string(),
  billNo: z.string().optional(),
  committeePct: z.coerce.number().min(0).default(0),
  kkfPct: z.coerce.number().min(0).default(0),
  mudatPct: z.coerce.number().min(0).default(0),
  sgstPct: z.coerce.number().min(0).default(0),
  cgstPct: z.coerce.number().min(0).default(0),
  igstPct: z.coerce.number().min(0).default(0),
  items: z.array(itemRowSchema).min(1, "Add at least one commodity"),
});

type FormData = z.infer<typeof formSchema>;

export default function TraderPurchasePage({
  traders,
  items,
  settings,
}: {
  traders: Trader[];
  items: Item[];
  settings: { committeePct: number; kkfPct: number };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [traderSearch, setTraderSearch] = useState("");
  const [showTraderList, setShowTraderList] = useState(false);

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
      traderId: 0,
      date: todayISO(),
      billNo: "",
      committeePct: settings.committeePct,
      kkfPct: settings.kkfPct,
      mudatPct: 0,
      sgstPct: 0,
      cgstPct: 0,
      igstPct: 0,
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
  const watchTraderId = watch("traderId");
  const watchCommitteePct = Number(watch("committeePct")) || 0;
  const watchKkfPct = Number(watch("kkfPct")) || 0;
  const watchMudatPct = Number(watch("mudatPct")) || 0;
  const watchSgstPct = Number(watch("sgstPct")) || 0;
  const watchCgstPct = Number(watch("cgstPct")) || 0;
  const watchIgstPct = Number(watch("igstPct")) || 0;

  // Auto-compute item row totals
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

  const totalItemAmount = watchItems.reduce((sum, i) => sum + (i.amount || 0), 0);
  const committeeAmt = totalItemAmount * watchCommitteePct / 100;
  const kkfAmt = totalItemAmount * watchKkfPct / 100;
  const mudatAmt = totalItemAmount * watchMudatPct / 100;
  const sgstAmt = totalItemAmount * watchSgstPct / 100;
  const cgstAmt = totalItemAmount * watchCgstPct / 100;
  const igstAmt = totalItemAmount * watchIgstPct / 100;
  // Trader handles all govt dues — we owe full amount (item + all charges + gst)
  const netPayableToTrader = totalItemAmount + committeeAmt + kkfAmt + mudatAmt + sgstAmt + cgstAmt + igstAmt;
  // Total stock cost = item total + committee + kkf + mudat (excl GST)
  const totalStockCost = totalItemAmount + committeeAmt + kkfAmt + mudatAmt;

  const selectedTrader = traders.find((t) => t.id === Number(watchTraderId));
  const filteredTraders = traderSearch
    ? traders.filter(
        (t) =>
          t.name.toLowerCase().includes(traderSearch.toLowerCase()) ||
          t.village?.toLowerCase().includes(traderSearch.toLowerCase())
      )
    : traders.slice(0, 20);

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await fetch("/api/purchases/trader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          committeePct: Number(data.committeePct),
          kkfPct: Number(data.kkfPct),
          mudatPct: Number(data.mudatPct),
          sgstPct: Number(data.sgstPct),
          cgstPct: Number(data.cgstPct),
          igstPct: Number(data.igstPct),
          items: data.items.map((item) => ({
            ...item,
            itemId: Number(item.itemId),
            unitWeightKg: Number(item.unitWeightKg),
            quantityBags: Number(item.quantityBags),
            totalWeightKg: Number(item.totalWeightKg),
            ratePerQtl: Number(item.ratePerQtl),
            amount: Number(item.amount),
            katautiPct: Number(item.katautiPct),
            katautiKg: Number(item.katautiKg),
            netWeightKg: Number(item.netWeightKg),
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? JSON.stringify(err.error) ?? "Error");
      }
      const { traderPurchaseId, billNo } = await res.json();
      toast.success(`Trader Purchase (व्यापारी खरीद) ${billNo} saved!`);
      router.push("/kharid/trader");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout title="Trader Purchase (व्यापारी खरीद)">
      <div className="max-w-2xl mx-auto">
        <Link href="/kharid/trader" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Trader Purchase List (व्यापारी खरीद सूची)
        </Link>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Header card */}
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <h2 className="font-semibold text-gray-800">
              Trader Purchase (व्यापारी खरीद)
              <span className="ml-2 text-xs font-normal text-orange-600 bg-orange-50 px-2 py-0.5 rounded">Vyapari</span>
            </h2>

            {/* Trader selector */}
            <div className="space-y-1.5 relative">
              <Label>Trader / Firm (व्यापारी) *</Label>
              {selectedTrader ? (
                <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
                  <div className="flex-1">
                    <p className="font-semibold">{selectedTrader.name}</p>
                    {selectedTrader.village && <p className="text-xs text-gray-500">{selectedTrader.village}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setValue("traderId", 0); setTraderSearch(""); }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div>
                  <Input
                    placeholder="Search trader by name..."
                    value={traderSearch}
                    onChange={(e) => { setTraderSearch(e.target.value); setShowTraderList(true); }}
                    onFocus={() => setShowTraderList(true)}
                  />
                  {showTraderList && (
                    <div className="absolute z-20 left-0 right-0 bg-white border rounded-md shadow-lg max-h-56 overflow-y-auto mt-1">
                      {filteredTraders.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className="w-full text-left px-4 py-2.5 hover:bg-orange-50 text-sm"
                          onClick={() => {
                            setValue("traderId", t.id);
                            setTraderSearch(t.name);
                            setShowTraderList(false);
                          }}
                        >
                          <span className="font-medium">{t.name}</span>
                          {t.village && <span className="text-gray-400 ml-1">— {t.village}</span>}
                        </button>
                      ))}
                      {filteredTraders.length === 0 && (
                        <p className="px-4 py-3 text-sm text-gray-400">No trader found</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {errors.traderId && <p className="text-xs text-red-500">Select a trader (व्यापारी चुनें)</p>}
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
                <div key={field.id} className="border rounded-lg p-3 space-y-3 bg-orange-50/40">
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
                      <Input type="number" step="0.001" {...register(`items.${idx}.unitWeightKg`)} />
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

                  {/* Katauti */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-gray-500">Deduction (कटौती kg)</Label>
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
                      <p className="text-lg font-bold text-gray-900">{formatINR(itemData?.amount || 0)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mandi Charges */}
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <h3 className="font-semibold text-gray-800">Mandi Charges (मंडी शुल्क)</h3>

            <div className="space-y-3">
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
              <div className="flex items-center justify-between gap-4">
                <Label className="whitespace-nowrap">Mudat / Bhaav Badha (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="max-w-[120px]"
                    {...register("mudatPct")}
                  />
                  <span className="text-sm font-medium text-gray-700 min-w-[100px] text-right">
                    {formatINR(mudatAmt)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* GST Taxes */}
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <h3 className="font-semibold text-gray-800">
              GST Taxes
              <span className="ml-2 text-xs font-normal text-gray-400">(Intra-state: SGST+CGST / Inter-state: IGST)</span>
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Label className="whitespace-nowrap">SGST (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="max-w-[120px]"
                    {...register("sgstPct")}
                  />
                  <span className="text-sm font-medium text-gray-700 min-w-[100px] text-right">
                    {formatINR(sgstAmt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="whitespace-nowrap">CGST (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="max-w-[120px]"
                    {...register("cgstPct")}
                  />
                  <span className="text-sm font-medium text-gray-700 min-w-[100px] text-right">
                    {formatINR(cgstAmt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="whitespace-nowrap">IGST (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="max-w-[120px]"
                    {...register("igstPct")}
                  />
                  <span className="text-sm font-medium text-gray-700 min-w-[100px] text-right">
                    {formatINR(igstAmt)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-lg border p-4 space-y-3 text-sm">
            <h3 className="font-semibold text-gray-800">Summary (सारांश)</h3>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Item Total (माल रकम)</span>
                <span className="font-medium">{formatINR(totalItemAmount)}</span>
              </div>
              {committeeAmt > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>(+) Committee (मंडी शुल्क)</span>
                  <span>{formatINR(committeeAmt)}</span>
                </div>
              )}
              {kkfAmt > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>(+) KKF</span>
                  <span>{formatINR(kkfAmt)}</span>
                </div>
              )}
              {mudatAmt > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>(+) Mudat (मुदत)</span>
                  <span>{formatINR(mudatAmt)}</span>
                </div>
              )}
              {sgstAmt > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>(+) SGST</span>
                  <span>{formatINR(sgstAmt)}</span>
                </div>
              )}
              {cgstAmt > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>(+) CGST</span>
                  <span>{formatINR(cgstAmt)}</span>
                </div>
              )}
              {igstAmt > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>(+) IGST</span>
                  <span>{formatINR(igstAmt)}</span>
                </div>
              )}

              <div className="border-t pt-2 mt-2 flex justify-between text-base font-bold">
                <span>Net Payable to Trader (व्यापारी को देना)</span>
                <span className="text-green-700">{formatINR(netPayableToTrader)}</span>
              </div>
              <p className="text-xs text-gray-400">
                Trader pays Committee/KKF/GST to govt — these do NOT add to your sarkar dues
              </p>

              <div className="flex justify-between text-sm font-semibold text-purple-700 bg-purple-50 px-3 py-2 rounded-md mt-1">
                <span>Total Stock Cost (stock लागत)</span>
                <span>{formatINR(totalStockCost)}</span>
              </div>

              <p className="text-xs text-gray-400 mt-1">
                Stock cost includes item total + committee + KKF + mudat (GST excluded from stock cost)
              </p>
            </div>
          </div>

          {/* Save */}
          <Button type="submit" disabled={loading} className="w-full h-12 text-base">
            {loading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...</>
            ) : (
              "Save Trader Purchase (व्यापारी खरीद सेव करें)"
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

  const [traders, items, settingRows] = await Promise.all([
    prisma.party.findMany({
      where: { firmId, type: "vyapari", active: true },
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
      traders,
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        hindiName: i.hindiName,
        defaultUnitWeightKg: Number(i.defaultUnitWeightKg),
      })),
      settings,
    },
  };
};
