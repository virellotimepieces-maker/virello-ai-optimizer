import { NextRequest, NextResponse } from "next/server";

/*
 * Compatibility callback route.
 * Redirects legacy /api/auth/callback requests
 * to the canonical Shopify callback endpoint.
 */
export async function GET(
  request: NextRequest
) {
  const forwardUrl = new URL(
    "/api/auth/shopify/callback",
    request.url
  );

  request.nextUrl.searchParams.forEach(
    (value, key) => {
      forwardUrl.searchParams.set(
        key,
        value
      );
    }
  );

  return NextResponse.redirect(
    forwardUrl
  );
}
