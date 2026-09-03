import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "./app-url";
import { shopFromSessionCookie, clearSessionCookie } from "./app-session";
import { authenticateShopifyRequest, normalizeShop } from "./shopify-auth";
import { getSessionBinding } from "./shop-binding";
import { isShopifyInstallationActive } from "./shops";
import { peekAiUsage, consumeAiUsage } from "./usage";
import { getUsageLimit, type SubscriberUsage } from "./usage-limit";
import {
  isPaidSubscriptionStatus,
  type StripeSubscriptionStatus,
} from "./stripe-access";
import { accessStateForShop, applySubscriptionEvent } from "./stripe-events";
import {
  billingForShop,
  saveShopSubscription as persistShopSubscription,
  shopForCustomerId,
  shopForSubscriptionId,
} from "./stripe-billing";
import { assertConfiguredStripePrice } from "./stripe-price";
import {
  assertLivemodeMatchesSecret,
  configuredStripeMode,
  isStripeWrongModeObjectError,
} from "./stripe-mode";
import { requirePaidProductAccess } from "./product-access";
import { decodeLegacySubscriberCookie } from "./legacy-subscriber-cookie";
import { checkoutCancelUrl, type CheckoutFlow } from "./checkout-shop";

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const SUBSCRIBER_COOKIE = "virello_sid";

type SubscriptionSnapshot = {
  subscriptionId: string;
  customerId: string;
  status: StripeSubscriptionStatus;
  currentPeriodStart: number;
  currentPeriodEnd: number;
};

export type CheckoutSubscription = {
  shop: string;
  flow: CheckoutFlow;
  subscription: SubscriptionSnapshot;
  livemode: boolean;
};

export type { SubscriberUsage };
export { isPaidSubscriptionStatus, getUsageLimit };

export type ActiveSubscriberStatus = {
  active: boolean;
  canManage: boolean;
  shopInstalled: boolean;
  shop: string | null;
  billedShop: string | null;
  pendingShop: string | null;
  canReplaceShop: boolean;
  customerId: string | null;
  subscriptionId: string | null;
  status: StripeSubscriptionStatus | null;
  reason?: string;
  usage?: { limit: number; used: number; remaining: number } | null;
  sandboxBilling?: boolean;
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

export async function stripeRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: URLSearchParams;
  } = {}
): Promise<T> {
  const secretKey = getStripeSecret();
  configuredStripeMode(secretKey);

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
    const message =
      data?.error?.message ||
      "Stripe request failed.";
    throw new ApiError(
      isStripeWrongModeObjectError(message)
        ? "Your previous subscription is test-mode only. Subscribe again with a real card."
        : message,
      response.status >= 400
        ? response.status
        : 502
    );
  }

  if (typeof data?.livemode === "boolean") {
    assertLivemodeMatchesSecret(data.livemode, path);
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
  payload: unknown,
  eventCreated = Math.floor(Date.now() / 1000)
): Promise<void> {
  await applySubscriptionEvent({
    shop,
    object: payload as Parameters<typeof applySubscriptionEvent>[0]["object"],
    eventCreated,
  });
}

export function subscriptionPrivilegeChanged(
  previous: SubscriptionSnapshot | null,
  next: SubscriptionSnapshot
): boolean {
  if (!previous) return true;
  return (
    previous.subscriptionId !== next.subscriptionId ||
    previous.customerId !== next.customerId ||
    previous.status !== next.status
  );
}

