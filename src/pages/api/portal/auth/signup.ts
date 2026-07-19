import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensurePortalTables } from "@/lib/portal-tables";

const signupSchema = z.object({
  mobile: z.string().min(10).max(15),
  name: z.string().min(2).max(200),
  password: z.string().min(6).max(100),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type FirmRow = { id: number | bigint };
type AccountRow = { id: number | bigint };
type PartyRow = { id: number | bigint; type: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    await ensurePortalTables();

    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }

    const { mobile, name, password } = parsed.data;

    // Auto-detect firm (single-firm system)
    const firmRows = await prisma.$queryRaw<FirmRow[]>`
      SELECT id FROM firms WHERE active = 1 ORDER BY id ASC LIMIT 1
    `;
    if (!firmRows.length) {
      return res.status(500).json({ message: "System configuration error। कृपया बाद में try करें।" });
    }
    const firmId = Number(firmRows[0].id);

    // Check mobile not already registered
    const existingRows = await prisma.$queryRaw<AccountRow[]>`
      SELECT id FROM party_portal_accounts
      WHERE firm_id = ${firmId} AND mobile = ${mobile}
      LIMIT 1
    `;
    if (existingRows.length) {
      return res.status(409).json({ message: "यह mobile number पहले से registered है। Login करें।" });
    }

    // Try to find linked party
    const partyRows = await prisma.$queryRaw<PartyRow[]>`
      SELECT id, type FROM parties
      WHERE firm_id = ${firmId} AND mobile = ${mobile} AND active = 1
      LIMIT 1
    `;

    // Only auto-link if the matched party is a vyapari (trader)
    const partyId = (partyRows.length && partyRows[0].type === "vyapari") ? Number(partyRows[0].id) : null;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Insert account
    await prisma.$executeRaw`
      INSERT INTO party_portal_accounts (firm_id, party_id, name, mobile, password)
      VALUES (${firmId}, ${partyId ?? null}, ${name}, ${mobile}, ${hashedPassword})
    `;

    return res.status(201).json({ message: "Account बन गया। अब Login करें।" });
  } catch (err) {
    console.error("Portal signup error:", err);
    return res.status(500).json({ message: "Server error। कृपया बाद में try करें।" });
  }
}
