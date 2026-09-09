export type ShopifySubscriptionStatus =
  | "ACTIVE"
  | "PENDING"
  | "DECLINED"
  | "CANCELLED"
  | "FROZEN"
  | "EXPIRED"
  | string;

export const PAID_PRODUCT_STATUSES = ["ACTIVE"] as const;
export const MANAGE_BILLING_STATUSES = ["ACTIVE", "PENDING", "FROZEN"] as const;

export type ProductAccessDecision = {
  productAccess: boolean;
  canManage: boolean;
  reason:
    | "ok"
    | "not_installed"
    | "no_subscription"
    | "pending"
    | "declined"
    | "cancelled"
    | "frozen"
    | "expired"
    | "ineligible"
    | "missing_scopes";
};

export function normalizeShopifySubscriptionStatus(
  status: string | null | undefined
): string {
  return String(status || "").trim().toUpperCase();
}

export function canManageBilling(
  status: ShopifySubscriptionStatus | null | undefined
): boolean {
  const normalized = normalizeShopifySubscriptionStatus(status);
  return (MANAGE_BILLING_STATUSES as readonly string[]).includes(normalized);
}

export function isPaidSubscriptionStatus(
  status: ShopifySubscriptionStatus | null | undefined
): boolean {
  return normalizeShopifySubscriptionStatus(status) === "ACTIVE";
}

export function productAccessDecision(input: {
  shopInstalled: boolean;
  status: ShopifySubscriptionStatus | null;
}): ProductAccessDecision {
  const status = normalizeShopifySubscriptionStatus(input.status);

  if (!input.shopInstalled) {
    return {
      productAccess: false,
      canManage: canManageBilling(status),
      reason: "not_installed",
    };
  }

  if (!status) {
    return {
      productAccess: false,
      canManage: false,
      reason: "no_subscription",
    };
  }

  if (status === "ACTIVE") {
    return { productAccess: true, canManage: true, reason: "ok" };
  }
  if (status === "PENDING") {
    return { productAccess: false, canManage: true, reason: "pending" };
  }
  if (status === "FROZEN") {
    return { productAccess: false, canManage: true, reason: "frozen" };
  }
  if (status === "DECLINED") {
    return { productAccess: false, canManage: false, reason: "declined" };
  }
  if (status === "CANCELLED") {
    return { productAccess: false, canManage: false, reason: "cancelled" };
  }
  if (status === "EXPIRED") {
    return { productAccess: false, canManage: false, reason: "expired" };
  }
  return {
    productAccess: false,
    canManage: canManageBilling(status),
    reason: "ineligible",
  };
}

export function productAccessDeniedMessage(
  reason: ProductAccessDecision["reason"]
): string {
  switch (reason) {
    case "not_installed":
      return "Reconnect Shopify before using Virello. Billing was not canceled.";
    case "missing_scopes":
      return "Shopify app is missing product permissions. Reconnect the store.";
    case "pending":
      return "Approve the $29.99/month Shopify charge to continue.";
    case "frozen":
      return "This store’s Shopify billing is frozen. Open Manage subscription in Shopify Admin.";
    case "declined":
    case "cancelled":
    case "expired":
    case "no_subscription":
    case "ineligible":
    default:
      return "An active $29.99/month Shopify app subscription and a connected store are required.";
  }
}
