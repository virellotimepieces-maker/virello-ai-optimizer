import { getAppUrl } from "./app-url";
import { dbQuery } from "./database";
import { shopifyAdminGraphql } from "./shopify-admin";
import { storedAccessToken } from "./shopify-auth";
import { normalizeShop } from "./shop-domain";
import { shopifyAdminAppUrl } from "./shopify-oauth";
import { upsertShop } from "./shops";
import {
  isPaidSubscriptionStatus,
  normalizeShopifySubscriptionStatus,
  productAccessDecision,
  type ProductAccessDecision,
  type ShopifySubscriptionStatus,
} from "./billing-access";

export const VIRELLO_PLAN_NAME = "Virello AI Optimizer";
export const VIRELLO_PRICE_AMOUNT = "29.99";
export const VIRELLO_PRICE_CENTS = 2999;
export const VIRELLO_PRICE_CURRENCY = "USD";
export const VIRELLO_BILLING_INTERVAL = "EVERY_30_DAYS";
const PERIOD_SECONDS = 30 * 24 * 60 * 60;

export type ShopifyBillingSnapshot = {
  shop: string;
  subscriptionId: string;
  status: ShopifySubscriptionStatus;
  test: boolean;
  name: string;
  amountCents: number;
  currency: string;
  interval: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  confirmationUrl: string;
};

export class ShopifyBillingError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "ShopifyBillingError";
    this.status = status;
  }
}

export function shopifyBillingIsTest(partnerDevelopment = false): boolean {
  if (partnerDevelopment) return true;
  const flag = (process.env.SHOPIFY_BILLING_TEST || "").trim().toLowerCase();
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  return true;
}

function unixFromShopifyDate(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value > 1_000_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
  }
  return 0;
}

function periodStartFromEnd(end: number): number {
  if (!end) return 0;
  return Math.max(0, end - PERIOD_SECONDS);
}

export async function saveShopifyAppSubscription(input: {
  shop: string;
  subscriptionGid: string;
  status: string;
  test?: boolean;
  name?: string;
  amountCents?: number;
  currency?: string;
  interval?: string;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  confirmationUrl?: string;
}): Promise<ShopifyBillingSnapshot> {
  const shop = await upsertShop(input.shop, { markInstalled: false });
  const status = normalizeShopifySubscriptionStatus(input.status) || "PENDING";
  const now = Math.floor(Date.now() / 1000);
  let currentPeriodEnd = input.currentPeriodEnd || 0;
  let currentPeriodStart =
    input.currentPeriodStart || periodStartFromEnd(currentPeriodEnd);
  if (status === "ACTIVE") {
    if (!currentPeriodEnd) currentPeriodEnd = now + PERIOD_SECONDS;
    if (!currentPeriodStart) currentPeriodStart = periodStartFromEnd(currentPeriodEnd) || now;
  }
  await dbQuery(
    `INSERT INTO shopify_app_subscriptions (
       shop, shopify_subscription_gid, status, test, name, amount_cents,
       currency, billing_interval, current_period_start, current_period_end,
       confirmation_url, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
     ON CONFLICT (shop) DO UPDATE SET
       shopify_subscription_gid = EXCLUDED.shopify_subscription_gid,
       status = EXCLUDED.status,
       test = EXCLUDED.test,
       name = EXCLUDED.name,
       amount_cents = EXCLUDED.amount_cents,
       currency = EXCLUDED.currency,
       billing_interval = EXCLUDED.billing_interval,
       current_period_start = CASE
         WHEN EXCLUDED.current_period_start > 0 THEN EXCLUDED.current_period_start
         ELSE shopify_app_subscriptions.current_period_start
       END,
       current_period_end = CASE
         WHEN EXCLUDED.current_period_end > 0 THEN EXCLUDED.current_period_end
         ELSE shopify_app_subscriptions.current_period_end
       END,
       confirmation_url = CASE
         WHEN EXCLUDED.confirmation_url = '' THEN shopify_app_subscriptions.confirmation_url
         ELSE EXCLUDED.confirmation_url
       END,
       updated_at = NOW()`,
    [
      shop,
      input.subscriptionGid,
      status,
      input.test !== false,
      input.name || VIRELLO_PLAN_NAME,
      input.amountCents ?? VIRELLO_PRICE_CENTS,
      input.currency || VIRELLO_PRICE_CURRENCY,
      input.interval || VIRELLO_BILLING_INTERVAL,
      currentPeriodStart,
      currentPeriodEnd,
      input.confirmationUrl || "",
    ]
  );
  const saved = await billingForShop(shop);
  if (!saved) {
    throw new ShopifyBillingError("Unable to persist Shopify billing.", 500);
  }
  return saved;
}

