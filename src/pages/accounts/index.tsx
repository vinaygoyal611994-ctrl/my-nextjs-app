import { useState, useEffect } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Layout } from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChevronRight, BookOpen, Search, Plus, X, Sparkles, Landmark } from "lucide-react";

interface AccountRow {
  id: number;
  code: string;
  name: string;
  type: string;
  subType: string;
  isSystem: boolean;
  isGovtDues: boolean;
  partyName: string | null;
  partyType: string | null;
  totalDebit: number;
  totalCredit: number;
  netDr: number; // totalDebit - totalCredit; positive = Dr balance
}

interface GroupConfig {
  key: string;
  label: string;
  color: string;
  filter: (a: AccountRow) => boolean;
}

const GROUPS: GroupConfig[] = [
  {
    key: "cash_bank",
    label: "नकद व बैंक (Cash & Bank)",
    color: "bg-blue-50 border-blue-200 text-blue-900",
    filter: (a) => a.subType === "cash" || a.subType === "bank",
  },
  {
    key: "receivable",
    label: "देनदार (Receivable — Vyapari)",
    color: "bg-green-50 border-green-200 text-green-900",
    filter: (a) => a.subType === "receivable",
  },
  {
    key: "payable",
    label: "देयता (Payable — Kisan / Labour / Tax)",
    color: "bg-orange-50 border-orange-200 text-orange-900",
    filter: (a) => a.subType === "payable",
  },
  {
    key: "income",
    label: "आय (Income / Commission)",
    color: "bg-emerald-50 border-emerald-200 text-emerald-900",
    filter: (a) => a.type === "income",
  },
  {
    key: "direct_expense",
    label: "खरीद खर्च (Purchase Accounts)",
    color: "bg-purple-50 border-purple-200 text-purple-900",
    filter: (a) => a.subType === "direct_expense",
  },
  {
    key: "indirect_expense",
    label: "अप्रत्यक्ष खर्च (Indirect Expenses)",
    color: "bg-red-50 border-red-200 text-red-900",
    filter: (a) => a.subType === "indirect_expense",
  },
  {
    key: "capital",
    label: "पूंजी (Capital)",
    color: "bg-amber-50 border-amber-200 text-amber-900",
    filter: (a) => a.type === "capital",
  },
  {
    key: "advance",
    label: "उछंती (Advance)",
    color: "bg-sky-50 border-sky-200 text-sky-900",
    filter: (a) => a.subType === "advance",
  },
  {
    key: "other",
    label: "अन्य (Other)",
    color: "bg-gray-50 border-gray-200 text-gray-900",
    filter: (a) => a.subType === "other",
  },
];

function isNormalDr(type: string) {
  return type === "asset" || type === "expense";
}

// ── Keyword → type/subType auto-suggest ───────────────────────────────────────
type AccountType    = "asset"|"liability"|"income"|"expense"|"capital";
type AccountSubType = "cash"|"bank"|"receivable"|"payable"|"income"|"direct_expense"|"indirect_expense"|"stock"|"capital"|"advance"|"other";

interface Suggestion { type: AccountType; subType: AccountSubType; reason: string }

