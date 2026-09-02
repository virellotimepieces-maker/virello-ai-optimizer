import { NextResponse } from "next/server";
import {
  classifyShopifySecretKind,
  getShopifyClientId,
  getShopifyClientSecrets,
  shopifySecretLooksLikeClientId,
} from "../../../_lib/shopify-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = getShopifyClientId();
  const secrets = getShopifyClientSecrets();
  const primary = secrets[0] || "";
  return NextResponse.json(
    {
      success: true,
      configured: Boolean(clientId && primary),
      clientId: clientId || "",
      secretCount: secrets.length,
      secretKind: primary ? classifyShopifySecretKind(primary, clientId) : "missing",
      secretLength: primary.length,
      looksLikeClientId: secrets.some((secret) =>
        shopifySecretLooksLikeClientId(secret, clientId)
      ),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
