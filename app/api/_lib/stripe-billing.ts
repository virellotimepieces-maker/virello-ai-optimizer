import { dbQuery } from "./database";
import { normalizeShop } from "./shop-domain";
import { upsertShop } from "./shops";
import type { StripeSubscriptionStatus } from "./stripe-access";

export type BillingSnapshot = {
  shop: string;
  customerId: string;
  subscriptionId: string;
  status: StripeSubscriptionStatus;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  priceId: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: number | null;
  livemode: boolean | null;
  lastInvoiceId: string | null;
  lastInvoiceStatus: string | null;
  lastInvoiceEventCreated: number;
  stripeEventCreated: number;
};

export type InvoiceSnapshot = {
  invoiceId: string;
  customerId: string;
  subscriptionId: string | null;
  shop?: string | null;
  status: string;
  paid: boolean;
  amountPaid?: number | null;
  amountDue?: number | null;
  currency?: string | null;
  periodStart?: number | null;
  periodEnd?: number | null;
  livemode: boolean;
  created?: number | null;
};

export async function upsertStripeCustomer(input: {
  customerId: string;
  shop: string;
  livemode: boolean;
  email?: string | null;
}): Promise<void> {
  const shop = await upsertShop(input.shop, { markInstalled: false });
  await dbQuery(
    `INSERT INTO stripe_customers (
       stripe_customer_id, shop, livemode, email, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (stripe_customer_id) DO UPDATE SET
       shop = EXCLUDED.shop,
       livemode = EXCLUDED.livemode,
       email = COALESCE(EXCLUDED.email, stripe_customers.email),
       updated_at = NOW()`,
    [input.customerId, shop, input.livemode, input.email ?? null]
  );
}

export async function saveShopSubscription(input: {
  shop: string;
  customerId: string;
  subscriptionId: string;
  status: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  priceId?: string | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: number | null;
  livemode?: boolean | null;
  eventCreated?: number;
  lastInvoiceId?: string | null;
  lastInvoiceStatus?: string | null;
  lastInvoiceEventCreated?: number;
}): Promise<{ applied: boolean }> {
  const shop = await upsertShop(input.shop, { markInstalled: false });
  const eventCreated = input.eventCreated ?? 0;
  const existing = await dbQuery<{ stripe_event_created: number | string }>(
    `SELECT stripe_event_created
     FROM shop_subscriptions
     WHERE shop = $1
     LIMIT 1`,
    [shop]
  );
  const storedCreated = Number(existing[0]?.stripe_event_created ?? 0);
  if (eventCreated && storedCreated && eventCreated < storedCreated) {
    return { applied: false };
  }

  await dbQuery(
    `INSERT INTO shop_subscriptions (
       shop, stripe_customer_id, stripe_subscription_id, status,
       current_period_start, current_period_end, price_id,
       cancel_at_period_end, canceled_at, livemode, last_invoice_id,
       last_invoice_status, last_invoice_event_created, stripe_event_created,
       updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()
     )
     ON CONFLICT (shop) DO UPDATE SET
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       stripe_subscription_id = EXCLUDED.stripe_subscription_id,
       status = EXCLUDED.status,
       current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       price_id = COALESCE(EXCLUDED.price_id, shop_subscriptions.price_id),
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       canceled_at = EXCLUDED.canceled_at,
       livemode = COALESCE(EXCLUDED.livemode, shop_subscriptions.livemode),
       last_invoice_id = COALESCE(EXCLUDED.last_invoice_id, shop_subscriptions.last_invoice_id),
       last_invoice_status = COALESCE(EXCLUDED.last_invoice_status, shop_subscriptions.last_invoice_status),
       last_invoice_event_created = GREATEST(
         EXCLUDED.last_invoice_event_created,
         shop_subscriptions.last_invoice_event_created
       ),
       stripe_event_created = GREATEST(
         EXCLUDED.stripe_event_created,
         shop_subscriptions.stripe_event_created
       ),
       updated_at = NOW()`,
    [
      shop,
      input.customerId,
      input.subscriptionId,
      input.status,
      input.currentPeriodStart,
      input.currentPeriodEnd,
      input.priceId ?? null,
      input.cancelAtPeriodEnd ?? false,
      input.canceledAt ?? null,
      input.livemode ?? null,
      input.lastInvoiceId ?? null,
      input.lastInvoiceStatus ?? null,
      input.lastInvoiceEventCreated ?? 0,
      eventCreated,
    ]
  );
  return { applied: true };
}

