import { NextResponse } from "next/server";
import {
  getShopifyClientId,
  getShopifyClientSecrets,
  shopifyCredentialPresence,
  shopifySecretLooksLikeClientId,
  SHOPIFY_PRODUCTION_CLIENT_ID,
} from "../../../_lib/shopify-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = getShopifyClientId();
  const present = shopifyCredentialPresence();
  const secrets = getShopifyClientSecrets();
  const configured = Boolean(clientId && (present.apiSecret || present.clientSecret));
  return NextResponse.json(
    {
      success: true,
      configured,
      matchesListingApp: clientId === SHOPIFY_PRODUCTION_CLIENT_ID,
      looksLikeClientId: secrets.some((secret) =>
        shopifySecretLooksLikeClientId(secret, clientId)
      ),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
