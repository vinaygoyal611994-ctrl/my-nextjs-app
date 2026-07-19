/**
 * Seed: Creates initial firm, admin user (malik), chart of accounts, and sample jins.
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
 * Or:  npx prisma db seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌾 Seeding Mandi Khata database...");

  // ── Firm ──────────────────────────────────────────────────────────────────
  const firm = await prisma.firm.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "श्री राम आढ़त",
      address: "खैरथल अनाज मंडी, खैरथल (अलवर) राजस्थान",
      fyStart: new Date("2024-04-01"),
    },
  });
  console.log(`✅ Firm: ${firm.name} (id=${firm.id})`);

  // ── Admin user (malik) ────────────────────────────────────────────────────
  const hashedPw = await bcrypt.hash("mandi123", 12);
  const user = await prisma.user.upsert({
    where: { mobile: "9999999999" },
    update: {},
    create: {
      firmId: firm.id,
      name: "मालिक",
      mobile: "9999999999",
      password: hashedPw,
      role: "malik",
    },
  });
  console.log(`✅ User: ${user.name} | Mobile: ${user.mobile} | Password: mandi123`);

  // ── Chart of Accounts ─────────────────────────────────────────────────────
  const accountsData = [
    // Assets
    { code: "CASH001", name: "Cash in Hand", type: "asset" as const, subType: "cash" as const, isSystem: true },
    { code: "BANK001", name: "Bank Account", type: "asset" as const, subType: "bank" as const, isSystem: true },
    { code: "ADV001", name: "Advance to Kisan (Uchanti)", type: "asset" as const, subType: "advance" as const, isSystem: true },
    { code: "STK001", name: "Closing Stock", type: "asset" as const, subType: "stock" as const, isSystem: true },
    // Liabilities
    { code: "HMLI001", name: "Hammali Payable (Palledar)", type: "liability" as const, subType: "payable" as const, isSystem: true },
    { code: "MSHK001", name: "Mandi Shulk Payable", type: "liability" as const, subType: "payable" as const, isSystem: true },
    { code: "KKFP001", name: "KK Fees Payable", type: "liability" as const, subType: "payable" as const, isSystem: true },
    { code: "SGST001", name: "GST Output Payable — SGST", type: "liability" as const, subType: "payable" as const, isSystem: true },
    { code: "CGST001", name: "GST Output Payable — CGST", type: "liability" as const, subType: "payable" as const, isSystem: true },
    { code: "IGST001", name: "GST Output Payable — IGST", type: "liability" as const, subType: "payable" as const, isSystem: true },
    // Income
    { code: "DAMI001", name: "Dami / Aadhat Income", type: "income" as const, subType: "income" as const, isSystem: true },
    { code: "BYAJ001", name: "Byaj Income", type: "income" as const, subType: "income" as const, isSystem: true },
    { code: "MUDT001", name: "Mudat Income", type: "income" as const, subType: "income" as const, isSystem: true },
    // Expenses
    { code: "KIRA001", name: "Kiraya (Rent)", type: "expense" as const, subType: "indirect_expense" as const, isSystem: false },
    { code: "SLRY001", name: "Salary / Wages", type: "expense" as const, subType: "indirect_expense" as const, isSystem: false },
    { code: "UTIL001", name: "Bijli / Pani", type: "expense" as const, subType: "indirect_expense" as const, isSystem: false },
    { code: "MISC001", name: "Chai-Pani / Misc", type: "expense" as const, subType: "indirect_expense" as const, isSystem: false },
    { code: "TELE001", name: "Telephone", type: "expense" as const, subType: "indirect_expense" as const, isSystem: false },
  ];

  for (const acc of accountsData) {
    await prisma.account.upsert({
      where: { firmId_code: { firmId: firm.id, code: acc.code } },
      update: {},
      create: { firmId: firm.id, ...acc },
    });
  }
  console.log(`✅ Chart of accounts: ${accountsData.length} accounts`);

  // ── Default Jins (Items) ──────────────────────────────────────────────────
  const jinsData = [
    { name: "Sarson", hindiName: "सरसों", defaultUnitWeightKg: 40, purCode: "PUR_SRSN", salCode: "SAL_SRSN" },
    { name: "Bajra", hindiName: "बाजरा", defaultUnitWeightKg: 12, purCode: "PUR_BAJR", salCode: "SAL_BAJR" },
    { name: "Gehu", hindiName: "गेहूँ", defaultUnitWeightKg: 50, purCode: "PUR_GEWH", salCode: "SAL_GEWH" },
    { name: "Jowar", hindiName: "जोवार", defaultUnitWeightKg: 35, purCode: "PUR_JOWR", salCode: "SAL_JOWR" },
    { name: "Moong", hindiName: "मूंग", defaultUnitWeightKg: 40, purCode: "PUR_MONG", salCode: "SAL_MONG" },
    { name: "Til", hindiName: "तिल", defaultUnitWeightKg: 40, purCode: "PUR_TIL", salCode: "SAL_TIL" },
  ];

  for (const jins of jinsData) {
    // Check if item exists
    const existing = await prisma.item.findFirst({
      where: { firmId: firm.id, name: jins.name },
    });
    if (existing) continue;

    const purAcc = await prisma.account.upsert({
      where: { firmId_code: { firmId: firm.id, code: jins.purCode } },
      update: {},
      create: {
        firmId: firm.id,
        code: jins.purCode,
        name: `Purchase — ${jins.hindiName}`,
        type: "expense",
        subType: "direct_expense",
        isSystem: false,
      },
    });
    const salAcc = await prisma.account.upsert({
      where: { firmId_code: { firmId: firm.id, code: jins.salCode } },
      update: {},
      create: {
        firmId: firm.id,
        code: jins.salCode,
        name: `Sales — ${jins.hindiName}`,
        type: "income",
        subType: "income",
        isSystem: false,
      },
    });

    await prisma.item.create({
      data: {
        firmId: firm.id,
        name: jins.name,
        hindiName: jins.hindiName,
        defaultUnitWeightKg: jins.defaultUnitWeightKg,
        purchaseAccountId: purAcc.id,
        salesAccountId: salAcc.id,
      },
    });
  }
  console.log(`✅ Jins seeded: ${jinsData.length} items`);

  // ── Default Godown ─────────────────────────────────────────────────────────
  await prisma.godown.upsert({
    where: { id: 1 },
    update: {},
    create: { firmId: firm.id, name: "मुख्य गोदाम", address: "खैरथल मंडी" },
  });
  console.log("✅ Default godown created");

  // ── Default Settings ───────────────────────────────────────────────────────
  const defaultSettings = [
    { key: "commission_pct", value: "2.0" },
    { key: "mandi_shulk_pct", value: "1.0" },
    { key: "kkf_pct", value: "0.5" },
    { key: "byaj_pct_month", value: "1.5" },
    { key: "hammali_per_bag", value: "5" },
    { key: "mudat_pct", value: "0" },
    { key: "kisan_side_deductions", value: "false" },
    { key: "gst_base_mode", value: "charges_only" },
  ];

  for (const s of defaultSettings) {
    const existing = await prisma.setting.findFirst({ where: { firmId: firm.id, key: s.key } });
    if (!existing) {
      await prisma.setting.create({
        data: { firmId: firm.id, key: s.key, value: s.value, effectiveFrom: new Date() },
      });
    }
  }
  console.log("✅ Default settings seeded");

  console.log("\n🎉 Seed complete!");
  console.log("📱 Login: mobile=9999999999  password=mandi123");
  console.log("🔗 URL: http://localhost:3000");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
