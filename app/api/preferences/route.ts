import { NextRequest, NextResponse } from "next/server";
import { OriginGuardError, assertSafeMutation } from "../_lib/origin-guard";
import {
  OUTPUT_LANG_COOKIE,
  UI_LANG_COOKIE,
  parseAppLocale,
  type AppLocale,
} from "../_lib/locales";
import { getShopLocales, saveShopLocales } from "../_lib/shops";
import { shopFromSessionCookie } from "../_lib/app-session";
import { authenticateShopifyRequest } from "../_lib/shopify-auth";
import { assertRateLimit, RateLimitError, tenantRateKey } from "../_lib/rate-limit";

function localeCookie(name: string, value: AppLocale) {
  return {
    name,
    value,
    httpOnly: false,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}

async function currentShop(request: NextRequest): Promise<string> {
  try {
    return (await authenticateShopifyRequest(request, false)).shop;
  } catch {
    return shopFromSessionCookie(request);
  }
}

function applyLocaleCookies(
  response: NextResponse,
  ui: AppLocale,
  output: AppLocale
) {
  const uiCookie = localeCookie(UI_LANG_COOKIE, ui);
  const outputCookie = localeCookie(OUTPUT_LANG_COOKIE, output);
  response.cookies.set(uiCookie.name, uiCookie.value, uiCookie);
  response.cookies.set(outputCookie.name, outputCookie.value, outputCookie);
}

export async function GET(request: NextRequest) {
  const shop = await currentShop(request);
  const stored = shop ? await getShopLocales(shop) : null;
  const ui = parseAppLocale(
    stored?.uiLocale || request.cookies.get(UI_LANG_COOKIE)?.value || "en"
  );
  const output = parseAppLocale(
    stored?.outputLocale || request.cookies.get(OUTPUT_LANG_COOKIE)?.value || "en"
  );
  const response = NextResponse.json({ success: true, ui, output, shop: shop || null });
  applyLocaleCookies(response, ui, output);
  return response;
}

export async function POST(request: NextRequest) {
  try {
    assertSafeMutation(request);
    const shop = await currentShop(request);
    await assertRateLimit(tenantRateKey(request, "prefs", shop), 60);
    const body = await request.json().catch(() => ({}));
    const ui = parseAppLocale(body.ui);
    const output = parseAppLocale(body.output);
    if (shop) await saveShopLocales(shop, ui, output);
    const response = NextResponse.json({ success: true, ui, output, shop: shop || null });
    applyLocaleCookies(response, ui, output);
    return response;
  } catch (error) {
    const status =
      error instanceof OriginGuardError || error instanceof RateLimitError
        ? error.status
        : 500;
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to save language.",
      },
      { status }
    );
  }
}
