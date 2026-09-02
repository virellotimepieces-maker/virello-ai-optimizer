export type StripeSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | string;

export const PAID_PRODUCT_STATUSES = ["active", "trialing"] as const;
export const MANAGE_BILLING_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
] as const;

export type ProductAccessDecision = {
  productAccess: boolean;
  canManage: boolean;
  reason:
    | "ok"
    | "not_installed"
    | "no_subscription"
    | "canceled"
    | "past_due"
    | "unpaid"
    | "incomplete"
    | "paused"
    | "invoice_failed"
    | "ineligible"
    | "missing_scopes";
};

export function canManageBilling(
  status: StripeSubscriptionStatus | null | undefined
): boolean {
  return (
    !!status &&
    (MANAGE_BILLING_STATUSES as readonly string[]).includes(status)
  );
}

export function isPaidSubscriptionStatus(
  status: StripeSubscriptionStatus | null | undefined
): boolean {
  return (
    !!status &&
    (PAID_PRODUCT_STATUSES as readonly string[]).includes(status)
  );
}

export function productAccessDecision(input: {
  shopInstalled: boolean;
  status: StripeSubscriptionStatus | null;
  lastInvoiceStatus?: string | null;
}): ProductAccessDecision {
  if (!input.shopInstalled) {
    return {
      productAccess: false,
      canManage: canManageBilling(input.status),
      reason: "not_installed",
    };
  }

  if (!input.status) {
    return {
      productAccess: false,
      canManage: false,
      reason: "no_subscription",
    };
  }

  if (input.status === "canceled" || input.status === "incomplete_expired") {
    return { productAccess: false, canManage: false, reason: "canceled" };
  }
  if (input.status === "past_due") {
    return { productAccess: false, canManage: true, reason: "past_due" };
  }
  if (input.status === "unpaid") {
    return { productAccess: false, canManage: true, reason: "unpaid" };
  }
  if (input.status === "incomplete") {
    return { productAccess: false, canManage: true, reason: "incomplete" };
  }
  if (input.status === "paused") {
    return { productAccess: false, canManage: true, reason: "paused" };
  }
  if (input.lastInvoiceStatus === "failed") {
    return { productAccess: false, canManage: true, reason: "invoice_failed" };
  }
  if (isPaidSubscriptionStatus(input.status)) {
    return { productAccess: true, canManage: true, reason: "ok" };
  }
  return { productAccess: false, canManage: canManageBilling(input.status), reason: "ineligible" };
}

export function productAccessDeniedMessage(reason: ProductAccessDecision["reason"]): string {
  switch (reason) {
    case "not_installed":
      return "Reconnect Shopify before using Virello. Billing was not canceled.";
    case "missing_scopes":
      return "Shopify app is missing product permissions. Reconnect the store.";
    case "past_due":
      return "Subscription payment is past due. Update billing to continue.";
    case "unpaid":
    case "canceled":
    case "incomplete":
    case "paused":
    case "invoice_failed":
    case "no_subscription":
    case "ineligible":
    default:
      return "An active $29.99/month subscription and a connected Shopify store are required.";
  }
}
