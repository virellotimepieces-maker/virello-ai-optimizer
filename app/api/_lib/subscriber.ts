import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { database, ensureDatabaseSchema } from "./database";
import { authenticateShopifyRequest, normalizeShop } from "./shopify-auth";

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const SUBSCRIBER_COOKIE = "virello_subscriber";

type StripeSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | string;

type SubscriberPayload = {
  v: 1;
  subscriptionId: string;
  customerId: string;
  status: StripeSubscriptionStatus;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  usageCount: number;
  usagePeriodStart: number;
  refreshedAt: number;
};

type SubscriptionSnapshot = {
  subscriptionId: string;
  customerId: string;
  status: StripeSubscriptionStatus;
  currentPeriodStart: number;
  currentPeriodEnd: number;
};

export type CheckoutSubscription = {
  shop: string;
  subscription: SubscriptionSnapshot;
};

export type SubscriberUsage = {
  limit: number;
  used: number;
  remaining: number;
};

export type ActiveSubscriberStatus = {
  active: boolean;
  customerId: string | null;
  subscriptionId: string | null;
  status: StripeSubscriptionStatus | null;
};

function getStripeSecret(): string {
  const secret = process.env.STRIPE_SECRET_KEY;

  if (!secret) {
    throw new ApiError(
      "STRIPE_SECRET_KEY is not configured.",
      500
    );
  }

  return secret;
}

function getCookieSecrets(): string[] {
  const secrets = [
    process.env.SUBSCRIBER_COOKIE_SECRET,
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY,
  ]
    .map((value) => value?.trim() || "")
    .filter((value, index, values) =>
      Boolean(value) && values.indexOf(value) === index
    );

  if (secrets.length === 0) {
    throw new ApiError("Subscriber cookie signing key is not configured.", 500);
  }

  return secrets;
}

function getCookieSecret(): string {
  return getCookieSecrets()[0];
}

function decodeConfiguredSubscriberPayload(value: string): SubscriberPayload | null {
  for (const secret of getCookieSecrets()) {
    const payload = decodeSubscriberPayload(value, secret);
    if (payload) return payload;
  }

  return null;
}

export function getUsageLimit(): number {
  const raw = process.env.AI_SUBSCRIBER_USAGE_LIMIT?.trim();
  if (!raw) return 1000;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return 1000;
  return parsed;
}

function signPayload(
  encodedPayload: string,
  secret: string
): string {
  return createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
}

function encodeSubscriberPayload(
  payload: SubscriberPayload,
  secret: string
): string {
  const encodedPayload = Buffer.from(
    JSON.stringify(payload)
  ).toString("base64url");

  const signature = signPayload(
    encodedPayload,
    secret
  );

  return `${encodedPayload}.${signature}`;
}

function decodeSubscriberPayload(
  value: string,
  secret: string
): SubscriberPayload | null {
  try {
    const [encodedPayload, signature] =
      value.split(".");

    if (!encodedPayload || !signature) {
      return null;
    }

    const expectedSignature = signPayload(
      encodedPayload,
      secret
    );

    const received = Buffer.from(
      signature,
      "base64url"
    );

    const expected = Buffer.from(
      expectedSignature,
      "base64url"
    );

    if (received.length !== expected.length) {
      return null;
    }

    if (!timingSafeEqual(received, expected)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(
        encodedPayload,
        "base64url"
      ).toString("utf8")
    ) as SubscriberPayload;

    if (
      !payload ||
      payload.v !== 1 ||
      typeof payload.subscriptionId !== "string" ||
      typeof payload.customerId !== "string" ||
      typeof payload.currentPeriodStart !== "number" ||
      typeof payload.currentPeriodEnd !== "number" ||
      typeof payload.usageCount !== "number" ||
      typeof payload.usagePeriodStart !== "number"
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function stripeRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: URLSearchParams;
  } = {}
): Promise<T> {
  const secretKey = getStripeSecret();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
  };

  if (options.body) {
    headers["Content-Type"] =
      "application/x-www-form-urlencoded";
  }

  const response = await fetch(
    `https://api.stripe.com/v1/${path}`,
    {
      method: options.method || "GET",
      headers,
      body: options.body?.toString(),
      cache: "no-store",
    }
  );

  const text = await response.text();

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError(
      `Stripe returned a non-JSON response (${response.status}).`,
      502
    );
  }

  if (!response.ok) {
    throw new ApiError(
      data?.error?.message ||
        "Stripe request failed.",
      response.status >= 400
        ? response.status
        : 502
    );
  }

  return data as T;
}

