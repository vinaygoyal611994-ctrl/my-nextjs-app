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
import { formatINR } from "@/lib/utils";
import { Plus, Trash2, Loader2, ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";

interface Item { id: number; name: string; hindiName: string | null; defaultUnitWeightKg: number }
interface PurchaseData {
  id: number; billNo: string; date: string; purchaseType: string;
  kisan: { id: number; name: string; village: string | null };
  wagesAmount: number; advanceAdjusted: number; byajAdjusted: number;
  committeePct: number; kkfPct: number;
  items: { itemId: number; unitWeightKg: number; quantityBags: number; totalWeightKg: number; ratePerQtl: number; amount: number; katautiPct: number; katautiKg: number; netWeightKg: number }[];
}

const itemRowSchema = z.object({
  itemId: z.coerce.number().int().min(1, "Select a commodity"),
  unitWeightKg: z.coerce.number().positive(),
  quantityBags: z.coerce.number().positive(),
  totalWeightKg: z.coerce.number().positive(),
  ratePerQtl: z.coerce.number().positive(),
  amount: z.coerce.number().positive(),
  katautiPct: z.coerce.number().min(0).default(0),
  katautiKg: z.coerce.number().min(0).default(0),
  netWeightKg: z.coerce.number().positive(),
});

const formSchema = z.object({
  date: z.string(),
  wagesAmount: z.coerce.number().min(0).default(0),
  advanceAdjusted: z.coerce.number().min(0).default(0),
  byajAdjusted: z.coerce.number().min(0).default(0),
  committeePct: z.coerce.number().min(0).default(0),
  kkfPct: z.coerce.number().min(0).default(0),
  items: z.array(itemRowSchema).min(1),
});
type FormData = z.infer<typeof formSchema>;

export default function EditKharidPage({ purchase, items }: { purchase: PurchaseData; items: Item[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: purchase.date,
      wagesAmount: purchase.wagesAmount,
      advanceAdjusted: purchase.advanceAdjusted,
      byajAdjusted: purchase.byajAdjusted,
      committeePct: purchase.committeePct,
      kkfPct: purchase.kkfPct,
      items: purchase.items,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchItems    = watch("items");
  const watchWages    = Number(watch("wagesAmount")) || 0;
  const watchAdvance  = Number(watch("advanceAdjusted")) || 0;
  const watchByaj     = Number(watch("byajAdjusted")) || 0;
  const watchCommPct  = Number(watch("committeePct")) || 0;
  const watchKkfPct   = Number(watch("kkfPct")) || 0;
  const isKhud        = purchase.purchaseType === "khud";

  useEffect(() => {
    watchItems.forEach((item, idx) => {
      const bags   = new Decimal(item.quantityBags || 0);
      const unitWt = new Decimal(item.unitWeightKg || 40);
      const totalWt = bags.mul(unitWt);
      const rate   = new Decimal(item.ratePerQtl || 0);
      const katauti = new Decimal(item.katautiKg || 0);
      const netWt  = totalWt.sub(katauti);
      const amount = netWt.div(100).mul(rate);
      setValue(`items.${idx}.totalWeightKg`, totalWt.toDecimalPlaces(3).toNumber());
      setValue(`items.${idx}.netWeightKg`,   netWt.toDecimalPlaces(3).toNumber());
      setValue(`items.${idx}.amount`,         amount.toDecimalPlaces(2).toNumber());
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(watchItems.map((i) => [i.quantityBags, i.unitWeightKg, i.ratePerQtl, i.katautiKg]))]);

  const totalAmount  = watchItems.reduce((s, i) => s + (i.amount || 0), 0);
  const committeeAmt = isKhud ? totalAmount * watchCommPct / 100 : 0;
  const kkfAmt       = isKhud ? totalAmount * watchKkfPct / 100 : 0;
  const netPayable   = totalAmount - watchWages - watchAdvance - watchByaj;

  async function onSubmit(data: FormData) {
    if (netPayable < 0) { toast.error("Deductions cannot exceed total amount"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/purchases/${purchase.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      toast.success(`Purchase ${purchase.billNo} updated!`);
      router.push(`/kharid/${purchase.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout title={`Edit Purchase — ${purchase.billNo}`}>
      <div className="max-w-2xl mx-auto">
        <Link href={`/kharid/${purchase.id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to Purchase
        </Link>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Header */}
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Pencil size={16} className="text-amber-600" />
              <h2 className="font-semibold text-gray-800">Edit Purchase (खरीद संशोधन)</h2>
            </div>

            {/* Fixed info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Bill No. (नहीं बदलेगा)</p>
                <p className="font-mono font-semibold text-gray-700">{purchase.billNo}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Type</p>
                <p className="font-medium text-gray-700">{isKhud ? "Own Purchase (खुद)" : "Commission (आढ़त)"}</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-0.5">Farmer (किसान — नहीं बदलेगा)</p>
              <p className="font-semibold text-gray-800">{purchase.kisan.name}</p>
              {purchase.kisan.village && <p className="text-xs text-gray-500">{purchase.kisan.village}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" {...register("date")} />
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Commodity (जिन्स)</h3>
              <button type="button"
                onClick={() => append({ itemId: 0, unitWeightKg: 40, quantityBags: 0, totalWeightKg: 0, ratePerQtl: 0, amount: 0, katautiPct: 0, katautiKg: 0, netWeightKg: 0 })}
                className="text-sm text-primary hover:underline flex items-center gap-1">
                <Plus size={14} /> Add Commodity
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

                  <div className="space-y-1">
                    <Label>Commodity (जिन्स) *</Label>
                    <select {...register(`items.${idx}.itemId`)}
                      onChange={(e) => {
                        const item = items.find((i) => i.id === parseInt(e.target.value));
                        if (item) setValue(`items.${idx}.unitWeightKg`, item.defaultUnitWeightKg);
                        setValue(`items.${idx}.itemId`, parseInt(e.target.value));
                      }}
                      className="w-full h-10 border border-input rounded-md px-3 text-sm bg-background">
                      <option value="0">— Select —</option>
                      {items.map((i) => <option key={i.id} value={i.id}>{i.hindiName || i.name}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Weight/Bag (kg)</Label><Input type="number" step="0.001" {...register(`items.${idx}.unitWeightKg`)} /></div>
                    <div className="space-y-1"><Label>Bags (बोरी) *</Label><Input type="number" step="0.5" min="0" {...register(`items.${idx}.quantityBags`)} /></div>
                    <div className="space-y-1"><Label>Total Weight (kg)</Label><Input type="number" readOnly className="bg-gray-50" value={itemData?.totalWeightKg || 0} {...register(`items.${idx}.totalWeightKg`)} /></div>
                    <div className="space-y-1"><Label>Rate (₹/qtl) *</Label><Input type="number" step="0.01" min="0" {...register(`items.${idx}.ratePerQtl`)} /></div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-gray-500">Katauti (kg)</Label><Input type="number" step="0.001" min="0" {...register(`items.${idx}.katautiKg`)} placeholder="0" /></div>
                    <div className="space-y-1"><Label>Net Weight (kg)</Label><Input readOnly className="bg-gray-50" value={itemData?.netWeightKg || 0} {...register(`items.${idx}.netWeightKg`)} /></div>
                  </div>

                  <div className="flex justify-end">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Amount</p>
                      <p className="text-lg font-bold">{formatINR(itemData?.amount || 0)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {errors.items && <p className="text-xs text-red-500">Add at least one commodity</p>}
          </div>

          {/* Mandi Charges (khud only) */}
          {isKhud && (
            <div className="bg-white rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-gray-800">Mandi Charges (मंडी शुल्क)</h3>
              <div className="flex items-center justify-between gap-4">
                <Label className="whitespace-nowrap">Committee (%)</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" step="0.01" min="0" className="max-w-[120px]" {...register("committeePct")} />
                  <span className="text-sm font-medium text-gray-700 min-w-[100px] text-right">{formatINR(committeeAmt)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="whitespace-nowrap">KKF (%)</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" step="0.01" min="0" className="max-w-[120px]" {...register("kkfPct")} />
                  <span className="text-sm font-medium text-gray-700 min-w-[100px] text-right">{formatINR(kkfAmt)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Deductions + Summary */}
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <h3 className="font-semibold text-gray-800">Deductions (कटौती)</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Label className="whitespace-nowrap">Labour (हम्माली) (₹)</Label>
                <Input type="number" step="0.01" min="0" className="max-w-[180px]" {...register("wagesAmount")} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="whitespace-nowrap">Advance Adj. (उछंती) (₹)</Label>
                <Input type="number" step="0.01" min="0" className="max-w-[180px]" {...register("advanceAdjusted")} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="whitespace-nowrap">Interest Adj. (ब्याज) (₹)</Label>
                <Input type="number" step="0.01" min="0" className="max-w-[180px]" {...register("byajAdjusted")} />
              </div>
            </div>

            <div className="border-t pt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Total Amount</span><span className="font-medium">{formatINR(totalAmount)}</span></div>
              {isKhud && (
                <>
                  <div className="flex justify-between text-blue-600"><span>(+) Committee</span><span>{formatINR(committeeAmt)}</span></div>
                  <div className="flex justify-between text-blue-600"><span>(+) KKF</span><span>{formatINR(kkfAmt)}</span></div>
                </>
              )}
              <div className="flex justify-between text-red-600"><span>(-) Deductions</span><span>-{formatINR(watchWages + watchAdvance + watchByaj)}</span></div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Farmer Payable (किसान को देना)</span>
                <span className={netPayable < 0 ? "text-red-600" : "text-green-600"}>{formatINR(Math.max(0, netPayable))}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Link href={`/kharid/${purchase.id}`} className="flex-1">
              <Button type="button" variant="outline" className="w-full">Cancel</Button>
            </Link>
            <Button type="submit" disabled={loading} className="flex-1 h-12 bg-amber-600 hover:bg-amber-700">
              {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Updating...</> : "Update Purchase (अपडेट करें)"}
            </Button>
          </div>
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

  const [purchase, items, settingRows] = await Promise.all([
    prisma.purchase.findFirst({
      where: { id, firmId, cancelled: false },
      include: {
        kisan: { select: { id: true, name: true, village: true } },
        items: { include: { item: { select: { id: true, name: true } } } },
      },
    }),
    prisma.item.findMany({ where: { firmId, active: true }, orderBy: { name: "asc" } }),
    prisma.setting.findMany({ where: { firmId }, orderBy: { effectiveFrom: "desc" } }),
  ]);

  if (!purchase) return { notFound: true };

  const settingMap: Record<string, string> = {};
  for (const s of settingRows) { if (!settingMap[s.key]) settingMap[s.key] = s.value; }

  // Try to recover committeePct/kkfPct from journal if khud; else use firm defaults
  const defaultCommittee = parseFloat(settingMap["mandi_shulk_pct"] ?? "1");
  const defaultKkf = parseFloat(settingMap["kkf_pct"] ?? "0.5");

  let committeePct = defaultCommittee;
  let kkfPct = defaultKkf;

  if (purchase.purchaseType === "khud" && purchase.journalEntryId) {
    // Recover actual amounts from journal lines
    type JLRow = { account_code: string; credit: string };
    try {
      const lines = await prisma.$queryRaw<JLRow[]>`
        SELECT a.code AS account_code, jl.credit
        FROM journal_lines jl
        JOIN accounts a ON a.id = jl.account_id
        WHERE jl.journal_entry_id = ${purchase.journalEntryId}
          AND a.code IN ('MSHK001','KKFP001','COMM001','KKF001')
      `;
      const totalAmt = Number(purchase.totalAmount);
      for (const l of lines) {
        if (l.account_code === "MSHK001" || l.account_code === "COMM001") committeePct = totalAmt > 0 ? (Number(l.credit) / totalAmt) * 100 : defaultCommittee;
        if (l.account_code === "KKFP001" || l.account_code === "KKF001") kkfPct = totalAmt > 0 ? (Number(l.credit) / totalAmt) * 100 : defaultKkf;
      }
    } catch { /* use defaults */ }
  }

  return {
    props: {
      purchase: {
        id: purchase.id,
        billNo: purchase.billNo,
        date: purchase.date.toISOString().slice(0, 10),
        purchaseType: purchase.purchaseType,
        kisan: purchase.kisan,
        wagesAmount: Number(purchase.wagesAmount),
        advanceAdjusted: Number(purchase.advanceAdjusted),
        byajAdjusted: Number(purchase.byajAdjusted),
        committeePct: Math.round(committeePct * 100) / 100,
        kkfPct: Math.round(kkfPct * 100) / 100,
        items: purchase.items.map((i) => ({
          itemId: i.itemId,
          unitWeightKg: Number(i.unitWeightKg),
          quantityBags: Number(i.quantityBags),
          totalWeightKg: Number(i.totalWeightKg),
          ratePerQtl: Number(i.ratePerQtl),
          amount: Number(i.amount),
          katautiPct: Number(i.katautiPct),
          katautiKg: Number(i.katautiKg),
          netWeightKg: Number(i.netWeightKg),
        })),
      },
      items: items.map((i) => ({ id: i.id, name: i.name, hindiName: i.hindiName, defaultUnitWeightKg: Number(i.defaultUnitWeightKg) })),
    },
  };
};
