import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const COOKIE_NAME = "dv_portal_token";

export interface PortalSession {
  accountId: number;
  firmId: number;
  partyId: number | null;
  name: string;
  mobile: string;
}

type SessionRow = {
  account_id: number | bigint;
  firm_id: number | bigint;
  party_id: number | bigint | null;
  name: string;
  mobile: string;
};

export async function createSession(
  accountId: number,
  firmId: number,
  partyId: number | null,
  name: string,
  mobile: string
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.$executeRaw`
    INSERT INTO party_portal_sessions
      (account_id, token, firm_id, party_id, name, mobile, expires_at)
    VALUES
      (${accountId}, ${token}, ${firmId}, ${partyId ?? null}, ${name}, ${mobile}, ${expiresAt})
  `;

  return token;
}

export async function getSession(token: string | undefined | null): Promise<PortalSession | null> {
  if (!token) return null;

  const rows = await prisma.$queryRaw<SessionRow[]>`
    SELECT account_id, firm_id, party_id, name, mobile
    FROM party_portal_sessions
    WHERE token = ${token} AND expires_at > NOW()
    LIMIT 1
  `;

  if (!rows.length) return null;

  const row = rows[0];
  return {
    accountId: Number(row.account_id),
    firmId: Number(row.firm_id),
    partyId: row.party_id != null ? Number(row.party_id) : null,
    name: row.name,
    mobile: row.mobile,
  };
}

export async function deleteSession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await prisma.$executeRaw`
    DELETE FROM party_portal_sessions WHERE token = ${token}
  `;
}