export async function billingForShop(
  shop: string
): Promise<ShopifyBillingSnapshot | null> {
  const normalized = normalizeShop(shop);
  if (!normalized) return null;
  const rows = await dbQuery<{
    shop: string;
    shopify_subscription_gid: string;
    status: string;
    test: boolean;
    name: string;
    amount_cents: number | string;
    currency: string;
    billing_interval: string;
    current_period_start: number | string;
    current_period_end: number | string;
    confirmation_url: string | null;
  }>(
    `SELECT shop, shopify_subscription_gid, status, test, name, amount_cents,
            currency, billing_interval, current_period_start, current_period_end,
            confirmation_url
     FROM shopify_app_subscriptions
     WHERE shop = $1
     LIMIT 1`,
    [normalized]
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    shop: String(row.shop),
    subscriptionId: String(row.shopify_subscription_gid),
    status: normalizeShopifySubscriptionStatus(row.status) || String(row.status),
    test: Boolean(row.test),
    name: String(row.name || VIRELLO_PLAN_NAME),
    amountCents: Number(row.amount_cents || VIRELLO_PRICE_CENTS),
    currency: String(row.currency || VIRELLO_PRICE_CURRENCY),
    interval: String(row.billing_interval || VIRELLO_BILLING_INTERVAL),
    currentPeriodStart: Number(row.current_period_start || 0),
    currentPeriodEnd: Number(row.current_period_end || 0),
    confirmationUrl: String(row.confirmation_url || ""),
  };
}

export async function accessStateForShop(
  shop: string,
  shopInstalled: boolean
): Promise<{
  billing: ShopifyBillingSnapshot | null;
  access: ProductAccessDecision;
}> {
  const billing = await billingForShop(shop);
  return {
    billing,
    access: productAccessDecision({
      shopInstalled,
      status: billing?.status ?? null,
    }),
  };
}

type AppSubscriptionNode = {
  id?: string;
  name?: string;
  status?: string;
  test?: boolean;
  currentPeriodEnd?: string | null;
};

type BillingContextData = {
  shop?: { plan?: { partnerDevelopment?: boolean | null } | null } | null;
  currentAppInstallation?: {
    activeSubscriptions?: AppSubscriptionNode[] | null;
  } | null;
};

const BILLING_CONTEXT_QUERY = `#graphql
  query VirelloBillingContext {
    shop {
      plan {
        partnerDevelopment
      }
    }
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        test
        currentPeriodEnd
      }
    }
  }
`;

const CREATE_SUBSCRIPTION_MUTATION = `#graphql
  mutation VirelloAppSubscriptionCreate(
    $name: String!
    $returnUrl: URL!
    $test: Boolean!
    $lineItems: [AppSubscriptionLineItemInput!]!
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      test: $test
      lineItems: $lineItems
      replacementBehavior: APPLY_IMMEDIATELY
    ) {
      confirmationUrl
      appSubscription {
        id
        name
        status
        test
        currentPeriodEnd
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const NODE_SUBSCRIPTION_QUERY = `#graphql
  query VirelloAppSubscriptionNode($id: ID!) {
    node(id: $id) {
      ... on AppSubscription {
        id
        name
        status
        test
        currentPeriodEnd
      }
    }
  }
