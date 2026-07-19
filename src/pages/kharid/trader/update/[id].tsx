import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Decimal from "decimal.js";
import { toast } from "sonner";
import type { GetServerSideProps } from "next";
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

interface ItemCatalog {
  id: number;
  name: string;
  hindiName: string | null;
  defaultUnitWeightKg: number;
}

interface PurchaseData {
  id: number;
  billNo: string;
  date: string;
  traderId: number;
  traderName: string;
  traderVillage: string | null;
  committeePct: number;
  kkfPct: number;
  mudatPct: number;
  sgstPct: number;
  cgstPct: number;
  igstPct: number;
  items: {
    itemId: number;
    unitWeightKg: number;
    quantityBags: number;
    totalWeightKg: number;
    ratePerQtl: number;
    amount: number;
    katautiPct: number;
    katautiKg: number;
    netWeightKg: number;
  }[];
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
  committeePct: z.coerce.number().min(0).default(0),
  kkfPct: z.coerce.number().min(0).default(0),
  mudatPct: z.coerce.number().min(0).default(0),
  sgstPct: z.coerce.number().min(0).default(0),
  cgstPct: z.coerce.number().min(0).default(0),
  igstPct: z.coerce.number().min(0).default(0),
  items: z.array(itemRowSchema).min(1),
});
type FormData = z.infer<typeof formSchema>;

