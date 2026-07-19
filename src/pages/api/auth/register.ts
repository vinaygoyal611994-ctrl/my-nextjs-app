import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  firmName: z.string().min(2, "Firm name is required").max(200),
  address: z.string().min(2, "Address is required").max(500),
  adminName: z.string().min(2, "Your name is required").max(200),
  mobile: z.string().min(10, "Enter valid mobile number").max(15),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const defaultAccounts = [
  { code: "CASH001", name: "Cash in Hand",              type: "asset"     as const, subType: "cash"             as const, isSystem: true  },
  { code: "BANK001", name: "Bank Account",              type: "asset"     as const, subType: "bank"             as const, isSystem: true  },
  { code: "ADV001",  name: "Advance to Kisan (Uchanti)",type: "asset"     as const, subType: "advance"          as const, isSystem: true  },
  { code: "STK001",  name: "Closing Stock",             type: "asset"     as const, subType: "stock"            as const, isSystem: true  },
  { code: "HMLI001", name: "Hammali Payable (Palledar)",type: "liability" as const, subType: "payable"          as const, isSystem: true  },
  { code: "MSHK001", name: "Mandi Shulk Payable",      type: "liability" as const, subType: "payable"          as const, isSystem: true  },
  { code: "KKFP001", name: "KK Fees Payable",          type: "liability" as const, subType: "payable"          as const, isSystem: true  },
  { code: "SGST001", name: "GST Output Payable — SGST",type: "liability" as const, subType: "payable"          as const, isSystem: true  },
  { code: "CGST001", name: "GST Output Payable — CGST",type: "liability" as const, subType: "payable"          as const, isSystem: true  },
  { code: "IGST001", name: "GST Output Payable — IGST",type: "liability" as const, subType: "payable"          as const, isSystem: true  },
  { code: "DAMI001", name: "Dami / Aadhat Income",     type: "income"    as const, subType: "income"           as const, isSystem: true  },
  { code: "BYAJ001", name: "Byaj Income",              type: "income"    as const, subType: "income"           as const, isSystem: true  },
  { code: "MUDT001", name: "Mudat Income",             type: "income"    as const, subType: "income"           as const, isSystem: true  },
  { code: "KIRA001", name: "Kiraya (Rent)",            type: "expense"   as const, subType: "indirect_expense" as const, isSystem: false },
  { code: "SLRY001", name: "Salary / Wages",           type: "expense"   as const, subType: "indirect_expense" as const, isSystem: false },
  { code: "UTIL001", name: "Bijli / Pani",             type: "expense"   as const, subType: "indirect_expense" as const, isSystem: false },
  { code: "MISC001", name: "Chai-Pani / Misc",         type: "expense"   as const, subType: "indirect_expense" as const, isSystem: false },
  { code: "TELE001", name: "Telephone",                type: "expense"   as const, subType: "indirect_expense" as const, isSystem: false },
];

const defaultSettings = [
  { key: "commission_pct",        value: "2.0"          },
  { key: "mandi_shulk_pct",      value: "1.0"          },
  { key: "kkf_pct",              value: "0.5"          },
  { key: "byaj_pct_month",       value: "1.5"          },
  { key: "hammali_per_bag",      value: "5"            },
  { key: "mudat_pct",            value: "0"            },
  { key: "kisan_side_deductions",value: "false"        },
  { key: "gst_base_mode",        value: "charges_only" },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
  }

  const { firmName, address, adminName, mobile, password } = parsed.data;

  // Mobile must be unique across all users
  const existing = await prisma.user.findUnique({ where: { mobile } });
  if (existing) {
    return res.status(409).json({ message: "This mobile number is already registered. Please login." });
  }

  try {
    // Current financial year start (April 1)
    const now = new Date();
    const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStart = new Date(`${fyYear}-04-01`);

    // Create firm
    const firm = await prisma.firm.create({
      data: { name: firmName, address, fyStart },
    });

    // Create admin user (malik)
    const hashedPw = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: { firmId: firm.id, name: adminName, mobile, password: hashedPw, role: "malik" },
    });

    // Create chart of accounts
    for (const acc of defaultAccounts) {
      await prisma.account.create({ data: { firmId: firm.id, ...acc } });
    }

    // Create default godown
    await prisma.godown.create({
      data: { firmId: firm.id, name: "Main Godown (मुख्य गोदाम)", address },
    });

    // Create default settings
    for (const s of defaultSettings) {
      await prisma.setting.create({
        data: { firmId: firm.id, key: s.key, value: s.value, effectiveFrom: new Date() },
      });
    }

    return res.status(201).json({ message: "Firm registered successfully. Please login." });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error. Please try again later." });
  }
}
