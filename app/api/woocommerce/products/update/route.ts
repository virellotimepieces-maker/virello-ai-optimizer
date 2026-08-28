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

function errorResponse(
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      success: false,
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

export async function PATCH(
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
      return errorResponse(
        "WooCommerce store is not connected.",
        401
      );
    }

    const body = await request
      .json()
      .catch(() => null);

    if (!body || typeof body !== "object") {
      return errorResponse(
        "Invalid request body."
      );
    }

    const productId =
      typeof body.productId === "number" ||
      typeof body.productId === "string"
        ? String(body.productId).trim()
        : "";

    if (!productId) {
      return errorResponse(
        "WooCommerce product ID is required."
      );
    }

    const update: Record<
      string,
      unknown
    > = {};

    if (
      typeof body.name === "string"
    ) {
      update.name =
        body.name.trim();
    }

    if (
      typeof body.description ===
      "string"
    ) {
      update.description =
        body.description;
    }

    if (
      typeof body.shortDescription ===
      "string"
    ) {
      update.short_description =
        body.shortDescription;
    }

    if (
      typeof body.slug === "string"
    ) {
      update.slug =
        body.slug.trim();
    }

    if (
      typeof body.sku === "string"
    ) {
      update.sku =
        body.sku.trim();
    }

    if (
      typeof body.price === "string" ||
      typeof body.price === "number"
    ) {
      update.regular_price =
        String(body.price);
    }

    if (
      typeof body.salePrice ===
        "string" ||
      typeof body.salePrice ===
        "number"
    ) {
      update.sale_price =
        String(body.salePrice);
    }

    if (
      typeof body.status === "string"
    ) {
      const allowedStatuses = [
        "draft",
        "pending",
        "private",
        "publish",
      ];

      if (
        allowedStatuses.includes(
          body.status
        )
      ) {
        update.status =
          body.status;
      }
    }

    if (
      Array.isArray(body.tags)
    ) {
      update.tags = body.tags
        .filter(
          (tag: unknown) =>
            typeof tag ===
            "string"
        )
        .map(
          (tag: string) => ({
            name: tag.trim(),
          })
        )
        .filter(
          (tag: { name: string }) =>
            tag.name.length > 0
        );
    }

    if (
      Array.isArray(body.categories)
    ) {
      update.categories =
        body.categories
          .filter(
            (category: unknown) =>
              typeof category ===
              "object" &&
              category !== null
          )
          .map(
            (
              category: {
                id?: unknown;
              }
            ) => {
              const id =
                Number(
                  category.id
                );

              return Number.isInteger(
                id
              ) && id > 0
                ? { id }
                : null;
            }
          )
          .filter(
            (
              category:
                | { id: number }
                | null
            ): category is {
              id: number;
            } => category !== null
          );
    }

    if (
      Object.keys(update)
        .length === 0
    ) {
      return errorResponse(
        "No product changes were provided."
      );
    }

    const credentials =
      Buffer.from(
        `${consumerKey}:${consumerSecret}`
      ).toString("base64");

    const productUrl =
      `${storeUrl}/wp-json/wc/v3/products/${encodeURIComponent(
        productId
      )}`;

    const response =
      await fetch(
        productUrl,
        {
          method: "PUT",
          headers: {
            Accept:
              "application/json",
            "Content-Type":
              "application/json",
            Authorization:
              `Basic ${credentials}`,
          },
          body: JSON.stringify(
            update
          ),
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
          `WooCommerce product update failed (${response.status}).`,
        response.status
      );
    }

    return NextResponse.json(
      {
        success: true,
        updated: true,
        connected: true,
        platform: "woocommerce",
        storeUrl,
        product: data,
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
      "WOOCOMMERCE_PRODUCT_UPDATE_ERROR:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unable to update WooCommerce product.",
      500
    );
  }
}