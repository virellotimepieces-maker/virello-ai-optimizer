import { NextRequest, NextResponse } from "next/server";

const WOOCOMMERCE_API_VERSION = "wc/v3";

function errorResponse(
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      success: false,
      connected: false,
      platform: "woocommerce",
      error: message,
    },
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
      },
    }
  );
}

function normalizeStoreUrl(
  value: string
): string {
  const raw = value.trim();

  if (!raw) {
    return "";
  }

  try {
    const withProtocol =
      /^https?:\/\//i.test(raw)
        ? raw
        : `https://${raw}`;

    const url = new URL(withProtocol);

    return url.origin.replace(
      /\/+$/,
      ""
    );
  } catch {
    return "";
  }
}

export async function GET(
  request: NextRequest
) {
  try {
    const storeUrlCookie =
      request.cookies.get(
        "virello_woocommerce_store_url"
      )?.value || "";

    const consumerKey =
      request.cookies.get(
        "virello_woocommerce_consumer_key"
      )?.value || "";

    const consumerSecret =
      request.cookies.get(
        "virello_woocommerce_consumer_secret"
      )?.value || "";

    const storeUrl =
      normalizeStoreUrl(
        storeUrlCookie
      );

    if (!storeUrl) {
      return errorResponse(
        "WooCommerce store is not connected.",
        401
      );
    }

    if (!consumerKey) {
      return errorResponse(
        "WooCommerce Consumer Key is missing.",
        401
      );
    }

    if (!consumerSecret) {
      return errorResponse(
        "WooCommerce Consumer Secret is missing.",
        401
      );
    }

    const searchParams =
      request.nextUrl.searchParams;

    const pageParam =
      searchParams.get("page");

    const perPageParam =
      searchParams.get("per_page");

    const search =
      searchParams.get("search");

    const page =
      pageParam &&
      /^\d+$/.test(pageParam)
        ? Math.max(
            1,
            Number(pageParam)
          )
        : 1;

    const perPage =
      perPageParam &&
      /^\d+$/.test(perPageParam)
        ? Math.min(
            100,
            Math.max(
              1,
              Number(perPageParam)
            )
          )
        : 20;

    const productsUrl =
      new URL(
        `${storeUrl}/wp-json/${WOOCOMMERCE_API_VERSION}/products`
      );

    productsUrl.searchParams.set(
      "page",
      String(page)
    );

    productsUrl.searchParams.set(
      "per_page",
      String(perPage)
    );

    if (search?.trim()) {
      productsUrl.searchParams.set(
        "search",
        search.trim()
      );
    }

    const credentials =
      Buffer.from(
        `${consumerKey}:${consumerSecret}`
      ).toString("base64");

    const response = await fetch(
      productsUrl.toString(),
      {
        method: "GET",
        headers: {
          Accept:
            "application/json",
          Authorization:
            `Basic ${credentials}`,
        },
        cache: "no-store",
      }
    );

    const responseText =
      await response.text();

    let data: unknown = null;

    try {
      data =
        JSON.parse(
          responseText
        );
    } catch {
      return errorResponse(
        `WooCommerce returned an invalid response (${response.status}).`,
        502
      );
    }

    if (!response.ok) {
      const errorData =
        data as {
          code?: string;
          message?: string;
        };

      return errorResponse(
        errorData?.message ||
          `Unable to retrieve WooCommerce products (${response.status}).`,
        response.status
      );
    }

    const products =
      Array.isArray(data)
        ? data
        : [];

    const total =
      Number(
        response.headers.get(
          "X-WP-Total"
        ) || products.length
      );

    const totalPages =
      Number(
        response.headers.get(
          "X-WP-TotalPages"
        ) || 1
      );

    return NextResponse.json(
      {
        success: true,
        connected: true,
        platform: "woocommerce",
        storeUrl,
        products,
        pagination: {
          page,
          perPage,
          total,
          totalPages,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
          "X-Virello-Platform":
            "woocommerce",
        },
      }
    );
  } catch (error) {
    console.error(
      "WOOCOMMERCE_PRODUCTS_ERROR:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unable to retrieve WooCommerce products.",
      500
    );
  }
}