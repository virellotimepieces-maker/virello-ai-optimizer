import {
  getShopifyClientId,
  shopifyCredentialPresence,
  shopifySecretLooksLikeClientId,
  SHOPIFY_PRODUCTION_CLIENT_ID,
} from "./shopify-config";

function present(name: string, minLength = 1): boolean {
  return (process.env[name] || "").trim().length >= minLength;
}

function shopifyBillingTestChargesFromEnv(): boolean {
  const flag = (process.env.SHOPIFY_BILLING_TEST || "").trim().toLowerCase();
  if (flag === "false" || flag === "0") return false;
  return true;
}

export type EnvReadiness = {
  APP_URL: boolean;
  DATABASE_URL: boolean;
  OPENAI_API_KEY: boolean;
  SHOPIFY_API_KEY: boolean;
  SHOPIFY_API_SECRET: boolean;
  SHOPIFY_TOKEN_ENCRYPTION_KEY: boolean;
  shopifyClientIdMatchesListing: boolean;
  shopifySecretLooksLikeClientId: boolean;
  shopifyBillingTestCharges: boolean;
};

export function envReadiness(): EnvReadiness {
  const clientId = getShopifyClientId();
  const presence = shopifyCredentialPresence();
  const secretConfigured = presence.apiSecret || presence.clientSecret;
  return {
    APP_URL: present("APP_URL"),
    DATABASE_URL: present("DATABASE_URL"),
    OPENAI_API_KEY: present("OPENAI_API_KEY"),
    SHOPIFY_API_KEY: Boolean(clientId),
    SHOPIFY_API_SECRET: secretConfigured,
    SHOPIFY_TOKEN_ENCRYPTION_KEY: present("SHOPIFY_TOKEN_ENCRYPTION_KEY", 32),
    shopifyClientIdMatchesListing: clientId === SHOPIFY_PRODUCTION_CLIENT_ID,
    shopifySecretLooksLikeClientId: shopifySecretLooksLikeClientId(
      (process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_CLIENT_SECRET || "").trim(),
      clientId
    ),
    shopifyBillingTestCharges: shopifyBillingTestChargesFromEnv(),
  };
}

export function envIsReady(status: EnvReadiness = envReadiness()): boolean {
  return (
    status.APP_URL &&
    status.DATABASE_URL &&
    status.OPENAI_API_KEY &&
    status.SHOPIFY_API_KEY &&
    status.SHOPIFY_API_SECRET &&
    (status.SHOPIFY_TOKEN_ENCRYPTION_KEY || status.SHOPIFY_API_SECRET) &&
    !status.shopifySecretLooksLikeClientId
  );
}
