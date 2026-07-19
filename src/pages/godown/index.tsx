import { useState, useCallback, useEffect } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Layout } from "@/components/layout/Layout";
import { formatINR } from "@/lib/utils";
import {
  Warehouse,
  Package,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  Calendar,
  Lock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lot {
  lotId: number;
  date: string;
  billNo: string | null;
  source: string;
  purchasedBags: number;
  totalWeightKg: number;
  ratePerQtl: number;
  remainingBags: number;
  remainingWeightKg: number;
  gatePassNo: string | null;
}

interface ItemRow {
  itemId: number;
  itemName: string;
  itemHindi: string;
  purchasedBags: number;
  purchasedWeightKg: number;
  soldBags: number;
  soldWeightKg: number;
  remainingBags: number;
  remainingWeightKg: number;
  avgRatePerQtl: number;
  stockValueRs: number;
  lots: Lot[];
}

interface FyClosingInfo {
  fyYear: number;
  closingDate: string;
  closingStockVal: number;
  locked: boolean;
}

interface InventoryData {
  fyYear: number;
  fyStart: string;
  fyEnd: string;
  items: ItemRow[];
  totalRemainingBags: number;
  totalRemainingWeightKg: number;
  totalStockValue: number;
  fyClosing: FyClosingInfo | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function kgToQtlStr(kg: number): string {
  return (kg / 100).toFixed(2);
}

function fmtBags(v: number): string {
  return v % 1 === 0 ? String(v) : v.toFixed(3).replace(/\.?0+$/, "");
}

function fmtKg(kg: number): string {
  return `${kg % 1 === 0 ? String(kg) : kg.toFixed(2)} kg`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function getFyLabel(startYear: number): string {
  return `FY ${startYear}-${String(startYear + 1).slice(2)}`;
}

function getCurrentFyYear(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

// Build a list of selectable FY years (5 years back from current)
function getFyOptions(): number[] {
  const cur = getCurrentFyYear();
  return Array.from({ length: 5 }, (_, i) => cur - i);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LotDetailRow({ lot }: { lot: Lot }) {
  return (
    <tr className="bg-amber-50/60 border-b border-amber-100 text-sm">
      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatDate(lot.date)}</td>
      <td className="px-3 py-2 text-gray-600 font-mono text-xs">{lot.billNo ?? "—"}</td>
      <td className="px-3 py-2 text-gray-700 max-w-[180px] truncate" title={lot.source}>
        {lot.source}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtBags(lot.purchasedBags)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-gray-600">{fmtKg(lot.totalWeightKg)}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        ₹{lot.ratePerQtl.toFixed(2)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-medium text-green-700">
        {fmtBags(lot.remainingBags)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-green-700">
        {fmtKg(lot.remainingWeightKg)}
      </td>
    </tr>
  );
}

function LotDetailCard({ lot }: { lot: Lot }) {
  return (
    <div className="mx-3 mb-2 p-3 bg-amber-50 rounded-lg border border-amber-100 text-sm">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-medium text-gray-800">{lot.source}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatDate(lot.date)}{lot.billNo ? ` • Bill: ${lot.billNo}` : ""}
          </p>
        </div>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
          ₹{lot.ratePerQtl.toFixed(2)}/qtl
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-gray-500">खरीद</p>
          <p className="font-semibold text-gray-700">{fmtBags(lot.purchasedBags)} बोरी</p>
          <p className="text-gray-500">{fmtKg(lot.totalWeightKg)}</p>
        </div>
        <div>
          <p className="text-gray-500">बचा</p>
          <p className="font-semibold text-green-700">{fmtBags(lot.remainingBags)} बोरी</p>
          <p className="text-gray-500">{fmtKg(lot.remainingWeightKg)}</p>
        </div>
      </div>
    </div>
  );
}

interface ItemSummaryRowProps {
  item: ItemRow;
  expanded: boolean;
  onToggle: () => void;
}

function ItemSummaryRow({ item, expanded, onToggle }: ItemSummaryRowProps) {
  const hasLots = item.lots.length > 0;

  return (
    <>
      {/* Desktop main row */}
      <tr
        className={`border-b border-gray-100 hover:bg-amber-50/40 transition-colors cursor-pointer select-none ${
          expanded ? "bg-amber-50/30" : ""
        }`}
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {hasLots ? (
              expanded ? (
                <ChevronDown size={16} className="text-amber-500 flex-shrink-0" />
              ) : (
                <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
              )
            ) : (
              <span className="w-4 flex-shrink-0" />
            )}
            <div>
              <p className="font-semibold text-gray-800">{item.itemHindi}</p>
              <p className="text-xs text-gray-400">{item.itemName}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          <span className="font-medium">{fmtBags(item.purchasedBags)}</span>
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-gray-600">
          {kgToQtlStr(item.purchasedWeightKg)}
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          <span className="text-red-600">{fmtBags(item.soldBags)}</span>
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-red-500">
          {kgToQtlStr(item.soldWeightKg)}
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          <span className="font-semibold text-green-700">{fmtBags(item.remainingBags)}</span>
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-green-700">
          {kgToQtlStr(item.remainingWeightKg)}
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
          {item.avgRatePerQtl > 0 ? `₹${item.avgRatePerQtl.toFixed(2)}` : "—"}
        </td>
        <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-800">
          {item.stockValueRs > 0 ? formatINR(item.stockValueRs) : "—"}
        </td>
      </tr>

      {/* Expanded lot rows (desktop) */}
      {expanded && hasLots && (
        <>
          {/* Sub-header */}
          <tr className="bg-amber-100/60">
            <td colSpan={9} className="px-0 py-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-amber-100">
                    <th className="px-3 py-1.5 text-left text-amber-800 font-semibold w-24">दिनांक</th>
                    <th className="px-3 py-1.5 text-left text-amber-800 font-semibold w-24">Bill No</th>
                    <th className="px-3 py-1.5 text-left text-amber-800 font-semibold">किसान / स्रोत</th>
                    <th className="px-3 py-1.5 text-right text-amber-800 font-semibold w-20">खरीद बोरी</th>
                    <th className="px-3 py-1.5 text-right text-amber-800 font-semibold w-24">वजन (kg)</th>
                    <th className="px-3 py-1.5 text-right text-amber-800 font-semibold w-24">भाव (₹/qtl)</th>
                    <th className="px-3 py-1.5 text-right text-amber-800 font-semibold w-20">बचा (बोरी)</th>
                    <th className="px-3 py-1.5 text-right text-amber-800 font-semibold w-24">बचा वजन</th>
                  </tr>
                </thead>
                <tbody>
                  {item.lots.map((lot) => (
                    <LotDetailRow key={lot.lotId} lot={lot} />
                  ))}
                </tbody>
              </table>
            </td>
          </tr>
        </>
      )}
    </>
  );
}

interface MobileItemCardProps {
  item: ItemRow;
  expanded: boolean;
  onToggle: () => void;
}

function MobileItemCard({ item, expanded, onToggle }: MobileItemCardProps) {
  const hasLots = item.lots.length > 0;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-3">
      {/* Card header — tappable */}
      <button
        className="w-full text-left p-4 flex items-start justify-between gap-2"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800 text-base leading-snug">{item.itemHindi}</p>
          <p className="text-xs text-gray-400 mt-0.5">{item.itemName}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold text-amber-700">{formatINR(item.stockValueRs)}</p>
          <p className="text-xs text-gray-400">स्टॉक मूल्य</p>
        </div>
      </button>

      {/* Summary grid */}
      <div className="px-4 pb-3 grid grid-cols-3 gap-2 text-sm border-t border-gray-100 pt-3">
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-0.5">खरीद</p>
          <p className="font-semibold text-gray-700">{fmtBags(item.purchasedBags)}</p>
          <p className="text-xs text-gray-400">{kgToQtlStr(item.purchasedWeightKg)} qtl</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-red-400 mb-0.5">बिक्री</p>
          <p className="font-semibold text-red-600">{fmtBags(item.soldBags)}</p>
          <p className="text-xs text-red-400">{kgToQtlStr(item.soldWeightKg)} qtl</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-green-500 mb-0.5">बचा</p>
          <p className="font-semibold text-green-700">{fmtBags(item.remainingBags)}</p>
          <p className="text-xs text-green-500">{kgToQtlStr(item.remainingWeightKg)} qtl</p>
        </div>
      </div>

      {item.avgRatePerQtl > 0 && (
        <div className="px-4 pb-3 text-xs text-gray-500">
          औसत भाव: <span className="font-semibold text-gray-700">₹{item.avgRatePerQtl.toFixed(2)}/qtl</span>
        </div>
      )}

      {/* Expand/collapse lots */}
      {hasLots && (
        <div>
          <button
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-amber-600 font-medium border-t border-amber-100 bg-amber-50 hover:bg-amber-100 transition-colors"
            onClick={onToggle}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {expanded ? "लॉट छुपाएं" : `${item.lots.length} लॉट देखें`}
          </button>
          {expanded && (
            <div className="pb-3 pt-2 border-t border-amber-100">
              {item.lots.map((lot) => (
                <LotDetailCard key={lot.lotId} lot={lot} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Year-Close Card ──────────────────────────────────────────────────────────

interface YearCloseCardProps {
  fyYear: number;
  fyEnd: string;
  fyClosing: FyClosingInfo | null;
  onClose: () => void;
  closing: boolean;
}

function YearCloseCard({ fyYear, fyEnd, fyClosing, onClose, closing }: YearCloseCardProps) {
  const fyEndDate = new Date(fyEnd);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isFyOver = fyEndDate < today;

  if (fyClosing?.locked) {
    return (
      <div className="mt-6 border border-green-200 rounded-xl bg-green-50 p-4 flex items-start gap-3">
        <Lock size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold text-green-800">
            {getFyLabel(fyYear)} बंद किया गया
          </p>
          <p className="text-sm text-green-700 mt-0.5">
            {formatDate(fyClosing.closingDate)} को बंद किया गया — समापन स्टॉक मूल्य:{" "}
            <span className="font-bold">{formatINR(fyClosing.closingStockVal)}</span>
          </p>
        </div>
      </div>
    );
  }

  if (!isFyOver) {
    return (
      <div className="mt-6 border border-amber-200 rounded-xl bg-amber-50/50 p-4 flex items-start gap-3">
        <Calendar size={20} className="text-amber-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold text-amber-800">{getFyLabel(fyYear)} अभी चल रहा है</p>
          <p className="text-sm text-amber-700 mt-0.5">
            यह वित्तीय वर्ष {formatDate(fyEnd)} को समाप्त होगा। वर्ष बंद करने का विकल्प तब उपलब्ध होगा।
          </p>
        </div>
      </div>
    );
  }

  // FY is over, not yet closed
  return (
    <div className="mt-6 border border-orange-200 rounded-xl bg-orange-50 p-4">
      <div className="flex items-start gap-3 mb-3">
        <Lock size={20} className="text-orange-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold text-orange-800">{getFyLabel(fyYear)} अभी बंद नहीं हुआ</p>
          <p className="text-sm text-orange-700 mt-0.5">
            वित्तीय वर्ष समाप्त हो गया है ({formatDate(fyEnd)})। समापन स्टॉक मूल्य की गणना करके वर्ष बंद करें।
          </p>
        </div>
      </div>
      <button
        onClick={onClose}
        disabled={closing}
        className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
      >
        <Lock size={15} />
        {closing ? "बंद हो रहा है…" : `${getFyLabel(fyYear)} बंद करें`}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GodownPage() {
  const currentFyYear = getCurrentFyYear();
  const fyOptions = getFyOptions();

  const [selectedFy, setSelectedFy] = useState<number>(currentFyYear);
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [closing, setClosing] = useState(false);
  const [closeMsg, setCloseMsg] = useState<string | null>(null);

  // Fetch inventory data when FY changes or on mount
  const fetchData = useCallback(async (fyYear: number) => {
    setLoading(true);
    setError(null);
    setExpandedItems(new Set());
    setCloseMsg(null);
    try {
      const resp = await fetch(`/api/inventory?fy=${fyYear}`);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${resp.status}`);
      }
      const json: InventoryData = await resp.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "डेटा लोड करने में त्रुटि हुई");
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger on FY select change
  const handleFyChange = (fy: number) => {
    setSelectedFy(fy);
    fetchData(fy);
  };

  // Initial load
  useEffect(() => {
    fetchData(currentFyYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleItem = (itemId: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleYearClose = async () => {
    if (!data) return;
    if (!confirm(`क्या आप ${getFyLabel(data.fyYear)} को बंद करना चाहते हैं? यह क्रिया पूर्ववत नहीं की जा सकती।`)) return;

    setClosing(true);
    setCloseMsg(null);
    try {
      const resp = await fetch("/api/inventory/year-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fyYear: data.fyYear }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "वर्ष बंद नहीं हो सका");
      setCloseMsg(`वर्ष सफलतापूर्वक बंद हो गया। समापन स्टॉक मूल्य: ${formatINR(json.closingStockVal)}`);
      // Reload data to reflect locked state
      await fetchData(data.fyYear);
    } catch (e) {
      setCloseMsg(e instanceof Error ? e.message : "त्रुटि हुई");
    } finally {
      setClosing(false);
    }
  };

  return (
    <Layout title="Stock / Inventory (स्टॉक / गोदाम)">
      {/* ── Page Header ── */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 rounded-xl p-2.5">
            <Warehouse size={24} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Stock / Inventory
            </h1>
            <p className="text-sm text-gray-500">स्टॉक / गोदाम</p>
          </div>
        </div>

        {/* FY Selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 font-medium hidden sm:inline">वित्तीय वर्ष:</span>
          <select
            value={selectedFy}
            onChange={(e) => handleFyChange(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {fyOptions.map((fy) => (
              <option key={fy} value={fy}>
                {getFyLabel(fy)}
                {fy === currentFyYear ? " (चालू)" : ""}
              </option>
            ))}
          </select>

          {data && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
              <Calendar size={12} />
              {data.fyStart} — {data.fyEnd}
            </span>
          )}
        </div>
      </div>

      {/* ── Status Messages ── */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {closeMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          {closeMsg}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <div className="inline-block w-8 h-8 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-400">स्टॉक लोड हो रहा है…</p>
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && data && data.items.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <Package size={48} className="mx-auto mb-4 text-gray-200" />
          <p className="text-lg font-medium text-gray-500">{getFyLabel(data.fyYear)} में कोई स्टॉक नहीं</p>
          <p className="text-sm text-gray-400 mt-1">इस वित्तीय वर्ष में कोई खरीद दर्ज नहीं है।</p>
        </div>
      )}

      {/* ── Main Content ── */}
      {!loading && data && data.items.length > 0 && (
        <>
          {/* ── Desktop Table ── */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-amber-50 border-b border-amber-200">
                    <th className="px-4 py-3 text-left text-amber-800 font-semibold">
                      जिन्स
                    </th>
                    <th className="px-4 py-3 text-right text-amber-800 font-semibold">
                      खरीद (बोरी)
                    </th>
                    <th className="px-4 py-3 text-right text-amber-800 font-semibold">
                      खरीद (क्विं.)
                    </th>
                    <th className="px-4 py-3 text-right text-amber-800 font-semibold">
                      बिक्री (बोरी)
                    </th>
                    <th className="px-4 py-3 text-right text-amber-800 font-semibold">
                      बिक्री (क्विं.)
                    </th>
                    <th className="px-4 py-3 text-right text-amber-800 font-semibold">
                      बचा माल (बोरी)
                    </th>
                    <th className="px-4 py-3 text-right text-amber-800 font-semibold">
                      बचा माल (क्विं.)
                    </th>
                    <th className="px-4 py-3 text-right text-amber-800 font-semibold">
                      औसत भाव
                    </th>
                    <th className="px-4 py-3 text-right text-amber-800 font-semibold">
                      स्टॉक मूल्य
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <ItemSummaryRow
                      key={item.itemId}
                      item={item}
                      expanded={expandedItems.has(item.itemId)}
                      onToggle={() => toggleItem(item.itemId)}
                    />
                  ))}
                </tbody>

                {/* Footer totals */}
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-gray-800">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TrendingDown size={16} className="text-green-600" />
                        कुल योग
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtBags(data.items.reduce((s, i) => s + i.purchasedBags, 0))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                      {kgToQtlStr(data.items.reduce((s, i) => s + i.purchasedWeightKg, 0))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600">
                      {fmtBags(data.items.reduce((s, i) => s + i.soldBags, 0))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-500">
                      {kgToQtlStr(data.items.reduce((s, i) => s + i.soldWeightKg, 0))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-700">
                      {fmtBags(data.totalRemainingBags)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-700">
                      {kgToQtlStr(data.totalRemainingWeightKg)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">—</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-800 text-base">
                      {formatINR(data.totalStockValue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── Mobile Cards ── */}
          <div className="md:hidden space-y-0">
            {data.items.map((item) => (
              <MobileItemCard
                key={item.itemId}
                item={item}
                expanded={expandedItems.has(item.itemId)}
                onToggle={() => toggleItem(item.itemId)}
              />
            ))}

            {/* Mobile Footer Summary */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-3">
              <p className="text-sm font-bold text-amber-800 mb-3">कुल योग</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">कुल बचा माल</p>
                  <p className="font-semibold text-green-700">
                    {fmtBags(data.totalRemainingBags)} बोरी
                  </p>
                  <p className="text-xs text-gray-500">
                    {kgToQtlStr(data.totalRemainingWeightKg)} क्विंटल
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">कुल स्टॉक मूल्य</p>
                  <p className="font-bold text-amber-800 text-base">
                    {formatINR(data.totalStockValue)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Year-Close Section ── */}
          {data && (
            <YearCloseCard
              fyYear={data.fyYear}
              fyEnd={data.fyEnd}
              fyClosing={data.fyClosing}
              onClose={handleYearClose}
              closing={closing}
            />
          )}
        </>
      )}

      {/* Show year-close card even when no items but FY over */}
      {!loading && data && data.items.length === 0 && (
        <YearCloseCard
          fyYear={data.fyYear}
          fyEnd={data.fyEnd}
          fyClosing={data.fyClosing}
          onClose={handleYearClose}
          closing={closing}
        />
      )}
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) return { redirect: { destination: "/auth/login", permanent: false } };
  return { props: {} };
};
