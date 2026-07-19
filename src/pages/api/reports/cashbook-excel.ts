import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { todayISO } from "@/lib/utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).end();
  const firmId = session.user.firmId;

  const today = todayISO();
  const from = (req.query.from as string) ?? today.slice(0, 7) + "-01";
  const to = (req.query.to as string) ?? today;

  const dayEnd = new Date(to); dayEnd.setHours(23, 59, 59, 999);
  const dayStart = new Date(from);

  const [firm, cashAcc] = await Promise.all([
    prisma.firm.findUnique({ where: { id: firmId }, select: { name: true } }),
    prisma.account.findFirst({ where: { firmId, code: "CASH001" } }),
  ]);

  if (!cashAcc) return res.status(400).json({ error: "Cash account not found" });

  const openingAgg = await prisma.journalLine.aggregate({
    where: {
      accountId: cashAcc.id,
      journalEntry: { firmId, cancelled: false, date: { lt: dayStart } },
    },
    _sum: { debit: true, credit: true },
  });
  const openingBalance = Number(openingAgg._sum.debit ?? 0) - Number(openingAgg._sum.credit ?? 0);

  const lines = await prisma.journalLine.findMany({
    where: {
      accountId: cashAcc.id,
      journalEntry: { firmId, cancelled: false, date: { gte: dayStart, lte: dayEnd } },
    },
    include: { journalEntry: { select: { voucherNo: true, date: true, narration: true } } },
    orderBy: { journalEntry: { date: "asc" } },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Mandi Khata";
  const ws = wb.addWorksheet("नकद बही");

  // Title
  ws.mergeCells("A1:F1");
  ws.getCell("A1").value = `${firm?.name} — नकद बही (${from} से ${to})`;
  ws.getCell("A1").font = { bold: true, size: 13 };
  ws.getCell("A1").alignment = { horizontal: "center" };

  // Headers
  ws.addRow([]);
  const headerRow = ws.addRow(["तारीख", "वाउचर नं.", "विवरण", "आया (Dr)", "गया (Cr)", "बाकी"]);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
    cell.border = { bottom: { style: "thin" } };
  });

  // Opening balance row
  const obRow = ws.addRow(["शुरुआती बाकी", "", "", "", "", openingBalance]);
  obRow.font = { italic: true, color: { argb: "FF1D4ED8" } };

  // Data rows
  let running = openingBalance;
  for (const l of lines) {
    const dr = Number(l.debit);
    const cr = Number(l.credit);
    running = running + dr - cr;
    ws.addRow([
      l.journalEntry.date.toLocaleDateString("en-IN"),
      l.journalEntry.voucherNo,
      l.journalEntry.narration ?? "",
      dr > 0 ? dr : "",
      cr > 0 ? cr : "",
      running,
    ]);
  }

  // Totals
  const totalDr = lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCr = lines.reduce((s, l) => s + Number(l.credit), 0);
  const totalRow = ws.addRow(["कुल", "", "", totalDr, totalCr, running]);
  totalRow.font = { bold: true };
  totalRow.eachCell((cell) => { cell.border = { top: { style: "double" } }; });

  // Column widths
  ws.columns = [
    { width: 14 }, { width: 16 }, { width: 35 },
    { width: 14 }, { width: 14 }, { width: 14 },
  ];

  // Number format
  [4, 5, 6].forEach((col) => {
    ws.getColumn(col).numFmt = "#,##0.00";
    ws.getColumn(col).alignment = { horizontal: "right" };
  });

  const buf = await wb.xlsx.writeBuffer();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=cashbook_${from}_${to}.xlsx`);
  res.send(Buffer.from(buf));
}
