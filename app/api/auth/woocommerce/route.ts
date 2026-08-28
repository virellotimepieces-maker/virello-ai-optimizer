import { NextRequest, NextResponse } from "next/server";

function normalizeStoreUrl(value: string): string {
  const raw = value.trim();

  if (!raw) {
    return "";
  }

  try {
    const withProtocol = /^https?:\/\//i.test(raw)
      ? raw
      : `https://${raw}`;

    const url = new URL(withProtocol);

    return url.origin.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function errorResponse(message: string, status = 400) {
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
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    const storeUrl = normalizeStoreUrl(
      typeof body?.storeUrl === "string"
        ? body.storeUrl
        : ""
    );

    const consumerKey =
      typeof body?.consumerKey === "string"
        ? body.consumerKey.trim()
        : "";

    const consumerSecret =
      typeof body?.consumerSecret === "string"
        ? body.consumerSecret.trim()
        : "";

    if (!storeUrl) {
      return errorResponse(
        "Enter a valid WooCommerce store URL."
      );
    }

    if (!consumerKey) {
      return errorResponse(
        "WooCommerce Consumer Key is required."
      );
    }

    if (!consumerSecret) {
      return errorResponse(
        "WooCommerce Consumer Secret is required."
      );
    }

    const productsUrl =
      `${storeUrl}/wp-json/wc/v3/products?per_page=1`;

    const credentials = Buffer.from(
      `${consumerKey}:${consumerSecret}`
    ).toString("base64");

    const response = await fetch(productsUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${credentials}`,
      },
      cache: "no-store",
    });

    const responseText = await response.text();

    let data: unknown = null;

    try {
      data = JSON.parse(responseText);
    } catch {
      return errorResponse(
        `WooCommerce returned an invalid response (${response.status}).`,
        502
      );
    }

    if (!response.ok) {
      const errorData = data as {
        code?: string;
        message?: string;
      };

      return errorResponse(
        errorData?.message ||
          `WooCommerce connection failed (${response.status}).`,
        response.status
      );
    }

    const result = NextResponse.json(
      {
        success: true,
        connected: true,
        platform: "woocommerce",
        storeUrl,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
          "X-Virello-Platform": "woocommerce",
        },
      }
    );

    /*
     * WooCommerce credentials are store-specific.
     * They are kept in HTTP-only cookies and are
     * completely separate from Shopify cookies.
     */

    result.cookies.set(
      "virello_woocommerce_store_url",
      storeUrl,
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      }
    );

    result.cookies.set(
      "virello_woocommerce_consumer_key",
      consumerKey,
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      }
    );

    result.cookies.set(
      "virello_woocommerce_consumer_secret",
      consumerSecret,
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      }
    );

    return result;
  } catch (error) {
    console.error(
      "WOOCOMMERCE_CONNECTION_ERROR:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unable to connect WooCommerce store.",
      500
    );
  }
}