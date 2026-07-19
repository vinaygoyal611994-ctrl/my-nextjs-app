import { useEffect, useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR, formatDate } from "@/lib/utils";
import { Phone, MapPin, Share2, Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface LedgerEntry {
  date: string;
  voucherNo: string;
  voucherType: string;
  narration: string | null;
  naame: number;
  jama: number;
  baaki: number;
  baakiType: string;
}

interface LedgerData {
  party: { id: number; name: string; type: string; village: string | null; mobile: string | null };
  openingBalance: number;
  openingType: string;
  entries: LedgerEntry[];
  balance: number;
  balanceType: string;
}

const VOUCHER_LABELS: Record<string, string> = {
  purchase: "Purchase (खरीद)", sale: "Sale (बिक्री)", receipt: "Receipt (जमा)",
  payment: "Payment (नामे)", contra: "Contra", journal: "Journal",
  advance: "Advance (उछंती)", expense: "Expense (खर्चा)",
};

export default function LedgerPage({ initialData }: { initialData: LedgerData }) {
  const [data, setData] = useState<LedgerData>(initialData);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchLedger() {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const res = await fetch(`/api/ledger/${data.party.id}?${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  function handleWhatsApp() {
    if (data.party.mobile) {
      const msg = `${data.party.name} ji,\nYour balance (बाकी): ₹${data.balance.toLocaleString("en-IN")} (${data.balanceType === "Dr" ? "you owe us" : "we owe you"})\n\nThank you`;
      window.open(`https://wa.me/91${data.party.mobile}?text=${encodeURIComponent(msg)}`);
    }
  }

  return (
    <Layout title={`Account (खाता) — ${data.party.name}`}>
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <Link href="/khata" className="inline-flex items-center gap-1 text-sm text-gray-500">
          <ArrowLeft size={14} /> Account Book (खाता बुक)
        </Link>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">{data.party.name}</h2>
              <div className="flex gap-3 text-sm text-gray-500 mt-1">
                {data.party.village && <span className="flex items-center gap-1"><MapPin size={12} />{data.party.village}</span>}
                {data.party.mobile && <span className="flex items-center gap-1"><Phone size={12} />{data.party.mobile}</span>}
              </div>
            </div>
            <div className={`text-right px-4 py-2 rounded-lg ${data.balanceType === "Dr" ? "bg-green-50" : "bg-red-50"}`}>
              <p className="text-xs text-gray-500">{data.balanceType === "Dr" ? "Balance Receivable" : "Balance Payable"}</p>
              <p className={`text-2xl font-bold ${data.balanceType === "Dr" ? "text-green-600" : "text-red-600"}`}>
                {formatINR(data.balance)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            {data.party.mobile && (
              <Button size="sm" variant="outline" onClick={handleWhatsApp} className="gap-1">
                <Share2 size={14} /> WhatsApp
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => window.print()} className="gap-1">
              <Printer size={14} /> Print
            </Button>
          </div>
        </div>

        {/* Date filter */}
        <div className="bg-white rounded-lg border p-3 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">From</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-36" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">To</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-36" />
          </div>
          <Button size="sm" onClick={fetchLedger} disabled={loading}>
            {loading ? "Loading..." : "View"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setDateFrom(""); setDateTo(""); setData(initialData); }}>
            Reset
          </Button>
        </div>

        {/* Bahi-khata style ledger */}
        <div className="bg-white rounded-lg border overflow-hidden print:shadow-none">
          <table className="w-full text-sm bahi-table">
            <thead>
              <tr className="bg-amber-50">
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Description</th>
                <th className="text-right px-3 py-2 text-red-600">Payment (नामे) (Dr)</th>
                <th className="text-right px-3 py-2 text-green-600">Receipt (जमा) (Cr)</th>
                <th className="text-right px-3 py-2">Balance (बाकी)</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening balance row */}
              <tr className="bg-amber-50/60 font-medium">
                <td className="px-3 py-2">—</td>
                <td className="px-3 py-2">Opening Balance (पुरानी बाकी)</td>
                <td className="px-3 py-2 text-right">{data.openingType === "Dr" ? formatINR(data.openingBalance) : "—"}</td>
                <td className="px-3 py-2 text-right">{data.openingType === "Cr" ? formatINR(data.openingBalance) : "—"}</td>
                <td className="px-3 py-2 text-right">
                  <span className={data.openingType === "Dr" ? "text-green-600" : "text-red-600"}>
                    {formatINR(data.openingBalance)} {data.openingType}
                  </span>
                </td>
              </tr>

              {data.entries.map((entry, idx) => (
                <tr key={idx} className="hover:bg-amber-50/30">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500">{formatDate(entry.date)}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{VOUCHER_LABELS[entry.voucherType] ?? entry.voucherType}</p>
                    <p className="text-xs text-gray-400">{entry.voucherNo}</p>
                    {entry.narration && <p className="text-xs text-gray-400">{entry.narration}</p>}
                  </td>
                  <td className="px-3 py-2 text-right text-red-600">
                    {entry.naame > 0 ? formatINR(entry.naame) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-green-600">
                    {entry.jama > 0 ? formatINR(entry.jama) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={entry.baakiType === "Dr" ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                      {formatINR(entry.baaki)} {entry.baakiType}
                    </span>
                  </td>
                </tr>
              ))}

              {data.entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    No transactions in this period
                  </td>
                </tr>
              )}

              {/* Closing balance */}
              <tr className="bg-amber-100 font-bold">
                <td className="px-3 py-2" colSpan={2}>Closing Balance</td>
                <td className="px-3 py-2 text-right text-red-600">—</td>
                <td className="px-3 py-2 text-right text-green-600">—</td>
                <td className="px-3 py-2 text-right">
                  <span className={data.balanceType === "Dr" ? "text-green-600" : "text-red-600"}>
                    {formatINR(data.balance)} {data.balanceType}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) return { redirect: { destination: "/auth/login", permanent: false } };

  const partyId = parseInt(ctx.params?.id as string, 10);
  const firmId = session.user.firmId;

  // Fetch via internal logic (same as API)
  const party = await prisma.party.findFirst({
    where: { id: partyId, firmId },
    include: { account: { include: { journalLines: { include: { journalEntry: true } } } } },
  });
  if (!party) return { notFound: true };

  const ob = Number(party.openingBalance);
  const openingDr = party.openingType === "Dr" ? ob : 0;
  const openingCr = party.openingType === "Cr" ? ob : 0;

  let runDr = openingDr;
  let runCr = openingCr;

  const sortedLines = (party.account?.journalLines ?? [])
    .filter((l) => !l.journalEntry.cancelled)
    .sort((a, b) => new Date(a.journalEntry.date).getTime() - new Date(b.journalEntry.date).getTime());

  const entries: LedgerEntry[] = sortedLines.map((line) => {
    const dr = Number(line.debit);
    const cr = Number(line.credit);
    runDr += dr;
    runCr += cr;
    const net = runDr - runCr;
    return {
      date: line.journalEntry.date.toISOString(),
      voucherNo: line.journalEntry.voucherNo,
      voucherType: line.journalEntry.voucherType,
      narration: line.journalEntry.narration,
      naame: dr,
      jama: cr,
      baaki: Math.abs(net),
      baakiType: net >= 0 ? "Dr" : "Cr",
    };
  });

  const finalNet = runDr - runCr;

  return {
    props: {
      initialData: {
        party: { id: party.id, name: party.name, type: party.type, village: party.village, mobile: party.mobile },
        openingBalance: ob,
        openingType: party.openingType,
        entries,
        balance: Math.abs(finalNet),
        balanceType: finalNet >= 0 ? "Dr" : "Cr",
      } as LedgerData,
    },
  };
};
