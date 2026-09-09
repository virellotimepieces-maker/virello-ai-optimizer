import { NextRequest, NextResponse } from "next/server";
import { shopFromSessionCookie, clearSessionCookie } from "./app-session";
import { authenticateShopifyRequest, storedAccessToken } from "./shopify-auth";
import { getSessionBinding } from "./shop-binding";
import { isShopifyInstallationActive } from "./shops";
import { peekAiUsage, consumeAiUsage } from "./usage";
import { getUsageLimit, type SubscriberUsage } from "./usage-limit";
import {
  isPaidSubscriptionStatus,
  type ShopifySubscriptionStatus,
} from "./billing-access";
import { accessStateForShop, billingForShop, billingPeriodIsStale, syncShopifyBillingFromAdmin, usagePeriodStart } from "./shopify-billing";
import { requirePaidProductAccess } from "./product-access";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const SUBSCRIBER_COOKIE = "virello_sid";

export type SubscriptionSnapshot = {
  subscriptionId: string;
  status: ShopifySubscriptionStatus;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  test: boolean;
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
  subscriptionId: string | null;
  status: ShopifySubscriptionStatus | null;
  reason?: string;
  usage?: { limit: number; used: number; remaining: number } | null;
    billingTest?: boolean | null;
};

export async function authorizeSubscriberForAI(
  request: NextRequest
): Promise<{
  shop: string;
  subscription: SubscriptionSnapshot;
  usage: SubscriberUsage;
}> {
  const { shop, billing } = await requirePaidProductAccess(request);
  const periodStart = usagePeriodStart(billing);
  const usage = await peekAiUsage(shop, billing.subscriptionId, periodStart);
  if (usage.remaining <= 0) {
    throw new ApiError(
      "You have reached your AI usage limit for the current billing period.",
      429
    );
  }
  return {
    shop,
    subscription: {
      subscriptionId: billing.subscriptionId,
      status: billing.status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: billing.currentPeriodEnd,
      test: billing.test,
    },
    usage,
  };
}

export async function recordSuccessfulAiOptimization(
  shop: string,
  subscription: SubscriptionSnapshot,
  idempotencyKey?: string
): Promise<{ usage: SubscriberUsage }> {
  try {
    const usage = await consumeAiUsage(
      shop,
      subscription.subscriptionId,
      subscription.currentPeriodStart,
      idempotencyKey
    );
    return { usage };
  } catch (error) {
    const status = (error as { status?: number }).status;
    throw new ApiError(
      error instanceof Error ? error.message : "Unable to record AI usage.",
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
  const binding = await getSessionBinding(request);
  if (binding?.sessionShop) return binding.sessionShop;
  return shopFromSessionCookie(request);
}

export async function storedSubscriberStatus(
  shop: string
): Promise<ActiveSubscriberStatus> {
  const shopInstalled = await isShopifyInstallationActive(shop);
  const { access, billing } = await accessStateForShop(shop, shopInstalled);
  let usage = null;
  if (billing) {
    usage = await peekAiUsage(
      shop,
      billing.subscriptionId,
      usagePeriodStart(billing)
    );
  }
  return {
    active: access.productAccess,
    canManage: access.canManage,
    shopInstalled,
    shop,
    billedShop: billing ? shop : null,
    pendingShop: null,
    canReplaceShop: !shopInstalled,
    subscriptionId: billing?.subscriptionId ?? null,
    status: billing?.status ?? null,
    reason: access.reason,
    usage,
    billingTest: billing?.test ?? null,
  };
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
    subscriptionId: null,
    status: null,
    billingTest: null,
  };

  try {
    const binding = await getSessionBinding(request);
    let shop = "";
    let accessToken = "";
    try {
      const auth = await authenticateShopifyRequest(request, true);
      shop = auth.shop;
      accessToken = auth.accessToken;
    } catch {
      try {
        const auth = await authenticateShopifyRequest(request, false);
        shop = auth.shop;
      } catch {
        shop = binding?.sessionShop || (await shopFromSessionCookie(request));
      }
      if (shop) {
        accessToken = await storedAccessToken(shop);
      }
    }

    if (!shop) {
      return {
        ...empty,
        pendingShop: binding?.pendingShop ?? null,
        canReplaceShop: binding?.canReplaceShop ?? true,
      };
    }

    if (accessToken) {
      try {
        const current = await billingForShop(shop);
        if (
          !current ||
          !isPaidSubscriptionStatus(current.status) ||
          billingPeriodIsStale(current)
        ) {
          await syncShopifyBillingFromAdmin(shop, accessToken);
        }
      } catch {
        // Use stored billing when Shopify Admin is unreachable.
      }
    }

    const status = await storedSubscriberStatus(shop);
    return {
      ...status,
      pendingShop: binding?.pendingShop ?? null,
      canReplaceShop: binding?.canReplaceShop ?? !status.shopInstalled,
    };
  } catch (error) {
    console.error("SUBSCRIBER_STATUS_ERROR:", error);
    return empty;
  }
}