export default function EditTraderPurchasePage({
  purchase,
  items,
}: {
  purchase: PurchaseData;
  items: ItemCatalog[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } =
    useForm<FormData>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        date: purchase.date,
        committeePct: purchase.committeePct,
        kkfPct: purchase.kkfPct,
        mudatPct: purchase.mudatPct,
        sgstPct: purchase.sgstPct,
        cgstPct: purchase.cgstPct,
        igstPct: purchase.igstPct,
        items: purchase.items,
      },
    });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchItems      = watch("items");
  const watchCommPct    = Number(watch("committeePct")) || 0;
  const watchKkfPct     = Number(watch("kkfPct")) || 0;
  const watchMudatPct   = Number(watch("mudatPct")) || 0;
  const watchSgstPct    = Number(watch("sgstPct")) || 0;
  const watchCgstPct    = Number(watch("cgstPct")) || 0;
  const watchIgstPct    = Number(watch("igstPct")) || 0;

  // Auto-calculate totals when item fields change
  useEffect(() => {
    watchItems.forEach((item, idx) => {
      const bags    = new Decimal(item.quantityBags || 0);
      const unitWt  = new Decimal(item.unitWeightKg || 40);
      const totalWt = bags.mul(unitWt);
      const katauti = new Decimal(item.katautiKg || 0);
      const netWt   = totalWt.sub(katauti);
      const rate    = new Decimal(item.ratePerQtl || 0);
      const amount  = netWt.div(100).mul(rate);
      setValue(`items.${idx}.totalWeightKg`, totalWt.toDecimalPlaces(3).toNumber());
      setValue(`items.${idx}.netWeightKg`, netWt.toDecimalPlaces(3).toNumber());
      setValue(`items.${idx}.amount`, amount.toDecimalPlaces(2).toNumber());
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(watchItems.map((i) => [i.quantityBags, i.unitWeightKg, i.ratePerQtl, i.katautiKg]))]);

  const totalItemAmount = watchItems.reduce((s, i) => s + (i.amount || 0), 0);
  const committeeAmt    = totalItemAmount * watchCommPct / 100;
  const kkfAmt          = totalItemAmount * watchKkfPct / 100;
  const mudatAmt        = totalItemAmount * watchMudatPct / 100;
  const sgstAmt         = totalItemAmount * watchSgstPct / 100;
  const cgstAmt         = totalItemAmount * watchCgstPct / 100;
  const igstAmt         = totalItemAmount * watchIgstPct / 100;
  const netPayable      = totalItemAmount + committeeAmt + kkfAmt + mudatAmt + sgstAmt + cgstAmt + igstAmt;

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await fetch(`/api/purchases/trader?id=${purchase.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error updating purchase");
      toast.success(`Trader purchase ${purchase.billNo} updated!`);
      router.push(`/kharid/trader/${purchase.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const chargeFields = [
    { key: "committeePct" as const, label: "Committee (%)", amt: committeeAmt },
    { key: "kkfPct" as const,       label: "KKF (%)",       amt: kkfAmt },
    { key: "mudatPct" as const,     label: "Mudat / Bhaav Badha (%)", amt: mudatAmt },
    { key: "sgstPct" as const,      label: "SGST (%)",      amt: sgstAmt },
    { key: "cgstPct" as const,      label: "CGST (%)",      amt: cgstAmt },
    { key: "igstPct" as const,      label: "IGST (%)",      amt: igstAmt },
  ];

  return (
    <Layout title={`Edit — ${purchase.billNo}`}>
      <div className="max-w-2xl mx-auto">
        <Link
          href={`/kharid/trader/${purchase.id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft size={14} /> Back to Purchase
        </Link>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Header */}
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Pencil size={16} className="text-orange-600" />
              <h2 className="font-semibold text-gray-800">Edit Trader Purchase (संशोधन)</h2>
            </div>

            {/* Fixed info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="text-xs text-gray-400 mb-0.5">Bill No. (नहीं बदलेगा)</p>
                <p className="font-mono font-semibold text-gray-700">{purchase.billNo}</p>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-sm">
                <p className="text-xs text-gray-400 mb-0.5">Trader (व्यापारी — नहीं बदलेगा)</p>
                <p className="font-semibold text-gray-800">{purchase.traderName}</p>
                {purchase.traderVillage && (
                  <p className="text-xs text-gray-500">{purchase.traderVillage}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Date (तारीख)</Label>
              <Input type="date" {...register("date")} />
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Commodities (जिन्स)</h3>
              <button
                type="button"
                onClick={() =>
                  append({
                    itemId: 0, unitWeightKg: 40, quantityBags: 0,
                    totalWeightKg: 0, ratePerQtl: 0, amount: 0,
                    katautiPct: 0, katautiKg: 0, netWeightKg: 0,
                  })
                }
                className="text-sm text-orange-600 hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> Add Commodity
              </button>
            </div>

            {fields.map((field, idx) => {
              const itemData = watchItems[idx];
              return (
                <div key={field.id} className="border rounded-lg p-3 space-y-3 bg-orange-50/30">
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
                    <select
                      {...register(`items.${idx}.itemId`)}
                      onChange={(e) => {
                        const item = items.find((i) => i.id === parseInt(e.target.value));
                        if (item) setValue(`items.${idx}.unitWeightKg`, item.defaultUnitWeightKg);
                        setValue(`items.${idx}.itemId`, parseInt(e.target.value));
                      }}
                      className="w-full h-10 border border-input rounded-md px-3 text-sm bg-background"
                    >
                      <option value="0">— Select —</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>{i.hindiName || i.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Weight/Bag (kg)</Label>
                      <Input type="number" step="0.001" {...register(`items.${idx}.unitWeightKg`)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Bags (बोरी) *</Label>
                      <Input type="number" step="0.5" min="0" {...register(`items.${idx}.quantityBags`)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Total Weight (kg)</Label>
                      <Input type="number" readOnly className="bg-gray-50"
                        value={itemData?.totalWeightKg || 0}
                        {...register(`items.${idx}.totalWeightKg`)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Rate (₹/qtl) *</Label>
                      <Input type="number" step="0.01" min="0" {...register(`items.${idx}.ratePerQtl`)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-gray-500">Katauti (kg)</Label>
                      <Input type="number" step="0.001" min="0"
                        {...register(`items.${idx}.katautiKg`)} placeholder="0" />
                    </div>
                    <div className="space-y-1">
                      <Label>Net Weight (kg)</Label>
                      <Input readOnly className="bg-gray-50"
                        value={itemData?.netWeightKg || 0}
                        {...register(`items.${idx}.netWeightKg`)} />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Amount (रकम)</p>
                      <p className="text-lg font-bold">{formatINR(itemData?.amount || 0)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {errors.items && <p className="text-xs text-red-500">Add at least one commodity</p>}
          </div>

          {/* Charges */}
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <h3 className="font-semibold text-gray-800">Charges (शुल्क)</h3>
            {chargeFields.map(({ key, label, amt }) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <Label className="whitespace-nowrap text-sm">{label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" step="0.01" min="0"
                    className="max-w-[120px]"
                    {...register(key)}
                  />
                  <span className="text-sm font-medium text-gray-700 min-w-[110px] text-right">
                    {formatINR(amt)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="bg-white rounded-lg border p-4 space-y-2 text-sm">
            <h3 className="font-semibold text-gray-800 mb-3">Summary (सारांश)</h3>
            <div className="flex justify-between">
              <span className="text-gray-500">Item Total (माल रकम)</span>
              <span className="font-medium">{formatINR(totalItemAmount)}</span>
            </div>
            {committeeAmt > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>(+) Committee</span><span>{formatINR(committeeAmt)}</span>
              </div>
            )}
            {kkfAmt > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>(+) KKF</span><span>{formatINR(kkfAmt)}</span>
              </div>
            )}
            {mudatAmt > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>(+) Mudat</span><span>{formatINR(mudatAmt)}</span>
              </div>
            )}
            {sgstAmt > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>(+) SGST</span><span>{formatINR(sgstAmt)}</span>
              </div>
            )}
            {cgstAmt > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>(+) CGST</span><span>{formatINR(cgstAmt)}</span>
              </div>
            )}
            {igstAmt > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>(+) IGST</span><span>{formatINR(igstAmt)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-2 text-green-700">
              <span>Net Payable to Trader (व्यापारी को देना)</span>
              <span>{formatINR(netPayable)}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Link href={`/kharid/trader/${purchase.id}`} className="flex-1">
              <Button type="button" variant="outline" className="w-full">Cancel</Button>
            </Link>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 h-12 bg-orange-600 hover:bg-orange-700"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Updating...</>
              ) : (
                "Update Purchase (अपडेट करें)"
              )}
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

  // Ensure trader_purchases tables exist
  try {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE stock_lots ADD COLUMN trader_purchase_id INT NULL"
    );
  } catch { /* column already exists */ }

  type HeaderRow = {
    id: number; bill_no: string; date: Date;
    trader_id: number; trader_name: string; trader_village: string | null;
    committee_pct: number; kkf_pct: number; mudat_pct: number;
    sgst_pct: number; cgst_pct: number; igst_pct: number;
    cancelled: number;
  };
  type ItemRow = {
    item_id: number; unit_weight_kg: number; quantity_bags: number;
    total_weight_kg: number; rate_per_qtl: number; amount: number;
    katauti_pct: number; katauti_kg: number; net_weight_kg: number;
  };

  const [headers, items, catalogItems] = await Promise.all([
    prisma.$queryRaw<HeaderRow[]>`
      SELECT tp.id, tp.bill_no, tp.date, tp.trader_id,
             tp.committee_pct, tp.kkf_pct, tp.mudat_pct,
             tp.sgst_pct, tp.cgst_pct, tp.igst_pct, tp.cancelled,
             p.name AS trader_name, p.village AS trader_village
      FROM trader_purchases tp
      JOIN parties p ON p.id = tp.trader_id
      WHERE tp.id = ${id} AND tp.firm_id = ${firmId}
      LIMIT 1
    `,
    prisma.$queryRaw<ItemRow[]>`
      SELECT item_id, unit_weight_kg, quantity_bags, total_weight_kg,
             rate_per_qtl, amount, katauti_pct, katauti_kg, net_weight_kg
      FROM trader_purchase_items
      WHERE trader_purchase_id = ${id}
    `,
    prisma.item.findMany({
      where: { firmId, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const h = headers[0];
  if (!h || h.cancelled) return { notFound: true };

  return {
    props: {
      purchase: {
        id: Number(h.id),
        billNo: h.bill_no,
        date: String(h.date).slice(0, 10),
        traderId: Number(h.trader_id),
        traderName: h.trader_name,
        traderVillage: h.trader_village ?? null,
        committeePct: Number(h.committee_pct),
        kkfPct: Number(h.kkf_pct),
        mudatPct: Number(h.mudat_pct),
        sgstPct: Number(h.sgst_pct),
        cgstPct: Number(h.cgst_pct),
        igstPct: Number(h.igst_pct),
        items: items.map((i) => ({
          itemId: Number(i.item_id),
          unitWeightKg: Number(i.unit_weight_kg),
          quantityBags: Number(i.quantity_bags),
          totalWeightKg: Number(i.total_weight_kg),
          ratePerQtl: Number(i.rate_per_qtl),
          amount: Number(i.amount),
          katautiPct: Number(i.katauti_pct),
          katautiKg: Number(i.katauti_kg),
          netWeightKg: Number(i.net_weight_kg),
        })),
      } as PurchaseData,
      items: catalogItems.map((i) => ({
        id: i.id,
        name: i.name,
        hindiName: i.hindiName,
        defaultUnitWeightKg: Number(i.defaultUnitWeightKg),
      })),
    },
  };
};