`;

function snapshotFromNode(
  shop: string,
  node: AppSubscriptionNode,
  extras: { confirmationUrl?: string; testFallback?: boolean } = {}
): Parameters<typeof saveShopifyAppSubscription>[0] {
  const end = unixFromShopifyDate(node.currentPeriodEnd);
  return {
    shop,
    subscriptionGid: String(node.id || ""),
    status: node.status || "PENDING",
    test: typeof node.test === "boolean" ? node.test : extras.testFallback !== false,
    name: node.name || VIRELLO_PLAN_NAME,
    currentPeriodEnd: end,
    currentPeriodStart: periodStartFromEnd(end),
    confirmationUrl: extras.confirmationUrl || "",
  };
}

export async function syncShopifyBillingFromAdmin(
  shop: string,
  accessToken: string
): Promise<ShopifyBillingSnapshot | null> {
  const data = await shopifyAdminGraphql<BillingContextData>(
    shop,
    accessToken,
    BILLING_CONTEXT_QUERY
  );
  const active = data.currentAppInstallation?.activeSubscriptions || [];
  const preferred =
    active.find((item) => normalizeShopifySubscriptionStatus(item.status) === "ACTIVE") ||
    active[0];
  if (!preferred?.id) {
    const stored = await billingForShop(shop);
    if (stored?.subscriptionId) {
      try {
        const nodeData = await shopifyAdminGraphql<{ node?: AppSubscriptionNode | null }>(
          shop,
          accessToken,
          NODE_SUBSCRIPTION_QUERY,
          { id: stored.subscriptionId }
        );
        if (nodeData.node?.id) {
          return saveShopifyAppSubscription(
            snapshotFromNode(shop, nodeData.node, {
              confirmationUrl: stored.confirmationUrl,
              testFallback: stored.test,
            })
          );
        }
      } catch {
        return stored;
      }
    }
    return stored;
  }
  const stored = await billingForShop(shop);
  return saveShopifyAppSubscription(
    snapshotFromNode(shop, preferred, {
      confirmationUrl: stored?.confirmationUrl || "",
      testFallback: stored?.test,
    })
  );
}

export async function createShopifyAppSubscription(input: {
  shop: string;
  accessToken: string;
  returnUrl?: string;
}): Promise<{ confirmationUrl: string; billing: ShopifyBillingSnapshot; test: boolean }> {
  const shop = normalizeShop(input.shop);
  if (!shop) {
    throw new ShopifyBillingError("Invalid Shopify store.", 400);
  }

  const existing = await syncShopifyBillingFromAdmin(shop, input.accessToken).catch(
    () => billingForShop(shop)
  );
  if (existing && isPaidSubscriptionStatus(existing.status)) {
    throw new ShopifyBillingError(
      "This store already has an active $29.99/month Shopify subscription.",
      409
    );
  }
  if (existing && normalizeShopifySubscriptionStatus(existing.status) === "PENDING") {
    if (existing.confirmationUrl) {
      return {
        confirmationUrl: existing.confirmationUrl,
        billing: existing,
        test: existing.test,
      };
    }
  }

  const context = await shopifyAdminGraphql<BillingContextData>(
    shop,
    input.accessToken,
    BILLING_CONTEXT_QUERY
  );
  const test = shopifyBillingIsTest(
    Boolean(context.shop?.plan?.partnerDevelopment)
  );
  const returnUrl =
    input.returnUrl ||
    `${getAppUrl()}/api/billing/return?shop=${encodeURIComponent(shop)}`;

  const created = await shopifyAdminGraphql<{
    appSubscriptionCreate?: {
      confirmationUrl?: string | null;
      appSubscription?: AppSubscriptionNode | null;
      userErrors?: Array<{ field?: string[] | null; message?: string | null }>;
    };
  }>(shop, input.accessToken, CREATE_SUBSCRIPTION_MUTATION, {
    name: VIRELLO_PLAN_NAME,
    returnUrl,
    test,
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: {
              amount: VIRELLO_PRICE_AMOUNT,
              currencyCode: VIRELLO_PRICE_CURRENCY,
            },
            interval: VIRELLO_BILLING_INTERVAL,
          },
        },
      },
    ],
  });

  const payload = created.appSubscriptionCreate;
  const userError = payload?.userErrors?.find((error) => error.message)?.message;
  if (userError) {
    throw new ShopifyBillingError(userError, 400);
  }
  const confirmationUrl = payload?.confirmationUrl || "";
  const node = payload?.appSubscription;
  if (!confirmationUrl || !node?.id) {
    throw new ShopifyBillingError(
      "Shopify did not return a billing confirmation URL.",
      502
    );
  }

  const billing = await saveShopifyAppSubscription(
    snapshotFromNode(shop, node, { confirmationUrl, testFallback: test })
  );
  return { confirmationUrl, billing, test };
}

export function usagePeriodStart(
  billing: Pick<ShopifyBillingSnapshot, "currentPeriodStart" | "currentPeriodEnd">,
  now = Math.floor(Date.now() / 1000)
): number {
  const start = Number(billing.currentPeriodStart) || 0;
  const end = Number(billing.currentPeriodEnd) || 0;
  if (start > 0 && (end <= 0 || now < end)) return start;
  if (start > 0) {
    const elapsed = Math.max(0, now - start);
    return start + Math.floor(elapsed / PERIOD_SECONDS) * PERIOD_SECONDS;
  }
  if (end > 0) {
    let periodEnd = end;
    while (periodEnd <= now) periodEnd += PERIOD_SECONDS;
    return Math.max(0, periodEnd - PERIOD_SECONDS);
  }
  return now;
}

export function billingPeriodIsStale(
  billing: Pick<ShopifyBillingSnapshot, "currentPeriodStart" | "currentPeriodEnd">,
  now = Math.floor(Date.now() / 1000)
): boolean {
  if (!billing.currentPeriodStart) return true;
  return billing.currentPeriodEnd > 0 && billing.currentPeriodEnd <= now;
}

export function shopifyBillingManageUrl(
  shop: string,
  billing: ShopifyBillingSnapshot | null
): string {
  const normalized = normalizeShop(shop);
  if (
    billing &&
    normalizeShopifySubscriptionStatus(billing.status) === "PENDING" &&
    billing.confirmationUrl
  ) {
    return billing.confirmationUrl;
  }
  if (!normalized) {
    return "https://admin.shopify.com/";
  }
  const store = normalized.replace(/\.myshopify\.com$/i, "");
  return `https://admin.shopify.com/store/${store}/settings/billing`;
}

