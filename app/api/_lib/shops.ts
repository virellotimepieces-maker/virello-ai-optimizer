import { dbQuery } from "./database";
import { normalizeShop } from "./shop-domain";

export type AppSessionRecord = {
  id: string;
  shop: string;
  stripe_customer_id: string | null;
  expires_at: string;
  revoked_at: string | null;
};

export async function upsertShop(
  shop: string,
  fields: { scopes?: string; name?: string; markInstalled?: boolean } = {}
): Promise<string> {
  const normalized = normalizeShop(shop);
  if (!normalized) {
    throw new Error("Invalid Shopify store.");
  }

  const markInstalled = fields.markInstalled !== false;

  if (markInstalled) {
    await dbQuery(
      `INSERT INTO shops (shop, name, scopes, installed_at, uninstalled_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NULL, NOW())
       ON CONFLICT (shop) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, shops.name),
         scopes = CASE WHEN EXCLUDED.scopes = '' THEN shops.scopes ELSE EXCLUDED.scopes END,
         installed_at = COALESCE(shops.installed_at, NOW()),
         uninstalled_at = NULL,
         updated_at = NOW()`,
      [normalized, fields.name ?? null, fields.scopes ?? ""]
    );
  } else {
    await dbQuery(
      `INSERT INTO shops (shop, name, scopes, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (shop) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, shops.name),
         updated_at = NOW()`,
      [normalized, fields.name ?? null, fields.scopes ?? ""]
    );
  }

  return normalized;
}

export async function isShopifyInstallationActive(shop: string): Promise<boolean> {
  const normalized = normalizeShop(shop);
  if (!normalized) return false;
  const rows = await dbQuery<{ ok: number }>(
    `SELECT 1 AS ok
     FROM shops
     JOIN shopify_sessions ON shopify_sessions.shop = shops.shop
     WHERE shops.shop = $1
       AND shops.uninstalled_at IS NULL
       AND shopify_sessions.revoked_at IS NULL
       AND shopify_sessions.encrypted_access_token <> ''
     LIMIT 1`,
    [normalized]
  );
  return rows.length > 0;
}

export async function revokeShopifyInstallation(shop: string): Promise<void> {
  const normalized = normalizeShop(shop);
  if (!normalized) return;

  await dbQuery(
    `INSERT INTO shops (shop, uninstalled_at, updated_at)
     VALUES ($1, NOW(), NOW())
     ON CONFLICT (shop) DO UPDATE SET
       uninstalled_at = NOW(),
       updated_at = NOW()`,
    [normalized]
  );

  await dbQuery(
    `UPDATE shopify_sessions
     SET revoked_at = NOW(),
         encrypted_access_token = '',
         updated_at = NOW()
     WHERE shop = $1`,
    [normalized]
  );

  await revokeAppSessionsForShop(normalized);
}

export async function createAppSession(input: {
  id: string;
  shop: string;
  stripeCustomerId?: string | null;
  expiresAt: Date;
  userAgentHash?: string | null;
}): Promise<void> {
  const shop = await upsertShop(input.shop, { markInstalled: false });
  await dbQuery(
    `INSERT INTO app_sessions (
       id, shop, stripe_customer_id, expires_at, user_agent_hash, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
    [
      input.id,
      shop,
      input.stripeCustomerId ?? null,
      input.expiresAt.toISOString(),
      input.userAgentHash ?? null,
    ]
  );
}

export async function getAppSessionById(
  id: string
): Promise<AppSessionRecord | null> {
  if (!id) return null;
  const rows = await dbQuery<AppSessionRecord>(
    `SELECT id, shop, stripe_customer_id, expires_at, revoked_at
     FROM app_sessions
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getActiveAppSession(id: string, shop?: string) {
  const rows = await dbQuery<{
    id: string;
    shop: string;
    stripe_customer_id: string | null;
    expires_at: string;
  }>(
    `SELECT id, shop, stripe_customer_id, expires_at
     FROM app_sessions
     WHERE id = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()
       AND ($2::text IS NULL OR shop = $2)
     LIMIT 1`,
    [id, shop ? normalizeShop(shop) || null : null]
  );
  return rows[0] ?? null;
}

export async function revokeAppSession(id: string): Promise<void> {
  if (!id) return;
  await dbQuery(
    `UPDATE app_sessions
     SET revoked_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
       AND revoked_at IS NULL`,
    [id]
  );
}

export async function revokeAppSessionsForShop(shop: string): Promise<void> {
  const normalized = normalizeShop(shop);
  if (!normalized) return;
  await dbQuery(
    `UPDATE app_sessions
     SET revoked_at = NOW(),
         updated_at = NOW()
     WHERE shop = $1
       AND revoked_at IS NULL`,
    [normalized]
  );
}

export async function cleanupAppSessions(): Promise<number> {
  const rows = await dbQuery<{ id: string }>(
    `DELETE FROM app_sessions
     WHERE expires_at < NOW()
        OR (
          revoked_at IS NOT NULL
          AND revoked_at < NOW() - INTERVAL '7 days'
        )
     RETURNING id`
  );
  return rows.length;
}

export async function saveShopLocales(
  shop: string,
  uiLocale: string,
  outputLocale: string
): Promise<void> {
  const normalized = await upsertShop(shop, { markInstalled: false });
  await dbQuery(
    `UPDATE shops
     SET ui_locale = $2,
         output_locale = $3,
         updated_at = NOW()
     WHERE shop = $1`,
    [normalized, uiLocale, outputLocale]
  );
}

export async function getShopLocales(
  shop: string
): Promise<{ uiLocale: string | null; outputLocale: string | null } | null> {
  const normalized = normalizeShop(shop);
  if (!normalized) return null;
  const rows = await dbQuery<{ ui_locale: string | null; output_locale: string | null }>(
    `SELECT ui_locale, output_locale FROM shops WHERE shop = $1 LIMIT 1`,
    [normalized]
  );
  if (!rows.length) return null;
  return { uiLocale: rows[0].ui_locale, outputLocale: rows[0].output_locale };
}
