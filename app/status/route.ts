import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_API_VERSION = "2026-07";

function cleanShopDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .replace(
      /(\.myshopify\.com){2,}$/,
      ".myshopify.com"
    );
}

function isValidShopDomain(shop: string): boolean {
  return /^([a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])\.myshopify\.com$/i.test(
    shop
  );
}

export async function GET(request: NextRequest) {
  try {
    const shop = cleanShopDomain(
      request.cookies.get("virello_shopify_shop")?.value || ""
    );

    const accessToken =
      request.cookies.get("virello_shopify_access_token")?.value || "";

    if (!shop || !isValidShopDomain(shop) || !accessToken) {
      return NextResponse.json(
        {
          success: false,
          connected: false,
          platform: "shopify",
          error:
            "Shopify connection is missing. Please connect your store again.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 8000);

    let response: Response;

    try {
      response = await fetch(
        `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/shop.json`,
        {
          method: "GET",
          headers: {
            "X-Shopify-Access-Token": accessToken,
            Accept: "application/json",
          },
          cache: "no-store",
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    const responseText = await response.text();

    let data: unknown = null;

    try {
      data = JSON.parse(responseText);
    } catch {
      data = null;
    }

    if (!response.ok) {
      const errorData = data as
        | {
            errors?: string;
          }
        | null;

      console.error("SHOPIFY_STATUS_HTTP_ERROR:", {
        shop,
        status: response.status,
        errors: errorData?.errors,
      });

      return NextResponse.json(
        {
          success: false,
          connected: false,
          platform: "shopify",
          error:
            typeof errorData?.errors === "string"
              ? `Shopify rejected the saved connection: ${errorData.errors}`
              : `Shopify rejected the saved connection (${response.status}). Please reconnect the store.`,
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        connected: true,
        platform: "shopify",
        shop,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("SHOPIFY_STATUS_ERROR:", error);

    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Shopify connection verification timed out. Please reconnect the store."
        : "Unable to verify Shopify connection. Please reconnect the store.";

    return NextResponse.json(
      {
        success: false,
        connected: false,
        platform: "shopify",
        error: message,
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}