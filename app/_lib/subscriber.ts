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
      typeof payload.subscriptionId !== "string" ||
      typeof payload.customerId !== "string" ||
      typeof payload.status !== "string" ||
      typeof payload.currentPeriodStart !== "number" ||
      typeof payload.currentPeriodEnd !== "number" ||
      typeof payload.usageCount !== "number" ||
      typeof payload.usagePeriodStart !== "number" ||
      typeof payload.refreshedAt !== "number"
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

  const customer = data?.customer;

  const customerId =
    typeof customer === "string"
      ? customer
      : typeof customer?.id === "string"
        ? customer.id
        : "";

  const currentPeriodStart =
    typeof data?.current_period_start === "number"
      ? data.current_period_start
      : 0;

  const currentPeriodEnd =
    typeof data?.current_period_end === "number"
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
    throw new
