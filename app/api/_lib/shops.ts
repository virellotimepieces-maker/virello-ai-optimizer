import { dbQuery } from "./database";
import { normalizeShop } from "./shop-domain";

export async function upsertShop(
  shop: string,
  fields: { scopes?: string; name?: string } = {}
): Promise<string> {
  const normalized = normalizeShop(shop);
  if (!normalized) {
    throw new Error("Invalid Shopify store.");
  }

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

  return normalized;
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

  await dbQuery(
    `UPDATE app_sessions
     SET revoked_at = NOW(),
         updated_at = NOW()
     WHERE shop = $1
       AND revoked_at IS NULL`,
    [normalized]
  );
}

export async function createAppSession(input: {
  id: string;
  shop: string;
  stripeCustomerId?: string | null;
  expiresAt: Date;
  userAgentHash?: string | null;
}): Promise<void> {
  const shop = await upsertShop(input.shop);
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

export async function getActiveAppSession(id: string, shop: string) {
  const normalized = normalizeShop(shop);
  const rows = await dbQuery<{
    id: string;
    shop: string;
    stripe_customer_id: string | null;
    expires_at: string;
  }>(
    `SELECT id, shop, stripe_customer_id, expires_at
     FROM app_sessions
     WHERE id = $1
       AND shop = $2
       AND revoked_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [id, normalized]
  );
  return rows[0] ?? null;
}
