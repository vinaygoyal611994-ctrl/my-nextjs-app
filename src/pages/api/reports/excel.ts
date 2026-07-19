import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

const TYPE_LABEL: Record<string, string> = {
  asset: "Assets (संपत्ति)",
  liability: "Liabilities (देनदारियाँ)",
  income: "Income (आय)",
  expense: "Expenses (खर्चे)",
  capital: "Capital (पूँजी)",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const firmId = session.user.firmId;

  const { from, to, tab } = req.query;
  const activeTab = (tab as string) || "trial";

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = new Date(from as string);
  if (to) { const d = new Date(to as string); d.setHours(23, 59, 59, 999); dateFilter.lte = d; }

  const firm = await prisma.firm.findUnique({
    where: { id: firmId },
    select: { name: true },
  });

  const accounts = await prisma.account.findMany({
    where: { firmId, active: true },
    select: { id: true, code: true, name: true, type: true },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });

  const lines = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: {
      journalEntry: {
        firmId,
        cancelled: false,
        ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
      },
    },
    _sum: { debit: true, credit: true },
  });

  const lineMap = new Map(lines.map((l) => [l.accountId, l]));

  const data = accounts
    .map((acc) => {
      const agg = lineMap.get(acc.id);
      const totalDebit = Number(agg?._sum.debit ?? 0);
      const totalCredit = Number(agg?._sum.credit ?? 0);
      return {
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        totalDebit,
        totalCredit,
        netBalance: totalDebit - totalCredit,
      };
    })
    .filter((r) => r.totalDebit !== 0 || r.totalCredit !== 0);

  const byType = (type: string) => data.filter((l) => l.type === type);

  const totalIncome = byType("income").reduce((s, l) => s + l.totalCredit - l.totalDebit, 0);
  const totalDirectExp = data.filter((l) => l.type === "expense" && l.code.startsWith("PUR_")).reduce((s, l) => s + l.netBalance, 0);
  const totalIndirectExp = data.filter((l) => l.type === "expense" && !l.code.startsWith("PUR_")).reduce((s, l) => s + l.netBalance, 0);
  const grossProfit = totalIncome - totalDirectExp;
  const netProfit = grossProfit - totalIndirectExp;
  const totalAssets = byType("asset").reduce((s, l) => s + Math.max(l.netBalance, 0), 0);
  const totalLiab = byType("liability").reduce((s, l) => s + Math.max(-l.netBalance, 0), 0);
  const totalCapital = byType("capital").reduce((s, l) => s + Math.max(-l.netBalance, 0), 0) + netProfit;

  const periodStr = `${from ?? ""} to ${to ?? ""}`;
  const firmName = firm?.name ?? "मंडी खाता";

  const wb = new ExcelJS.Workbook();
  wb.creator = "Mandi Khata";
  wb.created = new Date();

  // ── Styles ────────────────────────────────────────────────────────────────────
  const boldFont = { bold: true, name: "Calibri", size: 11 };
  const headerFill = (argb: string): ExcelJS.Fill => ({
    type: "pattern", pattern: "solid", fgColor: { argb },
  });
  const rightAlign: Partial<ExcelJS.Alignment> = { horizontal: "right" };
  const centerAlign: Partial<ExcelJS.Alignment> = { horizontal: "center" };
  const border: Partial<ExcelJS.Borders> = {
    top: { style: "thin" }, bottom: { style: "thin" },
    left: { style: "thin" }, right: { style: "thin" },
  };

  function addTitleRows(ws: ExcelJS.Worksheet, title: string, cols: number) {
    const r1 = ws.addRow([firmName]);
    r1.font = { bold: true, size: 14, name: "Calibri" };
    ws.mergeCells(`A${r1.number}:${String.fromCharCode(64 + cols)}${r1.number}`);
    r1.alignment = centerAlign;

    const r2 = ws.addRow([title]);
    r2.font = { bold: true, size: 12, name: "Calibri", color: { argb: "FF92400E" } };
    ws.mergeCells(`A${r2.number}:${String.fromCharCode(64 + cols)}${r2.number}`);
    r2.alignment = centerAlign;

    const r3 = ws.addRow([`Period: ${periodStr}`]);
    r3.font = { italic: true, size: 10, name: "Calibri", color: { argb: "FF6B7280" } };
    ws.mergeCells(`A${r3.number}:${String.fromCharCode(64 + cols)}${r3.number}`);
    r3.alignment = centerAlign;

    ws.addRow([]);
  }

  // ── Sheet 1: Trial Balance ────────────────────────────────────────────────────
  if (activeTab === "trial") {
    const wsTB = wb.addWorksheet("Trial Balance (तलपट)");
    wsTB.columns = [
      { key: "account", width: 40 },
      { key: "type",    width: 18 },
      { key: "dr",      width: 20 },
      { key: "cr",      width: 20 },
    ];
    addTitleRows(wsTB, "Trial Balance (तलपट)", 4);

    const tbHead = wsTB.addRow(["Account Name", "Type", "Debit (Dr)", "Credit (Cr)"]);
    tbHead.font = boldFont;
    tbHead.fill = headerFill("FFFEF3C7");
    tbHead.alignment = { horizontal: "center" };
    tbHead.border = border;

    const TYPES = ["asset", "liability", "income", "expense", "capital"];
    let grandDr = 0, grandCr = 0;

    for (const type of TYPES) {
      const group = byType(type);
      if (!group.length) continue;

      const grpDr = group.reduce((s, l) => s + l.totalDebit, 0);
      const grpCr = group.reduce((s, l) => s + l.totalCredit, 0);
      grandDr += grpDr; grandCr += grpCr;

      const headRow = wsTB.addRow([TYPE_LABEL[type] ?? type, "", "", ""]);
      headRow.font = { bold: true, name: "Calibri", size: 10, color: { argb: "FF1E3A5F" } };
      headRow.fill = headerFill("FFE0F2FE");
      wsTB.mergeCells(`A${headRow.number}:B${headRow.number}`);

      for (const l of group) {
        const row = wsTB.addRow([l.name, l.type, l.totalDebit || null, l.totalCredit || null]);
        row.getCell(3).numFmt = '#,##0.00';
        row.getCell(4).numFmt = '#,##0.00';
        row.getCell(3).alignment = rightAlign;
        row.getCell(4).alignment = rightAlign;
        row.border = border;
      }

      const subRow = wsTB.addRow(["", "Sub-total", grpDr, grpCr]);
      subRow.font = { bold: true, name: "Calibri", size: 10 };
      subRow.fill = headerFill("FFF9FAFB");
      subRow.getCell(3).numFmt = '#,##0.00';
      subRow.getCell(4).numFmt = '#,##0.00';
      subRow.getCell(3).alignment = rightAlign;
      subRow.getCell(4).alignment = rightAlign;
    }

    wsTB.addRow([]);
    const totRow = wsTB.addRow(["Grand Total", "", grandDr, grandCr]);
    totRow.font = { bold: true, size: 12, name: "Calibri" };
    totRow.fill = headerFill("FFFEF3C7");
    totRow.getCell(3).numFmt = '#,##0.00';
    totRow.getCell(4).numFmt = '#,##0.00';
    totRow.getCell(3).alignment = rightAlign;
    totRow.getCell(4).alignment = rightAlign;
    totRow.border = border;
  }

  // ── Sheet 2: Profit & Loss ────────────────────────────────────────────────────
  if (activeTab === "pl") {
    const wsPL = wb.addWorksheet("Profit & Loss (लाभ-हानि)");
    wsPL.columns = [{ key: "a", width: 44 }, { key: "b", width: 22 }];
    addTitleRows(wsPL, "Profit & Loss Account (लाभ-हानि खाता)", 2);

    const addSection = (label: string, argb: string, rows: { name: string; amount: number }[], total: number, totalLabel: string, totalArgb: string) => {
      const h = wsPL.addRow([label, ""]);
      h.font = { bold: true, size: 11, name: "Calibri", color: { argb: "FF1E3A5F" } };
      h.fill = headerFill(argb);
      wsPL.mergeCells(`A${h.number}:B${h.number}`);

      for (const r of rows) {
        const row = wsPL.addRow([r.name, r.amount]);
        row.getCell(2).numFmt = '#,##0.00';
        row.getCell(2).alignment = rightAlign;
        row.border = border;
      }

      const t = wsPL.addRow([totalLabel, total]);
      t.font = boldFont;
      t.fill = headerFill(totalArgb);
      t.getCell(2).numFmt = '#,##0.00';
      t.getCell(2).alignment = rightAlign;
      t.border = border;
      wsPL.addRow([]);
    };

    addSection("Income (आय)", "FFD1FAE5",
      byType("income").map((l) => ({ name: l.name, amount: l.totalCredit - l.totalDebit })),
      totalIncome, "Total Income", "FFA7F3D0");

    addSection("Direct Expenses / Purchase (सीधे खर्चे)", "FFFDE8D8",
      data.filter((l) => l.type === "expense" && l.code.startsWith("PUR_")).map((l) => ({ name: l.name, amount: l.netBalance })),
      totalDirectExp, "Total Direct Expenses", "FFFCD5AE");

    const gpRow = wsPL.addRow(["Gross Profit (सकल लाभ)", grossProfit]);
    gpRow.font = { bold: true, size: 12, name: "Calibri", color: { argb: grossProfit >= 0 ? "FF065F46" : "FF9B1C1C" } };
    gpRow.fill = headerFill(grossProfit >= 0 ? "FFD1FAE5" : "FFFEE2E2");
    gpRow.getCell(2).numFmt = '#,##0.00';
    gpRow.getCell(2).alignment = rightAlign;
    gpRow.border = border;
    wsPL.addRow([]);

    addSection("Indirect Expenses (अप्रत्यक्ष खर्चे)", "FFF3F4F6",
      data.filter((l) => l.type === "expense" && !l.code.startsWith("PUR_")).map((l) => ({ name: l.name, amount: l.netBalance })),
      totalIndirectExp, "Total Indirect Expenses", "FFE5E7EB");

    const npRow = wsPL.addRow(["Net Profit / Loss (शुद्ध लाभ / हानि)", netProfit]);
    npRow.font = { bold: true, size: 13, name: "Calibri", color: { argb: netProfit >= 0 ? "FF065F46" : "FF9B1C1C" } };
    npRow.fill = headerFill(netProfit >= 0 ? "FFD1FAE5" : "FFFEE2E2");
    npRow.getCell(2).numFmt = '#,##0.00';
    npRow.getCell(2).alignment = rightAlign;
    npRow.border = border;
  }

  // ── Sheet 3: Balance Sheet ────────────────────────────────────────────────────
  if (activeTab === "balance") {
    const wsBS = wb.addWorksheet("Balance Sheet");
    wsBS.columns = [{ key: "a", width: 36 }, { key: "b", width: 20 }, { key: "c", width: 36 }, { key: "d", width: 20 }];
    addTitleRows(wsBS, "Balance Sheet", 4);

    const bsHead = wsBS.addRow(["Assets (संपत्ति)", "Amount (₹)", "Liabilities & Capital", "Amount (₹)"]);
    bsHead.font = boldFont;
    bsHead.fill = headerFill("FFFEF3C7");
    bsHead.alignment = centerAlign;
    bsHead.border = border;

    const assets = byType("asset");
    const liabilities = byType("liability");
    const capitals = byType("capital");
    const maxRows = Math.max(assets.length + 1, liabilities.length + capitals.length + 3);

    const bsData: Array<[string, number | null, string, number | null]> = [];

    for (let i = 0; i < maxRows; i++) {
      const asset = assets[i];
      let liabName = "", liabAmt: number | null = null;

      if (i < liabilities.length) {
        liabName = liabilities[i].name;
        liabAmt = Math.abs(liabilities[i].netBalance);
      } else if (i === liabilities.length) {
        liabName = "Capital (पूँजी)";
        liabAmt = null;
      } else if (i > liabilities.length && i <= liabilities.length + capitals.length) {
        const cap = capitals[i - liabilities.length - 1];
        liabName = cap?.name ?? "";
        liabAmt = cap ? Math.abs(cap.netBalance) : null;
      } else if (i === liabilities.length + capitals.length + 1) {
        liabName = "Net Profit (शुद्ध लाभ)";
        liabAmt = netProfit;
      }

      bsData.push([
        asset?.name ?? "", asset ? Math.max(asset.netBalance, 0) : null,
        liabName, liabAmt,
      ]);
    }

    for (const [an, av, ln, lv] of bsData) {
      const row = wsBS.addRow([an, av, ln, lv]);
      if (av !== null) { row.getCell(2).numFmt = '#,##0.00'; row.getCell(2).alignment = rightAlign; }
      if (lv !== null) { row.getCell(4).numFmt = '#,##0.00'; row.getCell(4).alignment = rightAlign; }
      row.border = border;
    }

    wsBS.addRow([]);
    const bsTot = wsBS.addRow(["Total Assets", totalAssets, "Total Liab + Capital", totalLiab + totalCapital]);
    bsTot.font = boldFont;
    bsTot.fill = headerFill("FFFEF3C7");
    bsTot.getCell(2).numFmt = '#,##0.00'; bsTot.getCell(2).alignment = rightAlign;
    bsTot.getCell(4).numFmt = '#,##0.00'; bsTot.getCell(4).alignment = rightAlign;
    bsTot.border = border;
  }

  // ── Serve file ────────────────────────────────────────────────────────────────
  const tabLabel = activeTab === "pl" ? "PL" : activeTab === "balance" ? "BS" : "TB";
  const fileName = `MandKhata_${tabLabel}_${String(from ?? "").replace(/-/g, "")}to${String(to ?? "").replace(/-/g, "")}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  await wb.xlsx.write(res);
  res.end();
}
