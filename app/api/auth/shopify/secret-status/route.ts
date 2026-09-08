import { NextResponse } from "next/server";
import {
  classifyShopifySecretKind,
  getShopifyClientId,
  getShopifyClientSecrets,
  SHOPIFY_PRODUCTION_CLIENT_ID,
  shopifyCredentialPresence,
  shopifySecretLooksLikeClientId,
} from "../../../_lib/shopify-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = getShopifyClientId();
  const secrets = getShopifyClientSecrets();
  const primary = secrets[0] || "";
  const present = shopifyCredentialPresence();
  return NextResponse.json(
    {
      success: true,
      configured: Boolean(clientId && (present.apiSecret || present.clientSecret)),
      clientId: clientId || "",
      listingClientId: SHOPIFY_PRODUCTION_CLIENT_ID,
      matchesListingApp: clientId === SHOPIFY_PRODUCTION_CLIENT_ID,
      secretCount: secrets.length,
      secretKind: primary ? classifyShopifySecretKind(primary, clientId) : "missing",
      secretLength: primary.length,
      looksLikeClientId: secrets.some((secret) =>
        shopifySecretLooksLikeClientId(secret, clientId)
      ),
      apiSecret: present.apiSecret,
      clientSecret: present.clientSecret,
      previous: present.previous,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
