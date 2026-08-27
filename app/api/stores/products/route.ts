import { NextRequest, NextResponse } from "next/server";

type Platform =
  | "shopify"
  | "woocommerce"
  | "bigcommerce"
  | "wix";

function getPlatform(request: NextRequest) {
  const value =
    request.nextUrl.searchParams
      .get("platform")
      ?.trim()
      .toLowerCase();

  return value as Platform | null;
}

export async function GET(request: NextRequest) {
  try {
    const platform = getPlatform(request);

    if (!platform) {
      return NextResponse.json(
        {
          success: false,
          error: "Ecommerce platform is required.",
          supportedPlatforms: [
            "shopify",
            "woocommerce",
            "bigcommerce",
            "wix",
          ],
        },
        { status: 400 }
      );
    }

    if (
      ![
        "shopify",
        "woocommerce",
        "bigcommerce",
        "wix",
      ].includes(platform)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported ecommerce platform: ${platform}`,
        },
        { status: 400 }
      );
    }

    /*
     * IMPORTANT:
     *
     * The existing Shopify product API is NOT changed.
     * This universal endpoint only provides the platform
     * layer that we will expand with additional connectors.
     */

    if (platform === "shopify") {
      const cookieAccessToken =
        request.cookies.get(
          "virello_shopify_access_token"
        )?.value || "";

      const cookieShop =
        request.cookies.get(
          "virello_shopify_shop"
        )?.value || "";

      if (!cookieAccessToken || !cookieShop) {
        return NextResponse.json(
          {
            success: false,
            platform: "shopify",
            connected: false,
            error:
              "Shopify connection is missing. Please connect your Shopify store again.",
          },
          { status: 401 }
        );
      }

      const origin =
        request.headers.get("origin") ||
        new URL(request.url).origin;

      const response = await fetch(
        `${origin}/api/shopify/products`,
        {
          method: "GET",
          headers: {
            cookie: request.headers.get("cookie") || "",
          },
          cache: "no-store",
        }
      );

      const data = await response.json();

      return NextResponse.json(
        {
          ...data,
          platform: "shopify",
        },
        {
          status: response.status,
          headers: {
            "X-Virello-Platform": "shopify",
          },
        }
      );
    }

    /*
     * These connectors are intentionally not connected yet.
     *
     * We will add their real authentication and product
     * APIs one platform at a time without modifying the
     * existing Shopify implementation.
     */

    return NextResponse.json(
      {
        success: false,
        platform,
        connected: false,
        error:
          `${platform} connector is not connected yet.`,
      },
      { status: 501 }
    );
  } catch (error) {
    console.error(
      "UNIVERSAL_PRODUCTS_ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load ecommerce products.",
      },
      { status: 500 }
    );
  }
}