function normalizeSubscription(
  data: any
): SubscriptionSnapshot {
  const id =
    typeof data?.id === "string"
      ? data.id
      : "";

  const status =
    typeof data?.status === "string"
      ? data.status
      : "";

  const customer = data?.customer;

  const customerId =
    typeof customer === "string"
      ? customer
      : typeof customer?.id === "string"
        ? customer.id
        : "";

  // Stripe Basil moved billing periods from Subscription to SubscriptionItem.
  const firstItem = Array.isArray(data?.items?.data)
    ? data.items.data[0]
    : null;

  const periodStart =
    typeof data?.current_period_start === "number"
      ? data.current_period_start
      : typeof firstItem?.current_period_start === "number"
        ? firstItem.current_period_start
        : 0;

  const periodEnd =
    typeof data?.current_period_end === "number"
      ? data.current_period_end
      : typeof firstItem?.current_period_end === "number"
        ? firstItem.current_period_end
        : 0;

  if (!id || !customerId || !status || !periodStart || !periodEnd) {
    throw new ApiError(
      "Stripe subscription payload is invalid.",
      502
    );
  }

  return {
    subscriptionId: id,
    customerId,
    status,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
  };
}

export async function saveStripeSubscriptionPayload(
  shop: string,
  payload: unknown
): Promise<void> {
  await saveShopSubscription(shop, normalizeSubscription(payload));
}

function ensureActiveStatus(
  status: StripeSubscriptionStatus
): void {
  if (
    status === "active" ||
    status === "trialing"
  ) {
    return;
  }

  if (status === "past_due") {
    throw new ApiError(
      "Subscription payment is past due. Update billing to continue using AI optimization.",
      402
    );
  }

  if (
    status === "canceled" ||
    status === "unpaid"
  ) {
    throw new ApiError(
      "An active subscription is required to use AI optimization.",
      402
    );
  }

  throw new ApiError(
    `Subscription is not active (${status}).`,
    402
  );
}

function getEmbeddedShopifyAppUrl(
  shop: string,
  checkout: "cancelled"
): string {
  const storeHandle = shop.replace(/\.myshopify\.com$/i, "");
  const appHandle =
    process.env.SHOPIFY_APP_HANDLE?.trim() ||
    "virello-ai-optimizer";
  const url = new URL(
    `/store/${encodeURIComponent(storeHandle)}/apps/${encodeURIComponent(appHandle)}`,
    "https://admin.shopify.com"
  );
  url.searchParams.set("shop", shop);
  url.searchParams.set("checkout", checkout);
  return url.toString();
}

export async function createStripeCheckoutSession(
  origin: string,
  shop: string
): Promise<string> {
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!priceId) {
    throw new ApiError(
      "STRIPE_PRICE_ID is not configured.",
      500
    );
  }

  const body = new URLSearchParams();

  body.set("mode", "subscription");

  body.set(
    "line_items[0][price]",
    priceId
  );

  body.set(
    "line_items[0][quantity]",
    "1"
  );

  body.set(
    "success_url",
    `${origin}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}`
  );

  body.set(
    "cancel_url",
    getEmbeddedShopifyAppUrl(shop, "cancelled")
  );

  body.set(
    "billing_address_collection",
    "auto"
  );

  body.set("client_reference_id", shop);
  body.set("metadata[shop]", shop);
  body.set("subscription_data[metadata][shop]", shop);

  const session =
    await stripeRequest<{ url?: string }>(
      "checkout/sessions",
      {
        method: "POST",
        body,
      }
    );

  if (!session.url) {
    throw new ApiError(
      "Stripe checkout did not return a checkout URL.",
      502
    );
  }

  return session.url;
}

export async function getCheckoutSubscription(
  sessionId: string
): Promise<CheckoutSubscription> {
  const checkoutSession =
    await stripeRequest<any>(
      `checkout/sessions/${encodeURIComponent(
        sessionId
      )}?expand[]=subscription`
    );

  const subscriptionRef =
    checkoutSession?.subscription;

  const subscriptionId =
    typeof subscriptionRef === "string"
      ? subscriptionRef
      : typeof subscriptionRef?.id === "string"
        ? subscriptionRef.id
        : "";

  if (!subscriptionId) {
    throw new ApiError(
      "Stripe checkout session did not include a subscription.",
      400
    );
  }

  const subscription =
    await stripeRequest<any>(
      `subscriptions/${encodeURIComponent(
        subscriptionId
      )}`
    );

  const shop = normalizeShop(
    checkoutSession?.client_reference_id ||
    checkoutSession?.metadata?.shop ||
    subscription?.metadata?.shop ||
    ""
  );

  if (!shop) {
    throw new ApiError("Stripe checkout is not linked to a Shopify store.", 400);
  }

  return { shop, subscription: normalizeSubscription(subscription) };
}

