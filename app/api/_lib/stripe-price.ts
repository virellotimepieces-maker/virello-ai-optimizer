import {
  assertLivemodeMatchesSecret,
  type StripeMode,
} from "./stripe-mode";

export const VIRELLO_PRICE_UNIT_AMOUNT = 2999;
export const VIRELLO_PRICE_CURRENCY = "usd";
export const VIRELLO_PRICE_INTERVAL = "month";

export class StripePriceError extends Error {
  status = 500;

  constructor(message: string) {
    super(message);
    this.name = "StripePriceError";
  }
}

export type StripePriceLike = {
  id?: string;
  active?: boolean;
  type?: string;
  unit_amount?: number | null;
  currency?: string;
  recurring?: {
    interval?: string;
    interval_count?: number;
  } | null;
  livemode?: boolean;
};

export function assertStripePrice(
  price: StripePriceLike,
  expectedMode?: StripeMode
): void {
  if (!price?.id) {
    throw new StripePriceError("Stripe Price is missing an id.");
  }
  if (price.active !== true) {
    throw new StripePriceError("Stripe Price must be active.");
  }
  if (price.type && price.type !== "recurring") {
    throw new StripePriceError("Stripe Price must be recurring, not one-time.");
  }
  if (!price.recurring) {
    throw new StripePriceError("Stripe Price must be a monthly subscription Price.");
  }
  if (price.recurring.interval !== VIRELLO_PRICE_INTERVAL) {
    throw new StripePriceError("Stripe Price interval must be month.");
  }
  if (
    price.recurring.interval_count != null &&
    price.recurring.interval_count !== 1
  ) {
    throw new StripePriceError("Stripe Price must bill every 1 month.");
  }
  if (price.unit_amount !== VIRELLO_PRICE_UNIT_AMOUNT) {
    throw new StripePriceError("Stripe Price must be $29.99.");
  }
  if ((price.currency || "").toLowerCase() !== VIRELLO_PRICE_CURRENCY) {
    throw new StripePriceError("Stripe Price currency must be USD.");
  }
  if (expectedMode && typeof price.livemode === "boolean") {
    const mode = price.livemode ? "live" : "test";
    if (mode !== expectedMode) {
      throw new StripePriceError(
        `Stripe Price is ${mode} but the secret key is ${expectedMode}.`
      );
    }
  }
}

export function assertConfiguredStripePrice(price: StripePriceLike): void {
  if (typeof price.livemode === "boolean") {
    assertLivemodeMatchesSecret(price.livemode, "Price");
  }
  assertStripePrice(price, undefined);
}

export function assertSubscriptionPriceId(priceId: string | null | undefined): void {
  const configured = process.env.STRIPE_PRICE_ID?.trim() || "";
  if (configured && priceId && priceId !== configured) {
    throw new StripePriceError(
      "Stripe subscription Price ID does not match STRIPE_PRICE_ID."
    );
  }
}
