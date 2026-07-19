import type { NextApiRequest, NextApiResponse } from "next";
import { deleteSession, COOKIE_NAME } from "@/lib/portal-session";

function parseCookieToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k.trim(), v.join("=")];
    })
  );
  return cookies[COOKIE_NAME] ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const token = parseCookieToken(req.headers.cookie);
    await deleteSession(token);

    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`
    );

    return res.status(200).json({ message: "Logged out" });
  } catch (err) {
    console.error("Portal logout error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
