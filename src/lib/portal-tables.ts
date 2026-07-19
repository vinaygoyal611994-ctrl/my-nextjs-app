import { prisma } from "@/lib/prisma";

export async function ensurePortalTables(): Promise<void> {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS party_portal_accounts (
      id          INT          AUTO_INCREMENT PRIMARY KEY,
      firm_id     INT          NOT NULL,
      party_id    INT          NULL,
      name        VARCHAR(200) NOT NULL,
      mobile      VARCHAR(15)  NOT NULL,
      password    VARCHAR(255) NOT NULL,
      active      TINYINT      NOT NULL DEFAULT 1,
      created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_firm_mobile (firm_id, mobile)
    )
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS party_portal_sessions (
      id          INT          AUTO_INCREMENT PRIMARY KEY,
      account_id  INT          NOT NULL,
      token       VARCHAR(64)  NOT NULL UNIQUE,
      firm_id     INT          NOT NULL,
      party_id    INT          NULL,
      name        VARCHAR(200) NOT NULL,
      mobile      VARCHAR(15)  NOT NULL,
      expires_at  DATETIME     NOT NULL,
      created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_token (token)
    )
  `;
}
