import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/utils";
import Link from "next/link";
import { Plus, Search, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";

interface Party {
  id: number;
  name: string;
  type: string;
  village: string | null;
  mobile: string | null;
  balance: number;
  balanceType: string;
}

const TYPE_LABELS: Record<string, string> = {
  kisan: "Farmer (किसान)",
  vyapari: "Trader (व्यापारी)",
  transporter: "Transporter",
  palledar: "Palledar",
  other: "Other",
  staff: "Staff (कर्मचारी)",
};

const TYPE_FILTER = [
  { value: "", label: "All" },
  { value: "kisan", label: "Farmer (किसान)" },
  { value: "vyapari", label: "Trader (व्यापारी)" },
  { value: "transporter", label: "Transporter" },
  { value: "palledar", label: "Palledar" },
  { value: "staff", label: "Staff (कर्मचारी)" },
];

export default function KhataBook({ parties: initialParties }: { parties: Party[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [parties] = useState<Party[]>(initialParties);

  const filtered = parties.filter((p) => {
    const matchType = !typeFilter || p.type === typeFilter;
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.village?.toLowerCase().includes(search.toLowerCase()) ||
      p.mobile?.includes(search);
    return matchType && matchSearch;
  });

  return (
    <Layout title="Account Book (खाता बुक)">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by Name, Village or Mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {TYPE_FILTER.map((f) => (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  typeFilter === f.value
                    ? "bg-amber-700 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Link href="/khata/new">
            <Button className="gap-2 whitespace-nowrap">
              <Plus size={16} /> New Party
            </Button>
          </Link>
        </div>

        {/* Party list */}
        <div className="bg-white rounded-lg border divide-y">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <p className="text-lg">No party found</p>
              <p className="text-sm mt-1">Click the button above to add a new party</p>
            </div>
          ) : (
            filtered.map((party) => (
              <Link
                key={party.id}
                href={`/khata/${party.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 font-semibold text-sm flex-shrink-0">
                    {party.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{party.name}</p>
                    <p className="text-xs text-gray-500">
                      {TYPE_LABELS[party.type] ?? party.type}
                      {party.village ? ` • ${party.village}` : ""}
                      {party.mobile ? ` • ${party.mobile}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className={`font-semibold text-sm ${party.balanceType === "Dr" ? "text-green-600" : "text-red-600"}`}>
                      {formatINR(party.balance)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {party.balanceType === "Dr" ? "Receivable" : "Payable"}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300" />
                </div>
              </Link>
            ))
          )}
        </div>

        <p className="text-sm text-gray-400 text-right">
          Total {filtered.length} parties
        </p>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) return { redirect: { destination: "/auth/login", permanent: false } };

  const firmId = session.user.firmId;
  const rawParties = await prisma.party.findMany({
    where: { firmId, active: true },
    include: {
      account: { include: { journalLines: { select: { debit: true, credit: true } } } },
    },
    orderBy: { name: "asc" },
  });

  const parties: Party[] = rawParties.map((p) => {
    const ob = Number(p.openingBalance);
    const drTotal = p.account?.journalLines.reduce((s, l) => s + Number(l.debit), 0) ?? 0;
    const crTotal = p.account?.journalLines.reduce((s, l) => s + Number(l.credit), 0) ?? 0;
    const openingDr = p.openingType === "Dr" ? ob : 0;
    const openingCr = p.openingType === "Cr" ? ob : 0;
    const net = openingDr + drTotal - (openingCr + crTotal);
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      village: p.village,
      mobile: p.mobile,
      balance: Math.abs(net),
      balanceType: net >= 0 ? "Dr" : "Cr",
    };
  });

  return { props: { parties } };
};
