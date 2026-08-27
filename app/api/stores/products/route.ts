import { NextRequest, NextResponse } from "next/server";

type Platform =
  | "shopify"
  | "woocommerce"
  | "bigcommerce"
  | "wix";

function getPlatform(request: NextRequest) {
  const value = request.nextUrl.searchParams
    .get("platform")
    ?.trim()
    .toLowerCase();

  return value as Platform | null;
}

function forwardAuthHeaders(request: NextRequest) {
  const headers = new Headers();

  const authorization =
    request.headers.get("authorization");

  const sessionToken = request.headers.get(
    "x-shopify-session-token"
  );

  const shop = request.headers.get("x-shopify-shop");
  const cookie = request.headers.get("cookie");

  if (authorization) {
    headers.set("authorization", authorization);
  }

  if (sessionToken) {
    headers.set("x-shopify-session-token", sessionToken);
  }

  if (shop) {
    headers.set("x-shopify-shop", shop);
  }

  if (cookie) {
    headers.set("cookie", cookie);
  }

  return headers;
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

    if (platform === "shopify") {
      const headers = forwardAuthHeaders(request);
      const baseUrl = request.nextUrl.origin;

      const products: any[] = [];
      let cursor: string | null = null;
      let hasNextPage = true;
      let pages = 0;

      while (hasNextPage && pages < 20) {
        const url = new URL(
          "/api/shopify/products",
          baseUrl
        );

        url.searchParams.set("limit", "250");

        if (cursor) {
          url.searchParams.set("cursor", cursor);
        }

        const response = await fetch(url.toString(), {
          method: "GET",
          headers,
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data?.success) {
          const errorResponse = NextResponse.json(
            {
              success: false,
              platform: "shopify",
              connected: false,
              error:
                data?.error ||
                "Unable to load Shopify products.",
            },
            {
              status: response.status,
              headers: {
                "X-Virello-Platform": "shopify",
              },
            }
          );

          const retry = response.headers.get(
            "X-Shopify-Retry-Invalid-Session-Request"
          );

          if (retry) {
            errorResponse.headers.set(
              "X-Shopify-Retry-Invalid-Session-Request",
              retry
            );
          }

          return errorResponse;
        }

        const pageProducts = Array.isArray(data.products)
          ? data.products
          : [];

        products.push(...pageProducts);

        hasNextPage = Boolean(
          data?.pagination?.hasNextPage
        );

        cursor =
          typeof data?.pagination?.endCursor === "string"
            ? data.pagination.endCursor
            : null;

        pages += 1;
      }

      return NextResponse.json(
        {
          success: true,
          platform: "shopify",
          connected: true,
          products,
          pagination: {
            hasNextPage,
            endCursor: cursor,
            pagesFetched: pages,
          },
        },
        {
          headers: {
            "X-Virello-Platform": "shopify",
          },
        }
      );
    }

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