const KEYWORD_RULES: { words: string[]; type: AccountType; subType: AccountSubType; reason: string }[] = [
  { words: ["tds","tax deduct","tax deducted at source"],         type:"liability",  subType:"payable",          reason:"TDS → Liability (govt को देना है)" },
  { words: ["gst payable","sgst","cgst","igst payable"],         type:"liability",  subType:"payable",          reason:"GST Payable → Liability" },
  { words: ["gst input","input tax","gst receivable"],           type:"asset",      subType:"other",            reason:"GST Input Credit → Asset" },
  { words: ["loan","overdraft","borrowing","borrow","rin"],      type:"liability",  subType:"other",            reason:"Loan → Liability" },
  { words: ["advance given","loan given","loan to"],             type:"asset",      subType:"advance",          reason:"Advance Given → Asset" },
  { words: ["depreciation","amortiz"],                           type:"expense",    subType:"indirect_expense", reason:"Depreciation → Indirect Expense" },
  { words: ["rent","kiraya"],                                    type:"expense",    subType:"indirect_expense", reason:"Rent → Indirect Expense" },
  { words: ["salary","salari","wages","mazdoori","labour"],      type:"expense",    subType:"indirect_expense", reason:"Salary/Wages → Indirect Expense" },
  { words: ["electric","bijli","utility","telephone","internet","mobile bill"], type:"expense", subType:"indirect_expense", reason:"Utility → Indirect Expense" },
  { words: ["repair","maintain","rakhrakhaav"],                  type:"expense",    subType:"indirect_expense", reason:"Repair → Indirect Expense" },
  { words: ["insurance","bima"],                                 type:"expense",    subType:"indirect_expense", reason:"Insurance → Indirect Expense" },
  { words: ["purchase","kharid","kharidi","buy"],                type:"expense",    subType:"direct_expense",   reason:"Purchase → Direct Expense" },
  { words: ["commission","aadhat","dami","brokerage"],           type:"income",     subType:"income",           reason:"Commission → Income" },
  { words: ["interest income","byaj aay","byaj income"],         type:"income",     subType:"income",           reason:"Interest Income → Income" },
  { words: ["sales","bikri","revenue","income","aay"],           type:"income",     subType:"income",           reason:"Sales/Income → Income" },
  { words: ["capital","punji","proprietor","owner fund","malik"],type:"capital",    subType:"capital",          reason:"Capital → Capital Account" },
  { words: ["cash","nakit","naqdee"],                            type:"asset",      subType:"cash",             reason:"Cash → Asset (Cash)" },
  { words: ["bank","savings","current account","khata"],         type:"asset",      subType:"bank",             reason:"Bank → Asset (Bank)" },
  { words: ["stock","inventory","maal","godown"],                type:"asset",      subType:"stock",            reason:"Stock → Asset" },
  { words: ["receivable","debtor","dena","outstanding"],         type:"asset",      subType:"receivable",       reason:"Receivable → Asset" },
  { words: ["payable","creditor","lena","deyndar"],              type:"liability",  subType:"payable",          reason:"Payable → Liability" },
];

function autoSuggest(name: string): Suggestion | null {
  const lower = name.toLowerCase().trim();
  if (!lower) return null;
  for (const rule of KEYWORD_RULES) {
    if (rule.words.some((w) => lower.includes(w))) {
      return { type: rule.type, subType: rule.subType, reason: rule.reason };
    }
  }
  return null;
}

const TYPE_LABELS: Record<AccountType, string>    = { asset:"Asset (संपत्ति)", liability:"Liability (देनदारी)", income:"Income (आय)", expense:"Expense (खर्च)", capital:"Capital (पूँजी)" };
const SUBTYPE_LABELS: Record<AccountSubType, string> = {
  cash:"Cash",bank:"Bank",receivable:"Receivable",payable:"Payable",
  income:"Income",direct_expense:"Direct Expense",indirect_expense:"Indirect Expense",
  stock:"Stock",capital:"Capital",advance:"Advance",other:"Other",
};
const SUBTYPE_BY_TYPE: Record<AccountType, AccountSubType[]> = {
  asset:     ["cash","bank","receivable","advance","stock","other"],
  liability: ["payable","other"],
  income:    ["income"],
  expense:   ["direct_expense","indirect_expense"],
  capital:   ["capital"],
};

function NewAccountModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name,        setName]        = useState("");
  const [type,        setType]        = useState<AccountType|"">("");
  const [subType,     setSubType]     = useState<AccountSubType|"">("");
  const [isGovtDues,  setIsGovtDues]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState("");
  const [suggestion,  setSuggestion]  = useState<Suggestion|null>(null);

  useEffect(() => {
    const s = autoSuggest(name);
    setSuggestion(s);
  }, [name]);

  function applySuggestion() {
    if (!suggestion) return;
    setType(suggestion.type);
    setSubType(suggestion.subType);
  }

  // When type changes, reset subType if incompatible
  function handleTypeChange(t: AccountType) {
    setType(t);
    const valid = SUBTYPE_BY_TYPE[t];
    if (!valid.includes(subType as AccountSubType)) setSubType(valid[0]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!name.trim()) { setErr("नाम डालें"); return; }
    if (!type)        { setErr("Type चुनें"); return; }
    if (!subType)     { setErr("Sub-type चुनें"); return; }

    setSaving(true);
    try {
      const r = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type, subType, isGovtDues }),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error?.message ?? "Error"); return; }
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const validSubTypes = type ? SUBTYPE_BY_TYPE[type as AccountType] : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-gray-900">New Account (नया खाता)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{err}</div>}

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Account Name (खाते का नाम) *</label>
            <input
              autoFocus
              type="text"
              placeholder="e.g. TDS Payable, Rent Expense, Bank Loan..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Auto-suggest pill */}
          {suggestion && (
            <button
              type="button"
              onClick={applySuggestion}
              className="w-full flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-left hover:bg-amber-100 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-800">Auto-suggest: {suggestion.reason}</p>
                <p className="text-xs text-amber-600">Click to apply — {TYPE_LABELS[suggestion.type]} / {SUBTYPE_LABELS[suggestion.subType]}</p>
              </div>
            </button>
          )}

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Account Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TYPE_LABELS) as AccountType[]).map((t) => (
                <button
                  key={t} type="button"
                  onClick={() => handleTypeChange(t)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border text-left transition-colors ${
                    type === t ? "bg-amber-600 text-white border-amber-600" : "bg-white text-gray-600 border-gray-200 hover:border-amber-300"
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Sub-type */}
          {type && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Sub-type *</label>
              <div className="flex flex-wrap gap-2">
                {validSubTypes.map((st) => (
                  <button
                    key={st} type="button"
                    onClick={() => setSubType(st)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-colors ${
                      subType === st ? "bg-amber-600 text-white border-amber-600" : "bg-white text-gray-600 border-gray-200 hover:border-amber-300"
                    }`}
                  >
                    {SUBTYPE_LABELS[st]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Govt Dues checkbox — only for payable liabilities */}
          {type === "liability" && subType === "payable" && (
            <label className="flex items-center gap-2.5 cursor-pointer bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
              <input
                type="checkbox"
                checked={isGovtDues}
                onChange={(e) => setIsGovtDues(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              <div>
                <p className="text-xs font-semibold text-blue-800">Sarkari Dues mein track karein</p>
                <p className="text-xs text-blue-600">यह account Sarkar Dues page में दिखेगा (TDS, Cess, आदि)</p>
              </div>
            </label>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
              {saving ? "Saving..." : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AccountsPage({ accounts: initialAccounts }: { accounts: AccountRow[] }) {
  const router = useRouter();
  const [search, setSearch]             = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [accounts, setAccounts]         = useState(initialAccounts);

  async function toggleGovtDues(id: number, current: boolean) {
    await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isGovtDues: !current }),
    });
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isGovtDues: !current } : a))
    );
  }

  const filtered = search
    ? accounts.filter(
        (a) =>
          (a.partyName ?? a.name).toLowerCase().includes(search.toLowerCase()) ||
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.code.toLowerCase().includes(search.toLowerCase())
      )
    : accounts;

  return (
    <Layout title="Chart of Accounts (सभी खाते)">
      {showNewModal && (
        <NewAccountModal
          onClose={() => setShowNewModal(false)}
          onCreated={() => { setShowNewModal(false); void router.replace(router.asPath); }}
        />
      )}
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-amber-700" />
            <h1 className="text-xl font-bold text-gray-800">Chart of Accounts (सभी खाते)</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search account or party..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-56 h-9"
              />
            </div>
            <p className="text-sm text-gray-500">{filtered.length} accounts</p>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-1.5 bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Account
            </button>
          </div>
        </div>

        {search && filtered.length === 0 && (
          <div className="bg-white rounded-lg border py-12 text-center text-gray-400">
            No accounts matching &ldquo;{search}&rdquo;
          </div>
        )}

        {GROUPS.map((group) => {
          const rows = filtered.filter(group.filter);
          if (rows.length === 0) return null;

          const groupTotalDr = rows.reduce((s, a) => s + a.totalDebit, 0);
          const groupTotalCr = rows.reduce((s, a) => s + a.totalCredit, 0);

          return (
            <div key={group.key} className="bg-white rounded-lg border overflow-hidden shadow-sm">
              <div className={`px-4 py-2.5 border-b flex items-center justify-between ${group.color}`}>
                <h2 className="font-semibold text-sm">{group.label}</h2>
                <span className="text-xs opacity-70">{rows.length} accounts</span>
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 w-24">Code</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Account Name</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 w-36">Total Debit (Dr)</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 w-36">Total Credit (Cr)</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 w-32">Balance</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((a) => {
                      const drBal = a.netDr > 0 ? a.netDr : 0;
                      const crBal = a.netDr < 0 ? Math.abs(a.netDr) : 0;
                      const normalDr = isNormalDr(a.type);
                      const isAbnormal = (normalDr && crBal > 0) || (!normalDr && drBal > 0);
                      return (
                        <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5">
                            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">{a.code}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link href={`/accounts/${a.id}`} className="font-medium text-gray-800 hover:text-amber-700 transition-colors">
                                {a.partyName ?? a.name}
                              </Link>
                              {a.type === "liability" && a.subType === "payable" && (
                                <button
                                  onClick={() => toggleGovtDues(a.id, a.isGovtDues)}
                                  title={a.isGovtDues ? "Sarkar Dues se hatao" : "Sarkar Dues mein add karo"}
                                  className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                                    a.isGovtDues
                                      ? "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200"
                                      : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                                  }`}
                                >
                                  <Landmark size={10} />
                                  {a.isGovtDues ? "Sarkar Dues ✓" : "Sarkar Dues?"}
                                </button>
                              )}
                            </div>
                            {a.partyName && a.name !== a.partyName && (
                              <p className="text-xs text-gray-400">{a.name}</p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{formatINR(a.totalDebit)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{formatINR(a.totalCredit)}</td>
                          <td className="px-4 py-2.5 text-right">
                            {drBal > 0 ? (
                              <span className={`font-semibold ${isAbnormal ? "text-red-600" : "text-blue-700"}`}>
                                {formatINR(drBal)} Dr
                              </span>
                            ) : crBal > 0 ? (
                              <span className={`font-semibold ${isAbnormal ? "text-red-600" : "text-green-700"}`}>
                                {formatINR(crBal)} Cr
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2.5">
                            <Link href={`/accounts/${a.id}`}>
                              <ChevronRight size={16} className="text-gray-300 hover:text-gray-600" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t bg-gray-50">
                    <tr>
                      <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-gray-500">Group Total</td>
                      <td className="px-4 py-2 text-right text-xs font-semibold text-gray-600">{formatINR(groupTotalDr)}</td>
                      <td className="px-4 py-2 text-right text-xs font-semibold text-gray-600">{formatINR(groupTotalCr)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y">
                {rows.map((a) => {
                  const drBal = a.netDr > 0 ? a.netDr : 0;
                  const crBal = a.netDr < 0 ? Math.abs(a.netDr) : 0;
                  return (
                    <Link key={a.id} href={`/accounts/${a.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                      <div>
                        <p className="font-medium text-sm">{a.partyName ?? a.name}</p>
                        <p className="text-xs text-gray-400">{a.code}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {drBal > 0 ? (
                          <span className="font-semibold text-sm text-blue-700">{formatINR(drBal)} Dr</span>
                        ) : crBal > 0 ? (
                          <span className="font-semibold text-sm text-green-700">{formatINR(crBal)} Cr</span>
                        ) : (
                          <span className="text-gray-400 text-sm">Nil</span>
                        )}
                        <ChevronRight size={14} className="text-gray-300" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) return { redirect: { destination: "/auth/login", permanent: false } };
  const firmId = session.user.firmId;

  type BalanceRow = { account_id: number; total_debit: string; total_credit: string };
  const balanceRows = await prisma.$queryRaw<BalanceRow[]>`
    SELECT jl.account_id,
           COALESCE(SUM(jl.debit), 0)  AS total_debit,
           COALESCE(SUM(jl.credit), 0) AS total_credit
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE je.firm_id = ${firmId} AND je.cancelled = 0
    GROUP BY jl.account_id
  `;

  const balanceMap = new Map(
    balanceRows.map((r) => [
      Number(r.account_id),
      { dr: Number(r.total_debit), cr: Number(r.total_credit) },
    ])
  );

  // Ensure column exists (MySQL doesn't support ADD COLUMN IF NOT EXISTS)
  type ColCheck = { cnt: bigint };
  const [colRow] = await prisma.$queryRaw<ColCheck[]>`
    SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accounts' AND COLUMN_NAME = 'is_govt_dues'
  `;
  if (Number(colRow.cnt) === 0) {
    await prisma.$executeRaw`ALTER TABLE accounts ADD COLUMN is_govt_dues TINYINT(1) NOT NULL DEFAULT 0`;
  }

  // Rename COMM001→MSHK001 if MSHK001 doesn't exist yet
  await prisma.$executeRaw`
    UPDATE accounts SET code = 'MSHK001', name = 'Mandi Shulk Payable', is_govt_dues = 1
    WHERE firm_id = ${firmId} AND code = 'COMM001'
      AND NOT EXISTS (SELECT 1 FROM (SELECT id FROM accounts WHERE firm_id = ${firmId} AND code = 'MSHK001') x)
  `;
  await prisma.$executeRaw`
    UPDATE journal_lines jl
    JOIN accounts old_acc ON old_acc.id = jl.account_id AND old_acc.firm_id = ${firmId} AND old_acc.code = 'COMM001'
    JOIN accounts new_acc ON new_acc.firm_id = ${firmId} AND new_acc.code = 'MSHK001'
    SET jl.account_id = new_acc.id
  `;
  await prisma.$executeRaw`
    UPDATE accounts SET code = 'KKFP001', name = 'KK Fees Payable', is_govt_dues = 1
    WHERE firm_id = ${firmId} AND code = 'KKF001'
      AND NOT EXISTS (SELECT 1 FROM (SELECT id FROM accounts WHERE firm_id = ${firmId} AND code = 'KKFP001') x)
  `;
  await prisma.$executeRaw`
    UPDATE journal_lines jl
    JOIN accounts old_acc ON old_acc.id = jl.account_id AND old_acc.firm_id = ${firmId} AND old_acc.code = 'KKF001'
    JOIN accounts new_acc ON new_acc.firm_id = ${firmId} AND new_acc.code = 'KKFP001'
    SET jl.account_id = new_acc.id
  `;
  // Mark system dues accounts
  await prisma.$executeRaw`
    UPDATE accounts SET is_govt_dues = 1
    WHERE firm_id = ${firmId} AND code IN ('MSHK001','KKFP001','SGST001','CGST001','IGST001')
  `;

  type GovtRow = { id: number; is_govt_dues: number };
  const [accounts, govtRows] = await Promise.all([
    prisma.account.findMany({
      where: { firmId, active: true },
      include: { parties: { select: { id: true, name: true, type: true } } },
      orderBy: [{ subType: "asc" }, { name: "asc" }],
    }),
    prisma.$queryRaw<GovtRow[]>`
      SELECT id, is_govt_dues FROM accounts WHERE firm_id = ${firmId} AND active = 1
    `,
  ]);

  const govtMap = new Map(govtRows.map((r) => [Number(r.id), Boolean(r.is_govt_dues)]));

  const rows: AccountRow[] = accounts.map((a) => {
    const bal = balanceMap.get(a.id) ?? { dr: 0, cr: 0 };
    const party = a.parties[0] ?? null;
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      subType: a.subType,
      isSystem: a.isSystem,
      isGovtDues: govtMap.get(a.id) ?? false,
      partyName: party?.name ?? null,
      partyType: party?.type ?? null,
      totalDebit: bal.dr,
      totalCredit: bal.cr,
      netDr: bal.dr - bal.cr,
    };
  });

  return { props: { accounts: rows } };
};
