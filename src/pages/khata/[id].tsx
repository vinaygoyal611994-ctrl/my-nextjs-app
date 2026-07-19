import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatDate } from "@/lib/utils";
import Link from "next/link";
import { Phone, MapPin, FileText, Plus, ArrowLeft, Edit } from "lucide-react";

interface PartyDetail {
  id: number;
  name: string;
  type: string;
  village: string | null;
  mobile: string | null;
  gstin: string | null;
  pan: string | null;
  paymentTermDays: number;
  byajRateOverride: number | null;
  openingBalance: number;
  openingType: string;
  balance: number;
  balanceType: string;
  recentPurchases: { id: number; billNo: string; date: string; totalAmount: number }[];
  recentSales: { id: number; billNo: string; date: string; grandTotal: number }[];
}

const TYPE_LABELS: Record<string, string> = {
  kisan: "Farmer (किसान)", vyapari: "Trader (व्यापारी)", transporter: "Transporter",
  palledar: "Palledar", other: "Other", staff: "Staff (कर्मचारी)",
};

export default function PartyDetailPage({ party }: { party: PartyDetail }) {
  return (
    <Layout title={party.name}>
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Back */}
        <Link href="/khata" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={14} /> Account Book (खाता बुक)
        </Link>

        {/* Header card */}
        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-gray-900">{party.name}</h2>
                <Badge variant="secondary">{TYPE_LABELS[party.type]}</Badge>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                {party.village && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} /> {party.village}
                  </span>
                )}
                {party.mobile && (
                  <span className="flex items-center gap-1">
                    <Phone size={14} /> {party.mobile}
                  </span>
                )}
                {party.gstin && <span>GSTIN: {party.gstin}</span>}
              </div>
            </div>
            <Link href={`/khata/${party.id}/edit`}>
              <Button variant="outline" size="sm" className="gap-1">
                <Edit size={14} /> Edit
              </Button>
            </Link>
          </div>

          {/* Balance big display */}
          <div className={`mt-4 rounded-lg p-4 text-center ${
            party.balanceType === "Dr" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
          }`}>
            <p className="text-sm font-medium text-gray-500 mb-1">
              {party.balanceType === "Dr" ? "Balance Receivable (आप को मिलना है)" : "Balance Payable (आप को देना है)"}
            </p>
            <p className={`text-3xl font-bold ${party.balanceType === "Dr" ? "text-green-600" : "text-red-600"}`}>
              {formatINR(party.balance)}
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          {party.type === "kisan" && (
            <Link href={`/kharid/new?kisanId=${party.id}`}>
              <Button size="sm" className="gap-1"><Plus size={14} /> Purchase (खरीद)</Button>
            </Link>
          )}
          {party.type === "vyapari" && (
            <Link href={`/bikri/new?vyapariId=${party.id}`}>
              <Button size="sm" className="gap-1"><Plus size={14} /> Sale (बिक्री)</Button>
            </Link>
          )}
          {party.type === "staff" && (
            <Link href="/staff">
              <Button size="sm" className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"><Plus size={14} /> Pay Salary (वेतन)</Button>
            </Link>
          )}
          <Link href={`/jama-naame/jama?partyId=${party.id}`}>
            <Button size="sm" variant="outline" className="gap-1"><Plus size={14} /> Receipt (जमा)</Button>
          </Link>
          <Link href={`/jama-naame/naame?partyId=${party.id}`}>
            <Button size="sm" variant="outline" className="gap-1"><Plus size={14} /> Payment (नामे)</Button>
          </Link>
          <Link href={`/ledger/${party.id}`}>
            <Button size="sm" variant="ghost" className="gap-1"><FileText size={14} /> View Account (खाता देखें)</Button>
          </Link>
        </div>

        {/* Recent transactions */}
        {party.recentPurchases.length > 0 && (
          <div className="bg-white rounded-lg border">
            <div className="px-4 py-3 border-b font-semibold text-sm text-gray-700">
              Recent Purchases (हाल की खरीद)
            </div>
            <div className="divide-y">
              {party.recentPurchases.map((p) => (
                <Link
                  key={p.id}
                  href={`/kharid/${p.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-sm"
                >
                  <div>
                    <span className="font-medium">{p.billNo}</span>
                    <span className="text-gray-400 ml-2">{formatDate(p.date)}</span>
                  </div>
                  <span className="font-semibold">{formatINR(p.totalAmount)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {party.recentSales.length > 0 && (
          <div className="bg-white rounded-lg border">
            <div className="px-4 py-3 border-b font-semibold text-sm text-gray-700">
              Recent Sales (हाल की बिक्री)
            </div>
            <div className="divide-y">
              {party.recentSales.map((s) => (
                <Link
                  key={s.id}
                  href={`/bikri/${s.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-sm"
                >
                  <div>
                    <span className="font-medium">{s.billNo}</span>
                    <span className="text-gray-400 ml-2">{formatDate(s.date)}</span>
                  </div>
                  <span className="font-semibold">{formatINR(s.grandTotal)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) return { redirect: { destination: "/auth/login", permanent: false } };

  const id = parseInt(ctx.params?.id as string, 10);
  const firmId = session.user.firmId;

  const p = await prisma.party.findFirst({
    where: { id, firmId },
    include: {
      account: { include: { journalLines: { select: { debit: true, credit: true } } } },
    },
  });
  if (!p) return { notFound: true };

  const [purchases, sales] = await Promise.all([
    prisma.purchase.findMany({
      where: { firmId, kisanId: id, cancelled: false },
      orderBy: { date: "desc" },
      take: 5,
      select: { id: true, billNo: true, date: true, totalAmount: true },
    }),
    prisma.sale.findMany({
      where: { firmId, vyapariId: id, cancelled: false },
      orderBy: { date: "desc" },
      take: 5,
      select: { id: true, billNo: true, date: true, grandTotal: true },
    }),
  ]);

  const ob = Number(p.openingBalance);
  const drTotal = p.account?.journalLines.reduce((s, l) => s + Number(l.debit), 0) ?? 0;
  const crTotal = p.account?.journalLines.reduce((s, l) => s + Number(l.credit), 0) ?? 0;
  const openingDr = p.openingType === "Dr" ? ob : 0;
  const openingCr = p.openingType === "Cr" ? ob : 0;
  const net = openingDr + drTotal - (openingCr + crTotal);

  const party: PartyDetail = {
    id: p.id,
    name: p.name,
    type: p.type,
    village: p.village,
    mobile: p.mobile,
    gstin: p.gstin,
    pan: p.pan,
    paymentTermDays: p.paymentTermDays,
    byajRateOverride: p.byajRateOverride ? Number(p.byajRateOverride) : null,
    openingBalance: ob,
    openingType: p.openingType,
    balance: Math.abs(net),
    balanceType: net >= 0 ? "Dr" : "Cr",
    recentPurchases: purchases.map((x) => ({
      ...x,
      date: x.date.toISOString(),
      totalAmount: Number(x.totalAmount),
    })),
    recentSales: sales.map((x) => ({
      ...x,
      date: x.date.toISOString(),
      grandTotal: Number(x.grandTotal),
    })),
  };

  return { props: { party } };
};
