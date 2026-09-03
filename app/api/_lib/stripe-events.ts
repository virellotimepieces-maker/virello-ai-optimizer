import { normalizeShop } from "./shop-domain";
import { revokeAppSessionsForShop } from "./shops";
import { productAccessDecision } from "./stripe-access";
import {
  billingForShop,
  saveShopSubscription,
  saveStripeInvoice,
  shopForSubscriptionId,
  upsertStripeCustomer,
  type BillingSnapshot,
} from "./stripe-billing";
import {
  assertLivemodeMatchesSecret,
  billingMatchesConfiguredMode,
} from "./stripe-mode";
import { assertSubscriptionPriceId } from "./stripe-price";

export type StripeEventObject = {
  id?: string;
  object?: string;
  livemode?: boolean;
  created?: number;
  customer?: string | { id?: string };
  subscription?: string | { id?: string };
  status?: string;
  paid?: boolean;
  amount_paid?: number;
  amount_due?: number;
  currency?: string;
  client_reference_id?: string;
  cancel_at_period_end?: boolean;
  canceled_at?: number | null;
  current_period_start?: number;
  current_period_end?: number;
  billing_reason?: string;
  metadata?: { shop?: string };
  lines?: { data?: Array<{ period?: { start?: number; end?: number } }> };
  items?: {
    data?: Array<{
      price?: { id?: string };
      current_period_start?: number;
      current_period_end?: number;
    }>;
  };
  period_start?: number;
  period_end?: number;
};

function customerIdOf(value: StripeEventObject["customer"]): string {
  if (typeof value === "string") return value;
  return value?.id || "";
}

function subscriptionIdOf(value: StripeEventObject["subscription"]): string {
  if (typeof value === "string") return value;
  return value?.id || "";
}

export function normalizeSubscriptionObject(
  data: StripeEventObject,
  eventCreated = 0
): {
  subscriptionId: string;
  customerId: string;
  status: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  priceId: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: number | null;
  livemode: boolean | undefined;
  eventCreated: number;
} {
  const firstItem = Array.isArray(data.items?.data) ? data.items.data[0] : null;
  const periodStart =
    typeof data.current_period_start === "number"
      ? data.current_period_start
      : typeof firstItem?.current_period_start === "number"
        ? firstItem.current_period_start
        : 0;
  const periodEnd =
    typeof data.current_period_end === "number"
      ? data.current_period_end
      : typeof firstItem?.current_period_end === "number"
        ? firstItem.current_period_end
        : 0;
  const customerId = customerIdOf(data.customer);
  const subscriptionId = typeof data.id === "string" ? data.id : "";
  if (!subscriptionId || !customerId || !data.status || !periodStart || !periodEnd) {
    throw new Error("Stripe subscription payload is invalid.");
  }
  return {
    subscriptionId,
    customerId,
    status: data.status,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    priceId: firstItem?.price?.id || null,
    cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
    canceledAt: data.canceled_at ?? null,
    livemode: data.livemode,
    eventCreated,
  };
}

export async function applySubscriptionEvent(input: {
  shop: string;
  object: StripeEventObject;
  eventCreated: number;
  livemode?: boolean;
}): Promise<{ applied: boolean; billing: BillingSnapshot | null }> {
  const shop = normalizeShop(input.shop);
  if (!shop) throw new Error("Stripe subscription is not linked to a Shopify store.");
  if (typeof input.livemode === "boolean") {
    assertLivemodeMatchesSecret(input.livemode, "subscription event");
  }
  const snapshot = normalizeSubscriptionObject(input.object, input.eventCreated);
  if (typeof snapshot.livemode === "boolean") {
    assertLivemodeMatchesSecret(snapshot.livemode, "subscription");
  }
  assertSubscriptionPriceId(snapshot.priceId);
  await upsertStripeCustomer({
    customerId: snapshot.customerId,
    shop,
    livemode:
      typeof snapshot.livemode === "boolean"
        ? snapshot.livemode
        : input.livemode === true,
  });
  const previous = await billingForShop(shop);
  const result = await saveShopSubscription({
    shop,
    customerId: snapshot.customerId,
    subscriptionId: snapshot.subscriptionId,
    status: snapshot.status,
    currentPeriodStart: snapshot.currentPeriodStart,
    currentPeriodEnd: snapshot.currentPeriodEnd,
    priceId: snapshot.priceId,
    cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
    canceledAt: snapshot.canceledAt,
    livemode: snapshot.livemode ?? null,
    eventCreated: input.eventCreated,
  });
  const billing = await billingForShop(shop);
  if (
    result.applied &&
    previous &&
    (previous.status !== snapshot.status ||
      previous.subscriptionId !== snapshot.subscriptionId ||
      previous.customerId !== snapshot.customerId)
  ) {
    await revokeAppSessionsForShop(shop);
  }
  return { applied: result.applied, billing };
}

