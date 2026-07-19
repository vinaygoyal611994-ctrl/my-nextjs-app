import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "malik") return res.status(403).json({ error: "Only malik" });

  const firmId = session.user.firmId;

  if (req.method === "POST") {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    await prisma.setting.create({
      data: {
        firmId,
        key: parsed.data.key,
        value: parsed.data.value,
        effectiveFrom: new Date(),
      },
    });

    return res.status(200).json({ ok: true });
  }

  if (req.method === "GET") {
    const settings = await prisma.setting.findMany({
      where: { firmId },
      orderBy: { effectiveFrom: "desc" },
    });
    // Return latest per key
    const map: Record<string, string> = {};
    for (const s of settings) {
      if (!map[s.key]) map[s.key] = s.value;
    }
    return res.status(200).json(map);
  }

  return res.status(405).end();
}
