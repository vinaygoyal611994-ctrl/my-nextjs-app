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
interface SaleData {
  id: number; billNo: string; date: string;
  vyapari: { id: number; name: string; village: string | null };
  wagesAmount: number; damiPct: number; committeePct: number; kkfPct: number; mudatPct: number;
  gstType: string; sgstPct: number; cgstPct: number; igstPct: number;
  vehicleNo: string | null; driverName: string | null; biltyNo: string | null; paymentDueDate: string | null;
  items: { itemId: number; unitWeightKg: number; quantityBags: number; totalWeightKg: number; ratePerQtl: number; amount: number }[];
}

const itemRowSchema = z.object({
  itemId: z.coerce.number().int().min(1),
  unitWeightKg: z.coerce.number().positive(),
  quantityBags: z.coerce.number().positive(),
  totalWeightKg: z.coerce.number().positive(),
  ratePerQtl: z.coerce.number().positive(),
  amount: z.coerce.number().positive(),
});

const formSchema = z.object({
  date: z.string(),
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

export default function EditBikriPage({ sale, items }: { sale: SaleData; items: Item[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: sale.date,
      items: sale.items,
      wagesAmount: sale.wagesAmount,
      damiPct: sale.damiPct,
      committeePct: sale.committeePct,
      kkfPct: sale.kkfPct,
      mudatPct: sale.mudatPct,
      gstType: (sale.gstType as "intra" | "inter") || "intra",
      sgstPct: sale.sgstPct,
      cgstPct: sale.cgstPct,
      igstPct: sale.igstPct,
      vehicleNo: sale.vehicleNo ?? "",
      driverName: sale.driverName ?? "",
      biltyNo: sale.biltyNo ?? "",
      paymentDueDate: sale.paymentDueDate ?? "",
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchItems = watch("items");
  const wWages    = Number(watch("wagesAmount")) || 0;
  const wDami     = Number(watch("damiPct")) || 0;
  const wComm     = Number(watch("committeePct")) || 0;
  const wKkf      = Number(watch("kkfPct")) || 0;
  const wMudat    = Number(watch("mudatPct")) || 0;
  const wGstType  = watch("gstType");
  const wSgst     = Number(watch("sgstPct")) || 0;
  const wCgst     = Number(watch("cgstPct")) || 0;
  const wIgst     = Number(watch("igstPct")) || 0;

  useEffect(() => {
    watchItems.forEach((item, idx) => {
      const wt  = new Decimal(item.quantityBags || 0).mul(item.unitWeightKg || 40);
      const amt = wt.div(100).mul(item.ratePerQtl || 0);
      setValue(`items.${idx}.totalWeightKg`, wt.toDecimalPlaces(3).toNumber());
      setValue(`items.${idx}.amount`, amt.toDecimalPlaces(2).toNumber());
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(watchItems.map((i) => [i.quantityBags, i.unitWeightKg, i.ratePerQtl]))]);

  const maalAmount    = watchItems.reduce((s, i) => s + (i.amount || 0), 0);
  const damiAmt       = maalAmount * wDami / 100;
  const committeeAmt  = maalAmount * wComm / 100;
  const kkfAmt        = maalAmount * wKkf / 100;
  const mudatAmt      = maalAmount * wMudat / 100;
  const taxable       = maalAmount + wWages + damiAmt + committeeAmt + kkfAmt + mudatAmt;
  const sgstAmt       = taxable * wSgst / 100;
  const cgstAmt       = taxable * wCgst / 100;
  const igstAmt       = taxable * wIgst / 100;
  const grandTotal    = taxable + sgstAmt + cgstAmt + igstAmt;

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/${sale.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      toast.success(`Sale ${sale.billNo} updated!`);
      router.push(`/bikri/${sale.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout title={`Edit Sale — ${sale.billNo}`}>
      <div className="max-w-2xl mx-auto">
        <Link href={`/bikri/${sale.id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to Sale
        </Link>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Header */}
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Pencil size={16} className="text-blue-600" />
              <h2 className="font-semibold text-gray-800">Edit Sale (बिक्री संशोधन)</h2>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Bill No.</p>
                <p className="font-mono font-semibold text-gray-700">{sale.billNo}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" {...register("date")} />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-0.5">Trader (व्यापारी — नहीं बदलेगा)</p>
              <p className="font-semibold text-gray-800">{sale.vyapari.name}</p>
              {sale.vyapari.village && <p className="text-xs text-gray-500">{sale.vyapari.village}</p>}
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Goods (माल)</h3>
              <button type="button"
                onClick={() => append({ itemId: 0, unitWeightKg: 40, quantityBags: 0, totalWeightKg: 0, ratePerQtl: 0, amount: 0 })}
                className="text-sm text-primary hover:underline flex items-center gap-1">
                <Plus size={14} /> Add Item
              </button>
            </div>

            {fields.map((field, idx) => {
              const d = watchItems[idx];
              return (
                <div key={field.id} className="border rounded-lg p-3 space-y-3 bg-blue-50/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">Item #{idx + 1}</span>
                    {fields.length > 1 && <button type="button" onClick={() => remove(idx)} className="text-red-400"><Trash2 size={16} /></button>}
                  </div>

                  <div className="space-y-1">
                    <Label>Commodity *</Label>
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
                    <div className="space-y-1"><Label>Total Weight (kg)</Label><Input readOnly className="bg-gray-50" value={d?.totalWeightKg || 0} {...register(`items.${idx}.totalWeightKg`)} /></div>
                    <div className="space-y-1"><Label>Rate (₹/qtl) *</Label><Input type="number" step="0.01" min="0" {...register(`items.${idx}.ratePerQtl`)} /></div>
                  </div>
                  <div className="flex justify-end">
                    <div className="text-right"><p className="text-xs text-gray-400">Amount</p><p className="text-lg font-bold">{formatINR(d?.amount || 0)}</p></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Charges */}
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <h3 className="font-semibold text-gray-800">Mandi Charges (%)</h3>
            {[
              { label: "Labour (हम्माली) ₹", field: "wagesAmount" as const, isAmt: true, amt: wWages },
              { label: "Commission/Dami (%)", field: "damiPct" as const, isAmt: false, amt: damiAmt },
              { label: "Committee (%)", field: "committeePct" as const, isAmt: false, amt: committeeAmt },
              { label: "KKF (%)", field: "kkfPct" as const, isAmt: false, amt: kkfAmt },
              { label: "Mudat (%)", field: "mudatPct" as const, isAmt: false, amt: mudatAmt },
            ].map(({ label, field, amt }) => (
              <div key={field} className="flex items-center justify-between gap-4">
                <Label className="whitespace-nowrap text-sm">{label}</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" step="0.01" min="0" className="max-w-[120px]" {...register(field)} />
                  <span className="text-sm text-gray-600 min-w-[90px] text-right">{formatINR(amt)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* GST */}
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <h3 className="font-semibold text-gray-800">GST</h3>
            <div className="flex gap-4">
              {(["intra", "inter"] as const).map((t) => (
                <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" value={t} {...register("gstType")} />
                  <span className="text-sm">{t === "intra" ? "Intra (SGST+CGST)" : "Inter (IGST)"}</span>
                </label>
              ))}
            </div>
            {wGstType === "intra" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>SGST (%)</Label><Input type="number" step="0.01" min="0" {...register("sgstPct")} /></div>
                <div className="space-y-1"><Label>CGST (%)</Label><Input type="number" step="0.01" min="0" {...register("cgstPct")} /></div>
              </div>
            ) : (
              <div className="space-y-1 max-w-[200px]"><Label>IGST (%)</Label><Input type="number" step="0.01" min="0" {...register("igstPct")} /></div>
            )}
          </div>

          {/* Transport */}
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <h3 className="font-semibold text-gray-800">Transport (optional)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Vehicle No.</Label><Input {...register("vehicleNo")} placeholder="MP09..." /></div>
              <div className="space-y-1"><Label>Driver Name</Label><Input {...register("driverName")} /></div>
              <div className="space-y-1"><Label>Bilty No.</Label><Input {...register("biltyNo")} /></div>
              <div className="space-y-1"><Label>Payment Due Date</Label><Input type="date" {...register("paymentDueDate")} /></div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-lg border p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Goods Amount</span><span>{formatINR(maalAmount)}</span></div>
            {wWages > 0 && <div className="flex justify-between"><span className="text-gray-500">(+) Labour</span><span>{formatINR(wWages)}</span></div>}
            {damiAmt > 0 && <div className="flex justify-between"><span className="text-gray-500">(+) Dami</span><span>{formatINR(damiAmt)}</span></div>}
            {committeeAmt > 0 && <div className="flex justify-between"><span className="text-gray-500">(+) Committee</span><span>{formatINR(committeeAmt)}</span></div>}
            {kkfAmt > 0 && <div className="flex justify-between"><span className="text-gray-500">(+) KKF</span><span>{formatINR(kkfAmt)}</span></div>}
            {mudatAmt > 0 && <div className="flex justify-between"><span className="text-gray-500">(+) Mudat</span><span>{formatINR(mudatAmt)}</span></div>}
            <div className="flex justify-between border-t pt-1"><span className="text-gray-500">Taxable</span><span>{formatINR(taxable)}</span></div>
            {sgstAmt > 0 && <div className="flex justify-between text-gray-500"><span>SGST {wSgst}%</span><span>{formatINR(sgstAmt)}</span></div>}
            {cgstAmt > 0 && <div className="flex justify-between text-gray-500"><span>CGST {wCgst}%</span><span>{formatINR(cgstAmt)}</span></div>}
            {igstAmt > 0 && <div className="flex justify-between text-gray-500"><span>IGST {wIgst}%</span><span>{formatINR(igstAmt)}</span></div>}
            <div className="flex justify-between text-lg font-bold border-t pt-2 text-blue-700">
              <span>Grand Total</span><span>{formatINR(grandTotal)}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Link href={`/bikri/${sale.id}`} className="flex-1"><Button type="button" variant="outline" className="w-full">Cancel</Button></Link>
            <Button type="submit" disabled={loading} className="flex-1 h-12 bg-blue-600 hover:bg-blue-700">
              {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Updating...</> : "Update Sale (अपडेट करें)"}
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

  const [sale, items] = await Promise.all([
    prisma.sale.findFirst({
      where: { id, firmId, cancelled: false },
      include: {
        vyapari: { select: { id: true, name: true, village: true } },
        items: true,
      },
    }),
    prisma.item.findMany({ where: { firmId, active: true }, orderBy: { name: "asc" } }),
  ]);

  if (!sale) return { notFound: true };

  return {
    props: {
      sale: {
        id: sale.id, billNo: sale.billNo,
        date: sale.date.toISOString().slice(0, 10),
        vyapari: sale.vyapari,
        wagesAmount: Number(sale.wagesAmount),
        damiPct: Number(sale.damiPct),
        committeePct: Number(sale.committeePct),
        kkfPct: Number(sale.kkfPct),
        mudatPct: Number(sale.mudatPct),
        gstType: sale.gstType ?? "intra",
        sgstPct: Number(sale.sgstPct),
        cgstPct: Number(sale.cgstPct),
        igstPct: Number(sale.igstPct),
        vehicleNo: sale.vehicleNo, driverName: sale.driverName,
        biltyNo: sale.biltyNo,
        paymentDueDate: sale.paymentDueDate ? sale.paymentDueDate.toISOString().slice(0, 10) : null,
        items: sale.items.map((i) => ({
          itemId: i.itemId,
          unitWeightKg: Number(i.unitWeightKg),
          quantityBags: Number(i.quantityBags),
          totalWeightKg: Number(i.totalWeightKg),
          ratePerQtl: Number(i.ratePerQtl),
          amount: Number(i.amount),
        })),
      },
      items: items.map((i) => ({ id: i.id, name: i.name, hindiName: i.hindiName, defaultUnitWeightKg: Number(i.defaultUnitWeightKg) })),
    },
  };
};
