export type StripeMode = "test" | "live";

export class StripeModeError extends Error {
  status = 500;

  constructor(message: string) {
    super(message);
    this.name = "StripeModeError";
  }
}

export function stripeModeFromSecret(secret: string): StripeMode {
  const value = secret.trim();
  if (value.startsWith("sk_test_")) return "test";
  if (value.startsWith("sk_live_")) return "live";
  throw new StripeModeError(
    "STRIPE_SECRET_KEY must be a sk_test_ or sk_live_ key."
  );
}

export function stripeModeFromLivemode(livemode: boolean): StripeMode {
  return livemode ? "live" : "test";
}

export function configuredStripeMode(
  secret = process.env.STRIPE_SECRET_KEY || ""
): StripeMode {
  if (!secret.trim()) {
    throw new StripeModeError("STRIPE_SECRET_KEY is not configured.");
  }
  return stripeModeFromSecret(secret);
}

export function assertStripeMode(
  actual: StripeMode,
  expected: StripeMode,
  label: string
): void {
  if (actual !== expected) {
    throw new StripeModeError(
      `Stripe ${label} is ${actual} but the configured secret is ${expected}.`
    );
  }
}

export function assertLivemodeMatchesSecret(
  livemode: boolean | undefined,
  label: string,
  secret = process.env.STRIPE_SECRET_KEY || ""
): void {
  if (typeof livemode !== "boolean") {
    throw new StripeModeError(`Stripe ${label} did not include a livemode flag.`);
  }
  assertStripeMode(
    stripeModeFromLivemode(livemode),
    configuredStripeMode(secret),
    label
  );
}

export function assertWebhookSecretConfigured(secret: string | undefined): void {
  const value = secret?.trim() || "";
  if (!value || !value.startsWith("whsec_")) {
    throw new StripeModeError("STRIPE_WEBHOOK_SECRET is missing or invalid.");
  }
}

export function isStripeWrongModeObjectError(message: string | undefined): boolean {
  const value = (message || "").toLowerCase();
  return (
    value.includes("similar object exists in test mode") ||
    value.includes("similar object exists in live mode") ||
    value.includes("live mode key was used") ||
    value.includes("test mode key was used")
  );
}

export function billingMatchesConfiguredMode(
  livemode: boolean | null | undefined,
  secret = process.env.STRIPE_SECRET_KEY || ""
): boolean {
  if (typeof livemode !== "boolean") return true;
  try {
    return stripeModeFromLivemode(livemode) === configuredStripeMode(secret);
  } catch {
    return false;
  }
}