export async function saveShopSubscription(
  shop: string,
  subscription: SubscriptionSnapshot
): Promise<void> {
  const normalizedShop = normalizeShop(shop);
  if (!normalizedShop) throw new ApiError("Invalid Shopify store.", 400);
  const sql = database();
  await ensureDatabaseSchema();
  await sql`
    INSERT INTO shop_subscriptions (
      shop, stripe_customer_id, stripe_subscription_id, status,
      current_period_start, current_period_end, updated_at
    ) VALUES (
      ${normalizedShop}, ${subscription.customerId}, ${subscription.subscriptionId},
      ${subscription.status}, ${subscription.currentPeriodStart},
      ${subscription.currentPeriodEnd}, NOW()
    )
    ON CONFLICT (shop) DO UPDATE SET
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      status = EXCLUDED.status,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      updated_at = NOW()
  `;
}

export async function subscriptionForShop(shop: string): Promise<SubscriptionSnapshot | null> {
  const sql = database();
  await ensureDatabaseSchema();
  const rows = await sql`
    SELECT stripe_customer_id, stripe_subscription_id, status,
           current_period_start, current_period_end
    FROM shop_subscriptions
    WHERE shop = ${shop}
    LIMIT 1
  `;
  if (!rows.length) return null;
  return {
    customerId: String(rows[0].stripe_customer_id),
    subscriptionId: String(rows[0].stripe_subscription_id),
    status: String(rows[0].status),
    currentPeriodStart: Number(rows[0].current_period_start),
    currentPeriodEnd: Number(rows[0].current_period_end),
  };
}

export async function refreshShopSubscription(shop: string): Promise<SubscriptionSnapshot | null> {
  const saved = await subscriptionForShop(shop);
  if (!saved) return null;
  const fresh = normalizeSubscription(await stripeRequest<any>(
    `subscriptions/${encodeURIComponent(saved.subscriptionId)}`
  ));
  await saveShopSubscription(shop, fresh);
  return fresh;
}

async function updateUsageState(
  subscription: SubscriptionSnapshot
): Promise<SubscriberUsage> {
  const sql = database();
  await ensureDatabaseSchema();
  const limit = getUsageLimit();

  const rows = await sql`
    INSERT INTO subscriber_usage (
      subscription_id,
      period_start,
      usage_count,
      updated_at
    )
    VALUES (
      ${subscription.subscriptionId},
      ${subscription.currentPeriodStart},
      1,
      NOW()
    )
    ON CONFLICT (subscription_id, period_start)
    DO UPDATE SET
      usage_count = subscriber_usage.usage_count + 1,
      updated_at = NOW()
    WHERE subscriber_usage.usage_count < ${limit}
    RETURNING usage_count
  `;

  if (rows.length === 0) {
    throw new ApiError(
      "You have reached your AI usage limit for the current billing period.",
      429
    );
  }

  const used = Number(rows[0].usage_count);

  if (!Number.isFinite(used)) {
    throw new ApiError(
      "Unable to determine subscriber usage.",
      500
    );
  }

  return {
    used,
    limit,
    remaining: Math.max(
      0,
      limit - used
    ),
  };
}

export async function authorizeSubscriberForAI(
  request: NextRequest
): Promise<{
  cookieValue: string;
  usage: SubscriberUsage;
}> {
  let shop = "";
  try {
    shop = (await authenticateShopifyRequest(request, false)).shop;
  } catch {
    shop = await getShopForSubscriberCookie(request);
  }

  if (!shop) {
    throw new ApiError("A verified Shopify subscription is required.", 401);
  }

  const refreshedSubscription = await refreshShopSubscription(shop);

  if (!refreshedSubscription) {
    throw new ApiError("An active subscription is required to use AI optimization.", 402);
  }

  ensureActiveStatus(
    refreshedSubscription.status
  );

  const usage =
    await updateUsageState(
      refreshedSubscription
    );

  const payload: SubscriberPayload = {
    v: 1,
    subscriptionId:
      refreshedSubscription.subscriptionId,
    customerId:
      refreshedSubscription.customerId,
    status:
      refreshedSubscription.status,
    currentPeriodStart:
      refreshedSubscription.currentPeriodStart,
    currentPeriodEnd:
      refreshedSubscription.currentPeriodEnd,
    usageCount: usage.used,
    usagePeriodStart:
      refreshedSubscription.currentPeriodStart,
    refreshedAt: Date.now(),
  };

  return {
    cookieValue:
      encodeSubscriberPayload(payload, getCookieSecret()),
    usage,
  };
}

