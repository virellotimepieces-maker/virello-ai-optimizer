import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

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

export type SubscriberUsage = {
  limit: number;
  used: number;
  remaining: number;
};

const usageLock = new Map<string, boolean>();

const usageState = new Map<
  string,
  {
    periodStart: number;
    count: number;
  }
>();

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

function getCookieSecret(stripeSecret: string): string {
  return (
    process.env.SUBSCRIBER_COOKIE_SECRET ||
    stripeSecret
  );
}

function getUsageLimit(): number {
  const parsed = Number.parseInt(
    process.env.AI_SUBSCRIBER_USAGE_LIMIT || "100",
    10
  );

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 100;
  }

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

async function stripeRequest<T>(
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

  const periodStart =
    typeof data?.current_period_start === "number"
      ? data.current_period_start
      : 0;

  const periodEnd =
    typeof data?.current_period_end === "number"
      ? data.current_period_end
      : 0;

  if (!id || !customerId || !status) {
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

async function lockUsage<T>(
  key: string,
  action: () => Promise<T>
): Promise<T> {
  while (usageLock.get(key)) {
    await new Promise((resolve) =>
      setTimeout(resolve, 4)
    );
  }

  usageLock.set(key, true);

  try {
    return await action();
  } finally {
    usageLock.delete(key);
  }
}

export async function createStripeCheckoutSession(
  origin: string
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
    `${origin}/?checkout=cancelled`
  );

  body.set(
    "billing_address_collection",
    "auto"
  );

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
): Promise<SubscriptionSnapshot> {
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

  return normalizeSubscription(subscription);
}

function updateUsageState(
  subscription: SubscriptionSnapshot,
  requestedCount: number
): SubscriberUsage {
  const usageKey =
    `${subscription.subscriptionId}:${subscription.currentPeriodStart}`;

  const limit = getUsageLimit();

  const existing = usageState.get(usageKey);

  const currentCount = Math.max(
    existing?.count ?? 0,
    requestedCount
  );

  if (currentCount >= limit) {
    throw new ApiError(
      "You have reached your AI usage limit for the current billing period.",
      429
    );
  }

  const nextCount = currentCount + 1;

  usageState.set(usageKey, {
    periodStart:
      subscription.currentPeriodStart,
    count: nextCount,
  });

  return {
    used: nextCount,
    limit,
    remaining: Math.max(
      0,
      limit - nextCount
    ),
  };
}

export async function authorizeSubscriberForAI(
  request: NextRequest
): Promise<{
  cookieValue: string;
  usage: SubscriberUsage;
}> {
  const stripeSecret = getStripeSecret();

  const cookieSecret =
    getCookieSecret(stripeSecret);

  const encoded =
    request.cookies.get(
      SUBSCRIBER_COOKIE
    )?.value || "";

  if (!encoded) {
    throw new ApiError(
      "An active subscription is required to use AI optimization.",
      402
    );
  }

  const subscriber =
    decodeSubscriberPayload(
      encoded,
      cookieSecret
    );

  if (!subscriber) {
    throw new ApiError(
      "Subscriber session is invalid. Please complete checkout again.",
      401
    );
  }

  const refreshedSubscription =
    normalizeSubscription(
      await stripeRequest<any>(
        `subscriptions/${encodeURIComponent(
          subscriber.subscriptionId
        )}`
      )
    );

  ensureActiveStatus(
    refreshedSubscription.status
  );

  const usage =
    await lockUsage(
      refreshedSubscription.subscriptionId,
      async () =>
        updateUsageState(
          refreshedSubscription,
          subscriber.usagePeriodStart ===
            refreshedSubscription.currentPeriodStart
            ? subscriber.usageCount
            : 0
        )
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
      encodeSubscriberPayload(
        payload,
        cookieSecret
      ),
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
      sameSite: "lax",
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
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    }
  );
}

export function buildSubscriberCookieValue(
  subscription: SubscriptionSnapshot
): string {
  const stripeSecret = getStripeSecret();

  const secret =
    getCookieSecret(stripeSecret);

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

export async function hasActiveSubscriber(
  request: NextRequest
): Promise<boolean> {
  try {
    const stripeSecret = getStripeSecret();

    const encoded =
      request.cookies.get(
        SUBSCRIBER_COOKIE
      )?.value || "";

    if (!encoded) {
      return false;
    }

    const subscriber =
      decodeSubscriberPayload(
        encoded,
        getCookieSecret(stripeSecret)
      );

    if (!subscriber) {
      return false;
    }

    const subscription =
      normalizeSubscription(
        await stripeRequest<any>(
          `subscriptions/${encodeURIComponent(
            subscriber.subscriptionId
          )}`
        )
      );

    ensureActiveStatus(
      subscription.status
    );

    return true;
  } catch {
    return false;
  }
        }
