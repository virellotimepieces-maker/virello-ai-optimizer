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

export async function GET(
  request: NextRequest
) {
  try {
    const storeUrl = normalizeStoreUrl(
      request.cookies.get(
        "virello_woocommerce_store_url"
      )?.value || ""
    );

    const consumerKey =
      request.cookies.get(
        "virello_woocommerce_consumer_key"
      )?.value || "";

    const consumerSecret =
      request.cookies.get(
        "virello_woocommerce_consumer_secret"
      )?.value || "";

    if (
      !storeUrl ||
      !consumerKey ||
      !consumerSecret
    ) {
      return NextResponse.json(
        {
          success: false,
          connected: false,
          platform: "woocommerce",
          error:
            "WooCommerce store is not connected.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    const productsUrl =
      `${storeUrl}/wp-json/wc/v3/products?per_page=1`;

    const credentials = Buffer.from(
      `${consumerKey}:${consumerSecret}`
    ).toString("base64");

    const response = await fetch(
      productsUrl,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
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
      data = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        {
          success: false,
          connected: false,
          platform: "woocommerce",
          error:
            "WooCommerce returned an invalid response.",
        },
        {
          status: 502,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    if (!response.ok) {
      const errorData = data as {
        code?: string;
        message?: string;
      };

      return NextResponse.json(
        {
          success: false,
          connected: false,
          platform: "woocommerce",
          error:
            errorData?.message ||
            `WooCommerce connection could not be verified (${response.status}).`,
        },
        {
          status: response.status,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        connected: true,
        platform: "woocommerce",
        store: storeUrl,
        storeUrl,
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
      "WOOCOMMERCE_STATUS_ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        connected: false,
        platform: "woocommerce",
        error:
          error instanceof Error
            ? error.message
            : "Unable to verify WooCommerce connection.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}