export async function createStripeCheckoutSession(
  _origin: string,
  shop: string,
  flow: "embedded" | "standalone" = "standalone"
): Promise<string> {
  void _origin;
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!priceId) {
    throw new ApiError(
      "STRIPE_PRICE_ID is not configured.",
      500
    );
  }

  const price = await stripeRequest<Parameters<typeof assertConfiguredStripePrice>[0]>(
    `prices/${encodeURIComponent(priceId)}`
  );
  assertConfiguredStripePrice(price);

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

  const appUrl = getAppUrl();

  body.set(
    "success_url",
    `${appUrl}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}`
  );

  body.set(
    "cancel_url",
    checkoutCancelUrl(appUrl, shop, flow)
  );

  body.set(
    "billing_address_collection",
    "auto"
  );

  body.set("client_reference_id", shop);
  body.set("metadata[shop]", shop);
  body.set("metadata[flow]", flow);
  body.set("subscription_data[metadata][shop]", shop);
  body.set("subscription_data[metadata][flow]", flow);

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
      )}?expand[]=subscription&expand[]=customer`
    );

  if (typeof checkoutSession?.livemode !== "boolean") {
    throw new ApiError("Stripe checkout session did not include livemode.", 502);
  }
  assertLivemodeMatchesSecret(checkoutSession.livemode, "checkout session");

  const subscriptionRef = checkoutSession?.subscription;
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
    typeof subscriptionRef === "object" && subscriptionRef?.id
      ? subscriptionRef
      : await stripeRequest<any>(
          `subscriptions/${encodeURIComponent(subscriptionId)}`
        );

  if (typeof subscription?.livemode === "boolean") {
    assertLivemodeMatchesSecret(subscription.livemode, "subscription");
  }

  const customerRef = checkoutSession?.customer ?? subscription?.customer;
  const customerId =
    typeof customerRef === "string"
      ? customerRef
      : typeof customerRef?.id === "string"
        ? customerRef.id
        : "";

  if (!customerId) {
    throw new ApiError("Stripe checkout session did not include a customer.", 400);
  }

  const customer =
    typeof customerRef === "object" && customerRef?.id
      ? customerRef
      : await stripeRequest<any>(`customers/${encodeURIComponent(customerId)}`);

  if (typeof customer?.livemode === "boolean") {
    assertLivemodeMatchesSecret(customer.livemode, "customer");
  }

  const shop = normalizeShop(
    checkoutSession?.client_reference_id ||
    checkoutSession?.metadata?.shop ||
    subscription?.metadata?.shop ||
    ""
  );

  if (!shop) {
    throw new ApiError("Stripe checkout is not linked to a Shopify store.", 400);
  }

  const flow: CheckoutFlow =
    checkoutSession?.metadata?.flow === "embedded" ||
    subscription?.metadata?.flow === "embedded"
      ? "embedded"
      : "standalone";

  return {
    shop,
    flow,
    subscription: normalizeSubscription(subscription),
    livemode: checkoutSession.livemode,
  };
}

export async function saveShopSubscription(
  shop: string,
  subscription: SubscriptionSnapshot,
  eventCreated = Math.floor(Date.now() / 1000)
): Promise<void> {
  await persistShopSubscription({
    shop,
    customerId: subscription.customerId,
    subscriptionId: subscription.subscriptionId,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    eventCreated,
  });
}

export async function subscriptionForShop(
  shop: string
): Promise<SubscriptionSnapshot | null> {
  const billing = await billingForShop(shop);
  if (!billing) return null;
  return {
    customerId: billing.customerId,
    subscriptionId: billing.subscriptionId,
    status: billing.status,
    currentPeriodStart: billing.currentPeriodStart,
    currentPeriodEnd: billing.currentPeriodEnd,
  };
}

export async function refreshShopSubscription(
  shop: string
): Promise<SubscriptionSnapshot | null> {
  const saved = await subscriptionForShop(shop);
  if (!saved) return null;
  const fresh = normalizeSubscription(
    await stripeRequest<any>(
      `subscriptions/${encodeURIComponent(saved.subscriptionId)}`
    )
  );
  await saveShopSubscription(shop, fresh);
  return fresh;
}

export async function authorizeSubscriberForAI(
  request: NextRequest
): Promise<{
  shop: string;
  subscription: SubscriptionSnapshot;
  usage: SubscriberUsage;
}> {
  const { shop, billing } = await requirePaidProductAccess(request);

  const usage = await peekAiUsage(
    shop,
    billing.subscriptionId,
    billing.currentPeriodStart
  );

  if (usage.remaining <= 0) {
    throw new ApiError(
      "You have reached your AI usage limit for the current billing period.",
      429
    );
  }

  return {
    shop,
    subscription: {
      customerId: billing.customerId,
      subscriptionId: billing.subscriptionId,
      status: billing.status,
      currentPeriodStart: billing.currentPeriodStart,
      currentPeriodEnd: billing.currentPeriodEnd,
    },
    usage,
  };
}

export async function recordSuccessfulAiOptimization(
  shop: string,
  subscription: SubscriptionSnapshot
): Promise<{
  usage: SubscriberUsage;
}> {
  try {
    const usage = await consumeAiUsage(
      shop,
      subscription.subscriptionId,
      subscription.currentPeriodStart
    );
    return { usage };
  } catch (error) {
    const status = (error as { status?: number }).status;
    throw new ApiError(
      error instanceof Error
        ? error.message
        : "Unable to record AI usage.",
      status === 429 ? 429 : 500
    );
  }
}

export function clearSubscriberCookie(response: NextResponse): void {
  clearSessionCookie(response);
}

export async function getShopForSubscriberCookie(
  request: NextRequest
): Promise<string> {
  const fromSession = await shopFromSessionCookie(request);
  if (fromSession) return fromSession;

  const legacy = decodeLegacySubscriberCookie(
    request.cookies.get("virello_subscriber")?.value || ""
  );
  if (!legacy) return "";

  const shop = await shopForSubscriptionId(legacy.subscriptionId);
  if (!shop) return "";

  const billing = await billingForShop(shop);
  if (!billing || billing.customerId !== legacy.customerId) return "";
  return shop;
}

async function statusForShop(shop: string): Promise<ActiveSubscriberStatus> {
  const shopInstalled = await isShopifyInstallationActive(shop);
  const { access, billing, modeMismatch } = await accessStateForShop(shop, shopInstalled);
  let usage = null;
  if (billing) {
    usage = await peekAiUsage(shop, billing.subscriptionId, billing.currentPeriodStart);
  }
  return {
    active: access.productAccess,
    canManage: access.canManage,
    shopInstalled,
    shop,
    billedShop: billing?.customerId
      ? (await shopForCustomerId(billing.customerId)) || shop
      : null,
    pendingShop: null,
    canReplaceShop: !shopInstalled,
    customerId: billing?.customerId ?? null,
    subscriptionId: billing?.subscriptionId ?? null,
    status: billing?.status ?? null,
    reason: modeMismatch ? "sandbox_billing" : access.reason,
    usage,
    sandboxBilling: modeMismatch,
  };
}

export async function storedSubscriberStatus(
  shop: string
): Promise<ActiveSubscriberStatus> {
  return statusForShop(shop);
}

export async function hasActiveSubscriber(
  request: NextRequest
): Promise<boolean> {
  try {
    const status = await getActiveSubscriberStatus(request);
    return status.active;
  } catch {
    return false;
  }
}

export async function getActiveSubscriberStatus(
  request: NextRequest
): Promise<ActiveSubscriberStatus> {
  const empty: ActiveSubscriberStatus = {
    active: false,
    canManage: false,
    shopInstalled: false,
    shop: null,
    billedShop: null,
    pendingShop: null,
    canReplaceShop: true,
    customerId: null,
    subscriptionId: null,
    status: null,
    sandboxBilling: false,
  };

  try {
    const binding = await getSessionBinding(request);
    let shop = "";
    try {
      shop = (await authenticateShopifyRequest(request, false)).shop;
    } catch {
      shop = binding?.sessionShop || (await getShopForSubscriberCookie(request));
    }

    if (!shop) {
      const billedShop = binding?.stripeCustomerId
        ? (await shopForCustomerId(binding.stripeCustomerId)) || null
        : null;
      return {
        ...empty,
        billedShop,
        pendingShop: binding?.pendingShop ?? null,
        canReplaceShop: binding?.canReplaceShop ?? true,
      };
    }

    try {
      await refreshShopSubscription(shop);
    } catch {
      // Use stored billing when Stripe is unreachable.
    }
    const status = await statusForShop(shop);
    const customerId = status.sandboxBilling
      ? ""
      : binding?.stripeCustomerId || status.customerId || "";
    const billedShop = customerId ? (await shopForCustomerId(customerId)) || null : status.billedShop;
    return {
      ...status,
      billedShop: billedShop || status.billedShop,
      pendingShop: binding?.pendingShop ?? null,
      canReplaceShop: binding?.canReplaceShop ?? !status.shopInstalled,
    };
  } catch (error) {
    console.error("SUBSCRIBER_STATUS_ERROR:", error);
    return empty;
  }
}

