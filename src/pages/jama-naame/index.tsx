import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatINR, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Search } from "lucide-react";

interface PaymentRow {
  id: number;
  voucherNo: string;
  voucherType: string;
  date: string;
  party: string | null;
  partyType: string | null;
  amount: number;
  mode: string;
  narration: string | null;
}

export default function JamaNaamePage({ payments }: { payments: PaymentRow[] }) {
  const [tab, setTab] = useState<"all" | "receipt" | "payment" | "contra">("all");
  const [search, setSearch] = useState("");

  const filtered = payments.filter((p) => {
    const matchTab = tab === "all" || p.voucherType === tab;
    const matchSearch = !search ||
      p.party?.toLowerCase().includes(search.toLowerCase()) ||
      p.voucherNo.toLowerCase().includes(search.toLowerCase()) ||
      p.narration?.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const TABS = [
    { value: "all", label: "All" },
    { value: "receipt", label: "Receipt (जमा)" },
    { value: "payment", label: "Payment (नामे)" },
    { value: "contra", label: "Contra (Bank↔Cash)" },
  ];

  const MODE_LABELS: Record<string, string> = {
    cash: "Cash", bank: "Bank", upi: "UPI", cheque: "Cheque",
  };

  return (
    <Layout title="Receipt & Payment (जमा-नामे)">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value as typeof tab)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  tab === t.value ? "bg-amber-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search party, voucher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-52 h-9"
              />
            </div>
            <Link href="/jama-naame/jama">
              <Button size="sm" className="gap-1"><ArrowDownLeft size={14} /> Receipt (जमा)</Button>
            </Link>
            <Link href="/jama-naame/naame">
              <Button size="sm" variant="outline" className="gap-1"><ArrowUpRight size={14} /> Payment (नामे)</Button>
            </Link>
            <Link href="/jama-naame/contra">
              <Button size="sm" variant="outline" className="gap-1 border-purple-300 text-purple-700 hover:bg-purple-50"><ArrowLeftRight size={14} /> Contra</Button>
            </Link>
          </div>
        </div>
        <p className="text-xs text-gray-400">{filtered.length} records</p>

        <div className="bg-white rounded-lg border divide-y">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-gray-400">No transactions found</div>
          ) : (
            filtered.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm">{p.voucherNo}</span>
                    {p.voucherType === "contra" ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">Contra (Bank↔Cash)</span>
                    ) : (
                      <Badge variant={p.voucherType === "receipt" ? "lena" : "dena"}>
                        {p.voucherType === "receipt" ? "Receipt (जमा)" : "Payment (नामे)"}
                      </Badge>
                    )}
                    <span className="text-xs text-gray-400">{MODE_LABELS[p.mode]}</span>
                  </div>
                  <p className="text-sm">{p.party ?? (p.voucherType === "contra" ? "Bank ↔ Cash Transfer" : "—")}</p>
                  {p.narration && <p className="text-xs text-gray-400">{p.narration}</p>}
                </div>
                <div className="text-right">
                  <p className={`font-bold ${p.voucherType === "receipt" ? "text-green-600" : p.voucherType === "contra" ? "text-purple-600" : "text-red-600"}`}>
                    {formatINR(p.amount)}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(p.date)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) return { redirect: { destination: "/auth/login", permanent: false } };

  const firmId = session.user.firmId;
  const payments = await prisma.paymentReceipt.findMany({
    where: { firmId, cancelled: false },
    include: { party: { select: { name: true, type: true } } },
    orderBy: { date: "desc" },
    take: 100,
  });

  return {
    props: {
      payments: payments.map((p) => ({
        id: p.id,
        voucherNo: p.voucherNo,
        voucherType: p.voucherType,
        date: p.date.toISOString(),
        party: p.party?.name ?? null,
        partyType: p.party?.type ?? null,
        amount: Number(p.amount),
        mode: p.mode,
        narration: p.narration,
      })),
    },
  };
};