export async function applyCheckoutCompleted(input: {
  shop: string;
  object: StripeEventObject;
  subscription: StripeEventObject;
  eventCreated: number;
  livemode?: boolean;
}): Promise<{ applied: boolean }> {
  if (typeof input.livemode === "boolean") {
    assertLivemodeMatchesSecret(input.livemode, "checkout session");
  }
  const result = await applySubscriptionEvent({
    shop: input.shop,
    object: input.subscription,
    eventCreated: input.eventCreated,
    livemode: input.livemode,
  });
  return { applied: result.applied };
}

export async function applyInvoiceEvent(input: {
  object: StripeEventObject;
  eventType: "invoice.paid" | "invoice.payment_failed";
  eventCreated: number;
  livemode?: boolean;
}): Promise<{ applied: boolean; shop: string }> {
  const invoice = input.object;
  if (!invoice.id) throw new Error("Stripe invoice event has no id.");
  if (typeof input.livemode === "boolean") {
    assertLivemodeMatchesSecret(input.livemode, "invoice event");
  }
  const subscriptionId = subscriptionIdOf(invoice.subscription);
  const customerId = customerIdOf(invoice.customer);
  let shop = normalizeShop(invoice.metadata?.shop || "");
  if (!shop && subscriptionId) shop = await shopForSubscriptionId(subscriptionId);
  if (!shop) throw new Error("Stripe invoice is not linked to a Shopify store.");

  const paid = input.eventType === "invoice.paid" || invoice.paid === true;
  const invoiceStatus = paid ? "paid" : "failed";
  const linePeriod = invoice.lines?.data?.[0]?.period;

  await saveStripeInvoice({
    invoiceId: invoice.id,
    shop,
    customerId,
    subscriptionId: subscriptionId || null,
    status: invoice.status || invoiceStatus,
    paid,
    amountPaid: invoice.amount_paid,
    amountDue: invoice.amount_due,
    currency: invoice.currency,
    periodStart: invoice.period_start ?? linePeriod?.start ?? null,
    periodEnd: invoice.period_end ?? linePeriod?.end ?? null,
    livemode: invoice.livemode === true,
    created: invoice.created ?? input.eventCreated,
  });

  const billing = await billingForShop(shop);
  if (billing) {
    if (
      billing.lastInvoiceEventCreated &&
      input.eventCreated &&
      input.eventCreated < billing.lastInvoiceEventCreated
    ) {
      return { applied: false, shop };
    }
    await saveShopSubscription({
      shop,
      customerId: billing.customerId,
      subscriptionId: billing.subscriptionId,
      status: billing.status,
      currentPeriodStart: billing.currentPeriodStart,
      currentPeriodEnd: billing.currentPeriodEnd,
      priceId: billing.priceId,
      cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
      canceledAt: billing.canceledAt,
      livemode: billing.livemode,
      eventCreated: billing.stripeEventCreated,
      lastInvoiceId: invoice.id,
      lastInvoiceStatus: invoiceStatus,
      lastInvoiceEventCreated: input.eventCreated,
    });
  } else if (customerId && subscriptionId) {
    await upsertStripeCustomer({
      customerId,
      shop,
      livemode: invoice.livemode === true,
    });
  }

  return { applied: true, shop };
}

export async function applyStripeObjectEvent(input: {
  type: string;
  object: StripeEventObject;
  eventCreated: number;
  livemode: boolean;
}): Promise<{ applied: boolean; shop?: string }> {
  switch (input.type) {
    case "checkout.session.completed": {
      const shop = normalizeShop(
        input.object.client_reference_id || input.object.metadata?.shop || ""
      );
      if (!shop) {
        throw new Error("Stripe checkout is not linked to a Shopify store.");
      }
      const subscription = input.object.subscription;
      if (!subscription || typeof subscription !== "object") {
        throw new Error("Stripe checkout session did not include a subscription object.");
      }
      return applyCheckoutCompleted({
        shop,
        object: input.object,
        subscription: subscription as StripeEventObject,
        eventCreated: input.eventCreated,
        livemode: input.livemode,
      });
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const shop = normalizeShop(input.object.metadata?.shop || "");
      if (!shop) {
        throw new Error("Stripe subscription is not linked to a Shopify store.");
      }
      return applySubscriptionEvent({
        shop,
        object: input.object,
        eventCreated: input.eventCreated,
        livemode: input.livemode,
      });
    }
    case "invoice.paid":
    case "invoice.payment_failed":
      return applyInvoiceEvent({
        object: input.object,
        eventType: input.type,
        eventCreated: input.eventCreated,
        livemode: input.livemode,
      });
    default:
      return { applied: false };
  }
}

export async function accessStateForShop(shop: string, shopInstalled: boolean) {
  const stored = await billingForShop(shop);
  const modeMismatch = Boolean(
    stored && !billingMatchesConfiguredMode(stored.livemode)
  );
  const billing = modeMismatch ? null : stored;
  return {
    billing,
    modeMismatch,
    access: productAccessDecision({
      shopInstalled,
      status: billing?.status ?? null,
      lastInvoiceStatus: billing?.lastInvoiceStatus,
    }),
  };
}