export function setSubscriberCookie(
  response: NextResponse,
  cookieValue: string
): void {
  response.cookies.set(
    SUBSCRIBER_COOKIE,
    cookieValue,
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "none",
      path: "/",
      maxAge: 60 * 60 * 24 * 32,
    }
  );
}

export function clearSubscriberCookie(
  response: NextResponse
): void {
  response.cookies.set(
    SUBSCRIBER_COOKIE,
    "",
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "none",
      path: "/",
      maxAge: 0,
    }
  );
}

export function buildSubscriberCookieValue(
  subscription: SubscriptionSnapshot
): string {
  const secret = getCookieSecret();

  ensureActiveStatus(
    subscription.status
  );

  const payload: SubscriberPayload = {
    v: 1,
    subscriptionId:
      subscription.subscriptionId,
    customerId:
      subscription.customerId,
    status: subscription.status,
    currentPeriodStart:
      subscription.currentPeriodStart,
    currentPeriodEnd:
      subscription.currentPeriodEnd,
    usageCount: 0,
    usagePeriodStart:
      subscription.currentPeriodStart,
    refreshedAt: Date.now(),
  };

  return encodeSubscriberPayload(
    payload,
    secret
  );
}

export async function getShopForSubscriberCookie(
  request: NextRequest
): Promise<string> {
  try {
    const cookieValue =
      request.cookies.get(SUBSCRIBER_COOKIE)?.value || "";

    if (!cookieValue) {
      return "";
    }

    const payload = decodeConfiguredSubscriberPayload(cookieValue);

    if (!payload?.subscriptionId) {
      return "";
    }

    const sql = database();
    await ensureDatabaseSchema();

    const rows = await sql`
      SELECT shop
      FROM shop_subscriptions
      WHERE stripe_subscription_id = ${payload.subscriptionId}
      LIMIT 1
    `;

    return normalizeShop(
      String(rows[0]?.shop || "")
    );
  } catch (error) {
    console.error(
      "SUBSCRIBER_SHOP_LOOKUP_ERROR:",
      error
    );
    return "";
  }
}

export async function hasActiveSubscriber(
  request: NextRequest
): Promise<boolean> {
  try {
    let shop = "";
    try {
      shop = (await authenticateShopifyRequest(request, false)).shop;
    } catch {
      shop = await getShopForSubscriberCookie(request);
    }
    if (!shop) return false;
    const subscription = await refreshShopSubscription(shop);
    if (!subscription) return false;

    ensureActiveStatus(
      subscription.status
    );

    return true;
  } catch {
    return false;
  }
}

/*
 * Returns the verified Stripe subscriber information.
 * This is used by /api/subscriber/status and the
 * Stripe Billing Portal flow.
 */
export async function getActiveSubscriberStatus(
  request: NextRequest
): Promise<ActiveSubscriberStatus> {
  try {
    let shop = "";

    try {
      shop = (await authenticateShopifyRequest(request, false)).shop;
    } catch {
      // Stripe checkout returns through the top-level browser. On mobile,
      // Shopify and the top-level Vercel page can use partitioned cookie jars,
      // so recover the shop from the separately signed subscriber cookie.
      shop = await getShopForSubscriberCookie(request);
    }

    if (!shop) {
      return { active: false, customerId: null, subscriptionId: null, status: null };
    }

    const subscription = await refreshShopSubscription(shop);
    if (!subscription) {
      return { active: false, customerId: null, subscriptionId: null, status: null };
    }

    const active =
      subscription.status === "active" ||
      subscription.status === "trialing";

    return {
      active,
      customerId:
        subscription.customerId,
      subscriptionId:
        subscription.subscriptionId,
      status:
        subscription.status,
    };
  } catch (error) {
    console.error(
      "SUBSCRIBER_STATUS_ERROR:",
      error
    );

    return {
      active: false,
      customerId: null,
      subscriptionId: null,
      status: null,
    };
  }
}
