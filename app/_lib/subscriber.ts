import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "./shopify";

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

function getCookieSecret(
  stripeSecret: string
): string {
  return (
    process.env.SUBSCRIBER_COOKIE_SECRET ||
    stripeSecret
  );
}

function getUsageLimit(): number {
  const value = Number.parseInt(
    process.env.AI_SUBSCRIBER_USAGE_LIMIT || "100",
    10
  );

  if (!Number.isFinite(value) || value <= 0) {
    return 100;
  }

  return value;
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
    const parts = value.split(".");

    if (parts.length !== 2) {
      return null;
    }

    const [encodedPayload, signature] = parts;

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

    if (
      !timingSafeEqual(
        received,
        expected
      )
    ) {
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
      typeof payload.subscriptionId !==
        "string" ||
      typeof payload.customerId !==
        "string" ||
      typeof payload.status !== "string" ||
      typeof payload.currentPeriodStart !==
        "number" ||
      typeof payload.currentPeriodEnd !==
        "number" ||
      typeof payload.usageCount !==
        "number" ||
      typeof payload.usagePeriodStart !==
        "number" ||
      typeof payload.refreshedAt !==
        "number"
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

  let body: string | undefined;

  if (options.body) {
    headers["Content-Type"] =
      "application/x-www-form-urlencoded";

    body = options.body.toString();
  }

  const response = await fetch(
    `https://api.stripe.com/v1/${path}`,
    {
      method: options.method || "GET",
      headers,
      body,
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
  const subscriptionId =
    typeof data?.id === "string"
      ? data.id
      : "";

  const status =
    typeof data?.status === "string"
      ? data.status
      : "";

  const customer =
    data?.customer;

  const customerId =
    typeof customer === "string"
      ? customer
      : typeof customer?.id === "string"
        ? customer.id
        : "";

  const currentPeriodStart =
    typeof data?.current_period_start ===
    "number"
      ? data.current_period_start
      : 0;

  const currentPeriodEnd =
    typeof data?.current_period_end ===
    "number"
      ? data.current_period_end
      : 0;

  if (
    !subscriptionId ||
    !customerId ||
    !status
  ) {
    throw new ApiError(
      "Stripe subscription payload is invalid.",
      502
    );
  }

  return {
    subscriptionId,
    customerId,
    status,
    currentPeriodStart,
    currentPeriodEnd,
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

async function withUsageLock<T>(
  key: string,
  action: () => Promise<T>
): Promise<T> {
  while (usageLock.get(key)) {
    await new Promise((resolve) =>
      setTimeout(resolve, 10)
    );
  }

  usageLock.set(key, true);

  try {
    return await action();
  } finally {
    usageLock.delete(key);
  }
}

function consumeUsage(
  subscription: SubscriptionSnapshot,
  previousCount: number
): SubscriberUsage {
  const limit = getUsageLimit();

  const key =
    `${subscription.subscriptionId}:` +
    `${subscription.currentPeriodStart}`;

  const existing = usageState.get(key);

  const currentCount = Math.max(
    existing?.count ?? 0,
    previousCount
  );

  if (currentCount >= limit) {
    throw new ApiError(
      "You have reached your AI usage limit for the current billing period.",
      429
    );
  }

  const used = currentCount + 1;

  usageState.set(key, {
    periodStart:
      subscription.currentPeriodStart,
    count: used,
  });

  return {
    limit,
    used,
    remaining: Math.max(
      0,
      limit - used
    ),
  };
}

export async function createStripeCheckoutSession(
  origin: string
): Promise<string> {
  const priceId =
    process.env.STRIPE_PRICE_ID;

  if (!priceId) {
    throw new ApiError(
      "STRIPE_PRICE_ID is not configured.",
      500
    );
  }

  const body =
    new URLSearchParams();

  body.set(
    "mode",
    "subscription"
  );

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
    await stripeRequest<{
      url?: string;
    }>(
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

  const subscription =
    checkoutSession?.subscription;

  const subscriptionId =
    typeof subscription === "string"
      ? subscription
      : typeof subscription?.id ===
          "string"
        ? subscription.id
        : "";

  if (!subscriptionId) {
    throw new ApiError(
      "Stripe checkout session did not include a subscription.",
      400
    );
  }

  const subscriptionData =
    await stripeRequest<any>(
      `subscriptions/${encodeURIComponent(
        subscriptionId
      )}`
    );

  return normalizeSubscription(
    subscriptionData
  );
}

export async function authorizeSubscriberForAI(
  request: NextRequest
): Promise<{
  cookieValue: string;
  usage: SubscriberUsage;
}> {
  const stripeSecret =
    getStripeSecret();

  const cookieSecret =
    getCookieSecret(
      stripeSecret
    );

  const cookie =
    request.cookies.get(
      SUBSCRIBER_COOKIE
    )?.value || "";

  if (!cookie) {
    throw new ApiError(
      "An active subscription is required to use AI optimization.",
      402
    );
  }

  const subscriber =
    decodeSubscriberPayload(
      cookie,
      cookieSecret
    );

  if (!subscriber) {
    throw new ApiError(
      "Subscriber session is invalid. Please complete checkout again.",
      401
    );
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

  const previousCount =
    subscriber.usagePeriodStart ===
    subscription.currentPeriodStart
      ? subscriber.usageCount
      : 0;

  const usage =
    await withUsageLock(
      `${subscription.subscriptionId}:${subscription.currentPeriodStart}`,
      async () =>
        consumeUsage(
          subscription,
          previousCount
        )
    );

  const payload: SubscriberPayload = {
    v: 1,
    subscriptionId:
      subscription.subscriptionId,
    customerId:
      subscription.customerId,
    status:
      subscription.status,
    currentPeriodStart:
      subscription.currentPeriodStart,
    currentPeriodEnd:
      subscription.currentPeriodEnd,
    usageCount:
      usage.used,
    usagePeriodStart:
      subscription.currentPeriodStart,
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

export function buildSubscriberCookieValue(
  subscription: SubscriptionSnapshot
): string {
  const stripeSecret =
    getStripeSecret();

  const cookieSecret =
    getCookieSecret(
      stripeSecret
    );

  ensureActiveStatus(
    subscription.status
  );

  const payload: SubscriberPayload = {
    v: 1,
    subscriptionId:
      subscription.subscriptionId,
    customerId:
      subscription.customerId,
    status:
      subscription.status,
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
    cookieSecret
  );
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
      maxAge:
        60 * 60 * 24 * 32,
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