export async function billingForShop(shop: string): Promise<BillingSnapshot | null> {
  const normalized = normalizeShop(shop);
  if (!normalized) return null;
  const rows = await dbQuery<{
    shop: string;
    stripe_customer_id: string;
    stripe_subscription_id: string;
    status: string;
    current_period_start: number | string;
    current_period_end: number | string;
    price_id: string | null;
    cancel_at_period_end: boolean;
    canceled_at: number | string | null;
    livemode: boolean | null;
    last_invoice_id: string | null;
    last_invoice_status: string | null;
    last_invoice_event_created: number | string;
    stripe_event_created: number | string;
  }>(
    `SELECT shop, stripe_customer_id, stripe_subscription_id, status,
            current_period_start, current_period_end, price_id,
            cancel_at_period_end, canceled_at, livemode, last_invoice_id,
            last_invoice_status, last_invoice_event_created, stripe_event_created
     FROM shop_subscriptions
     WHERE shop = $1
     LIMIT 1`,
    [normalized]
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    shop: String(row.shop),
    customerId: String(row.stripe_customer_id),
    subscriptionId: String(row.stripe_subscription_id),
    status: String(row.status),
    currentPeriodStart: Number(row.current_period_start),
    currentPeriodEnd: Number(row.current_period_end),
    priceId: row.price_id,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    canceledAt: row.canceled_at == null ? null : Number(row.canceled_at),
    livemode: row.livemode,
    lastInvoiceId: row.last_invoice_id,
    lastInvoiceStatus: row.last_invoice_status,
    lastInvoiceEventCreated: Number(row.last_invoice_event_created ?? 0),
    stripeEventCreated: Number(row.stripe_event_created ?? 0),
  };
}

export async function shopForSubscriptionId(
  subscriptionId: string
): Promise<string> {
  const rows = await dbQuery<{ shop: string }>(
    `SELECT shop FROM shop_subscriptions WHERE stripe_subscription_id = $1 LIMIT 1`,
    [subscriptionId]
  );
  return normalizeShop(String(rows[0]?.shop || ""));
}

export async function saveStripeInvoice(invoice: InvoiceSnapshot): Promise<void> {
  const shop = invoice.shop ? await upsertShop(invoice.shop, { markInstalled: false }) : null;
  await dbQuery(
    `INSERT INTO stripe_invoices (
       stripe_invoice_id, shop, stripe_customer_id, stripe_subscription_id,
       status, paid, amount_paid, amount_due, currency, period_start, period_end,
       livemode, stripe_created, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
     )
     ON CONFLICT (stripe_invoice_id) DO UPDATE SET
       shop = COALESCE(EXCLUDED.shop, stripe_invoices.shop),
       status = EXCLUDED.status,
       paid = EXCLUDED.paid,
       amount_paid = EXCLUDED.amount_paid,
       amount_due = EXCLUDED.amount_due,
       currency = EXCLUDED.currency,
       period_start = EXCLUDED.period_start,
       period_end = EXCLUDED.period_end,
       stripe_subscription_id = COALESCE(
         EXCLUDED.stripe_subscription_id,
         stripe_invoices.stripe_subscription_id
       ),
       livemode = EXCLUDED.livemode,
       stripe_created = EXCLUDED.stripe_created,
       updated_at = NOW()`,
    [
      invoice.invoiceId,
      shop,
      invoice.customerId,
      invoice.subscriptionId,
      invoice.status,
      invoice.paid,
      invoice.amountPaid ?? null,
      invoice.amountDue ?? null,
      invoice.currency ?? null,
      invoice.periodStart ?? null,
      invoice.periodEnd ?? null,
      invoice.livemode,
      invoice.created ?? null,
    ]
  );
}
