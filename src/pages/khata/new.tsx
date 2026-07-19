import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Loader2, ArrowLeft } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["kisan", "vyapari", "transporter", "palledar", "other", "staff"]),
  village: z.string().optional(),
  mobile: z.string().optional(),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  paymentTermDays: z.coerce.number().int().default(0),
  openingBalance: z.coerce.number().default(0),
  openingType: z.enum(["Dr", "Cr"]).default("Cr"),
  byajRateOverride: z.coerce.number().optional(),
  monthlySalary: z.coerce.number().optional(),
});

type FormData = z.infer<typeof schema>;

const PARTY_TYPES = [
  { value: "kisan", label: "Farmer (किसान)" },
  { value: "vyapari", label: "Trader (व्यापारी)" },
  { value: "transporter", label: "Transporter" },
  { value: "palledar", label: "Palledar" },
  { value: "staff", label: "Staff (कर्मचारी)" },
  { value: "other", label: "Other" },
];

export default function NewPartyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const defaultType = (router.query.type as string) ?? "kisan";

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: defaultType as FormData["type"], openingType: "Cr", paymentTermDays: 0, openingBalance: 0 },
  });

  const partyType = watch("type");

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Error saving party");
      const party = await res.json();
      toast.success(`Account (खाता) created for ${data.name}!`);
      router.push(`/khata/${party.id}`);
    } catch {
      toast.error("Something went wrong, please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout title="New Party">
      <div className="max-w-xl mx-auto">
        <Link href="/khata" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Account Book (खाता बुक)
        </Link>

        <div className="bg-white rounded-lg border p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-800">Add New Party</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Party type */}
            <div className="space-y-1.5">
              <Label>Party Type *</Label>
              <div className="flex flex-wrap gap-2">
                {PARTY_TYPES.map((t) => (
                  <label key={t.value} className="cursor-pointer">
                    <input type="radio" value={t.value} {...register("type")} className="sr-only" />
                    <span className={`inline-block px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                      partyType === t.value
                        ? "bg-amber-700 text-white border-amber-700"
                        : "bg-white text-gray-700 border-gray-200 hover:border-amber-400"
                    }`}>
                      {t.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" placeholder="Full name of party" {...register("name")} />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>

            {/* Village */}
            <div className="space-y-1.5">
              <Label htmlFor="village">Village / Town</Label>
              <Input id="village" placeholder="Village or town name" {...register("village")} />
            </div>

            {/* Mobile */}
            <div className="space-y-1.5">
              <Label htmlFor="mobile">Mobile</Label>
              <Input id="mobile" type="tel" placeholder="10-digit mobile number" {...register("mobile")} />
            </div>

            {/* GSTIN / PAN — for vyapari */}
            {(partyType === "vyapari" || partyType === "other") && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gstin">GSTIN</Label>
                  <Input id="gstin" placeholder="15 digits" {...register("gstin")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pan">PAN</Label>
                  <Input id="pan" placeholder="ABCDE1234F" {...register("pan")} />
                </div>
              </div>
            )}

            {/* Payment terms — for vyapari */}
            {partyType === "vyapari" && (
              <div className="space-y-1.5">
                <Label htmlFor="paymentTermDays">Payment Terms (days)</Label>
                <Input id="paymentTermDays" type="number" min="0" {...register("paymentTermDays")} />
              </div>
            )}

            {/* Byaj rate — for kisan */}
            {partyType === "kisan" && (
              <div className="space-y-1.5">
                <Label htmlFor="byajRateOverride">Interest Rate (ब्याज) (% / month) — leave blank for default</Label>
                <Input id="byajRateOverride" type="number" step="0.01" placeholder="e.g. 1.5" {...register("byajRateOverride")} />
              </div>
            )}

            {/* Monthly salary — for staff */}
            {partyType === "staff" && (
              <div className="space-y-1.5">
                <Label htmlFor="monthlySalary">Monthly Salary (मासिक वेतन) ₹</Label>
                <Input id="monthlySalary" type="number" step="0.01" min="0" placeholder="e.g. 8000" {...register("monthlySalary")} />
                <p className="text-xs text-gray-400">This will be pre-filled when paying salary each month</p>
              </div>
            )}

            {/* Opening balance */}
            <div className="space-y-1.5">
              <Label>Opening Balance (पुरानी बाकी)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...register("openingBalance")}
                  className="flex-1"
                />
                <label className="flex items-center gap-1 px-3 py-2 border rounded-md cursor-pointer">
                  <input type="radio" value="Dr" {...register("openingType")} />
                  <span className="text-sm text-green-600 font-medium">Receivable (Dr)</span>
                </label>
                <label className="flex items-center gap-1 px-3 py-2 border rounded-md cursor-pointer">
                  <input type="radio" value="Cr" {...register("openingType")} />
                  <span className="text-sm text-red-600 font-medium">Payable (Cr)</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Account (खाता बनाएं)
              </Button>
              <Link href="/khata">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) return { redirect: { destination: "/auth/login", permanent: false } };
  return { props: {} };
};
