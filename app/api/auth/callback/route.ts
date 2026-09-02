import { NextRequest, NextResponse } from "next/server";

/*
 * Compatibility callback route.
 * Redirects legacy /api/auth/callback requests
 * to the canonical Shopify callback endpoint.
 */
export async function GET(request: NextRequest) {
  const forwardUrl = new URL("/api/auth/shopify/callback", request.url);
  // Keep Shopify's raw query encoding so HMAC can be verified on the
  // canonical route against the exact callback string Shopify signed.
  forwardUrl.search = new URL(request.url).search;
  return NextResponse.redirect(forwardUrl);
}
