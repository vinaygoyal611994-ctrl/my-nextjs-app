import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  mobile: z.string().min(10).max(15),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Enter a valid mobile number." });

  const { mobile } = parsed.data;

  const user = await prisma.user.findUnique({ where: { mobile } });
  if (!user) {
    // Don't reveal whether mobile exists — always show success
    return res.status(200).json({ message: "ok" });
  }

  // Temp password = last 4 digits of mobile + "@DV"
  const last4 = mobile.replace(/\D/g, "").slice(-4);
  const tempPassword = `${last4}@DV`;
  const hashed = await bcrypt.hash(tempPassword, 12);

  await prisma.user.update({ where: { mobile }, data: { password: hashed } });

  return res.status(200).json({ tempPassword });
}
