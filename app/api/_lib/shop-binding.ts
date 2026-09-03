import { NextRequest } from "next/server";
import { isSessionIdShape, readSessionId } from "./app-session";
import { dbQuery } from "./database";
import { normalizeShop } from "./shop-domain";
import { isShopifyInstallationActive, upsertShop } from "./shops";

export const OAUTH_PENDING_TTL_MS = 10 * 60 * 1000;

export class ShopBindingError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "ShopBindingError";
    this.status = status;
  }
}

export type SessionBinding = {
  sessionId: string;
  sessionShop: string;
  stripeCustomerId: string | null;
  pendingShop: string | null;
  installedShop: string | null;
  canReplaceShop: boolean;
};

function pendingShopIfFresh(
  pendingShop: string | null | undefined,
  expiresAt: string | Date | null | undefined
): string | null {
  if (!expiresAt) return null;
  const expires = new Date(expiresAt).getTime();
  if (!Number.isFinite(expires) || expires <= Date.now()) return null;
  return normalizeShop(pendingShop || "") || null;
}

export async function getSessionBinding(
  request: NextRequest
): Promise<SessionBinding | null> {
  const sessionId = readSessionId(request);
  if (!sessionId) return null;

  const rows = await dbQuery<{
    id: string;
    shop: string;
    stripe_customer_id: string | null;
    pending_shop: string | null;
    pending_shop_expires_at: string | Date | null;
  }>(
    `SELECT id, shop, stripe_customer_id, pending_shop, pending_shop_expires_at
     FROM app_sessions
     WHERE id = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [sessionId]
  );
  const row = rows[0];
  if (!row) return null;

  const sessionShop = normalizeShop(row.shop);
  if (!sessionShop) return null;

  const installed = await isShopifyInstallationActive(sessionShop);
  return {
    sessionId: row.id,
    sessionShop,
    stripeCustomerId: row.stripe_customer_id,
    pendingShop: pendingShopIfFresh(row.pending_shop, row.pending_shop_expires_at),
    installedShop: installed ? sessionShop : null,
    canReplaceShop: !installed,
  };
}

export async function setPendingShop(sessionId: string, shop: string): Promise<void> {
  if (!isSessionIdShape(sessionId)) return;
  const normalized = normalizeShop(shop);
  if (!normalized) return;

  await dbQuery(
    `UPDATE app_sessions
     SET pending_shop = $2,
         pending_shop_expires_at = NOW() + INTERVAL '10 minutes',
         updated_at = NOW()
     WHERE id = $1
       AND revoked_at IS NULL`,
    [sessionId, normalized]
  );
}

export async function clearPendingShop(sessionId: string): Promise<void> {
  if (!isSessionIdShape(sessionId)) return;
  await dbQuery(
    `UPDATE app_sessions
     SET pending_shop = NULL,
         pending_shop_expires_at = NULL,
         updated_at = NOW()
     WHERE id = $1
       AND revoked_at IS NULL`,
    [sessionId]
  );
}

export async function recoverUninstalledSessionBindings(): Promise<number> {
  const rows = await dbQuery<{ id: string }>(
    `UPDATE app_sessions AS sessions
     SET pending_shop = sessions.shop,
         pending_shop_expires_at = NOW() + INTERVAL '7 days',
         updated_at = NOW()
     WHERE sessions.revoked_at IS NULL
       AND sessions.expires_at > NOW()
       AND (
         sessions.pending_shop IS NULL
         OR sessions.pending_shop_expires_at IS NULL
         OR sessions.pending_shop_expires_at <= NOW()
       )
       AND NOT EXISTS (
         SELECT 1
         FROM shops
         JOIN shopify_sessions ON shopify_sessions.shop = shops.shop
         WHERE shops.shop = sessions.shop
           AND shops.uninstalled_at IS NULL
           AND shopify_sessions.revoked_at IS NULL
           AND shopify_sessions.encrypted_access_token <> ''
       )
     RETURNING id`
  );
  return rows.length;
}

async function attachSessionsToShop(from: string, to: string): Promise<void> {
  await upsertShop(to, { markInstalled: false });
  await dbQuery(
    `UPDATE app_sessions
     SET shop = $1,
         pending_shop = NULL,
         pending_shop_expires_at = NULL,
         updated_at = NOW()
     WHERE shop = $2
       AND revoked_at IS NULL`,
    [to, from]
  );
}

export async function rehomeUninstalledBilling(
  fromShop: string,
  toShop: string,
  subscriberCustomerId?: string | null
): Promise<void> {
  const from = normalizeShop(fromShop);
  const to = normalizeShop(toShop);
  if (!from || !to) {
    throw new ShopBindingError("Invalid Shopify store.", 400);
  }
  if (from === to) return;

  if (await isShopifyInstallationActive(from)) {
    throw new ShopBindingError(
      "Cannot rehome billing while a Shopify installation is active.",
      403
    );
  }
  if (await isShopifyInstallationActive(to)) {
    throw new ShopBindingError(
      "Target shop already has an active Shopify installation.",
      403
    );
  }

  const toCustomers = await dbQuery<{ stripe_customer_id: string }>(
    `SELECT stripe_customer_id FROM stripe_customers WHERE shop = $1`,
    [to]
  );
  const fromCustomers = await dbQuery<{ stripe_customer_id: string }>(
    `SELECT stripe_customer_id FROM stripe_customers WHERE shop = $1`,
    [from]
  );
  const fromSubs = await dbQuery<{
    stripe_subscription_id: string;
    stripe_customer_id: string;
  }>(
    `SELECT stripe_subscription_id, stripe_customer_id FROM shop_subscriptions WHERE shop = $1`,
    [from]
  );
  const toSubs = await dbQuery<{
    stripe_subscription_id: string;
    stripe_customer_id: string;
  }>(
    `SELECT stripe_subscription_id, stripe_customer_id FROM shop_subscriptions WHERE shop = $1`,
    [to]
  );

  const fromCustomerId = fromCustomers[0]?.stripe_customer_id || fromSubs[0]?.stripe_customer_id || "";
  const toCustomerId = toCustomers[0]?.stripe_customer_id || toSubs[0]?.stripe_customer_id || "";
  const sessionCustomer = (subscriberCustomerId || "").trim();
  const sameCustomer = Boolean(fromCustomerId && toCustomerId && fromCustomerId === toCustomerId);
  const sessionOwnsTarget = Boolean(sessionCustomer && toCustomerId && sessionCustomer === toCustomerId);
  const sameSubscription =
    Boolean(fromSubs[0]?.stripe_subscription_id) &&
    fromSubs[0]?.stripe_subscription_id === toSubs[0]?.stripe_subscription_id;
  const targetAlreadyBilled = toCustomers.length > 0 || toSubs.length > 0;
  const sourceHasNoBilling = fromCustomers.length === 0 && fromSubs.length === 0;
  const keepTargetBilling =
    targetAlreadyBilled &&
    (sourceHasNoBilling || sameCustomer || sameSubscription || sessionOwnsTarget);

  if (keepTargetBilling) {
    if (sameSubscription && fromSubs.length > 0) {
      await dbQuery(`DELETE FROM shop_subscriptions WHERE shop = $1`, [to]);
    } else {
      await attachSessionsToShop(from, to);
      return;
    }
  } else if (toCustomerId && fromCustomerId && toCustomerId !== fromCustomerId) {
    throw new ShopBindingError(
      "Target shop already has a different Stripe customer.",
      403
    );
  } else if (toSubs.length > 0 && fromSubs.length > 0 && !sameSubscription) {
    throw new ShopBindingError(
      "Target shop already has a Stripe subscription.",
      403
    );
  }

  await upsertShop(to, { markInstalled: false });

  if (fromSubs.length > 0) {
    await dbQuery(`DELETE FROM subscriber_usage WHERE shop = $1`, [to]);
  }

  await dbQuery(
    `UPDATE stripe_customers SET shop = $1, updated_at = NOW() WHERE shop = $2`,
    [to, from]
  );
  await dbQuery(
    `UPDATE shop_subscriptions SET shop = $1, updated_at = NOW() WHERE shop = $2`,
    [to, from]
  );
  await dbQuery(`UPDATE subscriber_usage SET shop = $1 WHERE shop = $2`, [to, from]);
  await dbQuery(
    `UPDATE stripe_invoices SET shop = $1, updated_at = NOW() WHERE shop = $2`,
    [to, from]
  );
  await dbQuery(
    `UPDATE app_sessions
     SET shop = $1,
         pending_shop = NULL,
         pending_shop_expires_at = NULL,
         updated_at = NOW()
     WHERE shop = $2
       AND revoked_at IS NULL`,
    [to, from]
  );
}