export function billingReturnAppUrl(
  shop: string,
  flow: "embedded" | "standalone",
  checkout: "success" | "cancelled" = "success"
): string {
  if (flow === "embedded") {
    const url = shopifyAdminAppUrl(shop, { checkout });
    return url.toString();
  }
  const url = new URL("/", getAppUrl());
  url.searchParams.set("checkout", checkout);
  url.searchParams.set("shop", shop);
  return url.toString();
}

export async function applyAppSubscriptionWebhook(
  shop: string,
  payload: unknown
): Promise<ShopifyBillingSnapshot | null> {
  const body = payload as {
    app_subscription?: {
      admin_graphql_api_id?: string;
      name?: string;
      status?: string;
      currency?: string;
    };
    admin_graphql_api_id?: string;
    name?: string;
    status?: string;
  };
  const subscription = body.app_subscription || body;
  const gid = String(subscription.admin_graphql_api_id || "").trim();
  const status = normalizeShopifySubscriptionStatus(subscription.status);
  if (!gid || !status) return null;
  const stored = await billingForShop(shop);
  const saved = await saveShopifyAppSubscription({
    shop,
    subscriptionGid: gid,
    status,
    name: subscription.name || stored?.name,
    currency: String(
      (body.app_subscription && "currency" in body.app_subscription
        ? body.app_subscription.currency
        : stored?.currency) || VIRELLO_PRICE_CURRENCY
    ),
    test: stored?.test,
    currentPeriodStart: stored?.currentPeriodStart,
    currentPeriodEnd: stored?.currentPeriodEnd,
    confirmationUrl: stored?.confirmationUrl,
  });
  try {
    const token = await storedAccessToken(shop);
    if (token) {
      return (await syncShopifyBillingFromAdmin(shop, token)) || saved;
    }
  } catch {
    // Stored snapshot is enough when Admin GraphQL is unreachable.
  }
  return saved;
}
