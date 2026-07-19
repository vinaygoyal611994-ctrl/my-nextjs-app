import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensurePortalTables } from "@/lib/portal-tables";
import { createSession, COOKIE_NAME } from "@/lib/portal-session";

const loginSchema = z.object({
  mobile: z.string().min(10).max(15),
  password: z.string().min(1),
});

type AccountRow = {
  id: number | bigint;
  firm_id: number | bigint;
  party_id: number | bigint | null;
  name: string;
  mobile: string;
  password: string;
  active: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    await ensurePortalTables();

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
    }

    const { mobile, password } = parsed.data;

    const rows = await prisma.$queryRaw<AccountRow[]>`
      SELECT id, firm_id, party_id, name, mobile, password, active
      FROM party_portal_accounts
      WHERE mobile = ${mobile} AND active = 1
      LIMIT 1
    `;

    if (!rows.length) {
      return res.status(401).json({ message: "Mobile number registered नहीं है। पहले Register करें।" });
    }

    const account = rows[0];

    const valid = await bcrypt.compare(password, account.password);
    if (!valid) {
      return res.status(401).json({ message: "Password गलत है।" });
    }

    const token = await createSession(
      Number(account.id),
      Number(account.firm_id),
      account.party_id != null ? Number(account.party_id) : null,
      account.name,
      account.mobile
    );

    const maxAge = 30 * 24 * 3600;
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Max-Age=${maxAge}; SameSite=Lax`
    );

    return res.status(200).json({ name: account.name });
  } catch (err) {
    console.error("Portal login error:", err);
    return res.status(500).json({ message: "Server error। कृपया बाद में try करें।" });
  }
}
