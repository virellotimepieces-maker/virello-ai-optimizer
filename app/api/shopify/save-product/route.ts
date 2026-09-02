import { NextRequest, NextResponse } from "next/server";
import { authenticateShopifyRequest } from "../../_lib/shopify-auth";
import { OriginGuardError, assertSafeMutation } from "../../_lib/origin-guard";

const SHOPIFY_API_VERSION = "2026-07";

function cleanShopDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "")
    .replace(/\/.*$/, "")
    .replace(
      /(\.myshopify\.com){2,}$/,
      ".myshopify.com"
    );
}

function isValidShopDomain(shop: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.myshopify\.com$/i.test(
    shop
  );
}

function jsonError(
  message: string,
  status = 500
) {
  return NextResponse.json(
    {
      success: false,
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

export async function POST(
  request: NextRequest
) {
  try {
    assertSafeMutation(request);
    /*
     * STANDALONE VIRELLO AUTH
     *
     * The Shopify OAuth callback stores:
     *
     * virello_shopify_access_token
     * virello_shopify_shop
     *
     * We use those cookies here.
     *
     * We DO NOT use a Shopify embedded
     * session token and we DO NOT perform
     * token exchange here.
     */

    const { shop, accessToken } = await authenticateShopifyRequest(request);

    /*
     * Read request body.
     */
    let body: {
      productId?: unknown;
      title?: unknown;
      description?: unknown;
      productType?: unknown;
      tags?: unknown;
      seoTitle?: unknown;
      metaDescription?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return jsonError(
        "Invalid request body.",
        400
      );
    }

    const productId =
      typeof body.productId === "string"
        ? body.productId.trim()
        : "";

    if (!productId) {
      return jsonError(
        "Product ID is required.",
        400
      );
    }

    /*
     * Shopify Admin GraphQL expects a
     * Product GID.
     *
     * If Virello receives a numeric Shopify
     * product ID, convert it automatically.
     */
    const shopifyProductId =
      productId.startsWith("gid://shopify/Product/")
        ? productId
        : /^\d+$/.test(productId)
          ? `gid://shopify/Product/${productId}`
          : productId;

    /*
     * Validate the final product ID.
     */
    if (
      !shopifyProductId.startsWith(
        "gid://shopify/Product/"
      )
    ) {
      return jsonError(
        "Invalid Shopify product ID.",
        400
      );
    }

    /*
     * Normalize tags.
     */
    let tagList: string[] = [];

    if (Array.isArray(body.tags)) {
      tagList = body.tags
        .filter(
          (tag): tag is string =>
            typeof tag === "string"
        )
        .map((tag) => tag.trim())
        .filter(Boolean);
    } else if (
      typeof body.tags === "string"
    ) {
      tagList = body.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }

    /*
     * Build ProductInput.
     *
     * Only send fields that actually
     * contain values.
     */
    const input: Record<
      string,
      unknown
    > = {
      id: shopifyProductId,
    };

    if (
      typeof body.title === "string" &&
      body.title.trim()
    ) {
      input.title =
        body.title.trim();
    }

    if (
      typeof body.description ===
        "string" &&
      body.description.trim()
    ) {
      input.descriptionHtml =
        body.description;
    }

    if (
      typeof body.productType ===
        "string" &&
      body.productType.trim()
    ) {
      input.productType =
        body.productType.trim();
    }

    if (tagList.length > 0) {
      input.tags = tagList;
    }

    /*
     * SEO is optional.
     */
    const seoTitle =
      typeof body.seoTitle === "string"
        ? body.seoTitle.trim()
        : "";

    const metaDescription =
      typeof body.metaDescription ===
      "string"
        ? body.metaDescription.trim()
        : "";

    if (
      seoTitle ||
      metaDescription
    ) {
      input.seo = {
        ...(seoTitle
          ? {
              title: seoTitle,
            }
          : {}),
        ...(metaDescription
          ? {
              description:
                metaDescription,
            }
          : {}),
      };
    }

    /*
     * Shopify Admin GraphQL mutation.
     */
    const mutation = `
      mutation UpdateProduct(
        $input: ProductInput!
      ) {
        productUpdate(
          input: $input
        ) {
          product {
            id
            title
            descriptionHtml
            productType
            tags
            seo {
              title
              description
            }
          }

          userErrors {
            field
            message
          }
        }
      }
    `;

    /*
     * Call Shopify Admin API using the
     * access token obtained during the
     * standalone OAuth connection.
     */
    const controller =
      new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      15000
    );

    let shopifyResponse: Response;

    try {
      shopifyResponse =
        await fetch(
          `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
              "X-Shopify-Access-Token":
                accessToken,
            },
            body: JSON.stringify({
              query: mutation,
              variables: {
                input,
              },
            }),
            cache: "no-store",
            signal: controller.signal,
          }
        );
    } finally {
      clearTimeout(timeout);
    }

    const responseText =
      await shopifyResponse.text();

    let data: any = null;

    try {
      data =
        JSON.parse(responseText);
    } catch {
      console.error(
        "SHOPIFY_SAVE_NON_JSON_RESPONSE",
        {
          shop,
          status:
            shopifyResponse.status,
          responseText,
        }
      );

      return jsonError(
        `Shopify returned an invalid response (${shopifyResponse.status}).`,
        502
      );
    }

    /*
     * HTTP-level error.
     */
    if (!shopifyResponse.ok) {
      console.error(
        "SHOPIFY_SAVE_HTTP_ERROR",
        {
          shop,
          status:
            shopifyResponse.status,
          errors: data?.errors,
        }
      );

      const message =
        data?.errors
          ?.map(
            (error: any) =>
              error?.message
          )
          .filter(Boolean)
          .join("; ") ||
        `Shopify API request failed (${shopifyResponse.status}).`;

      return jsonError(
        message,
        502
      );
    }

    /*
     * GraphQL-level errors.
     */
    if (
      Array.isArray(data?.errors) &&
      data.errors.length > 0
    ) {
      const message =
        data.errors
          .map(
            (error: any) =>
              error?.message
          )
          .filter(Boolean)
          .join("; ") ||
        "Shopify GraphQL request failed.";

      console.error(
        "SHOPIFY_SAVE_GRAPHQL_ERROR",
        {
          shop,
          errors: data.errors,
        }
      );

      return jsonError(
        message,
        502
      );
    }

    const result =
      data?.data?.productUpdate;

    if (!result) {
      console.error(
        "SHOPIFY_SAVE_NO_RESULT",
        {
          shop,
          data,
        }
      );

      return jsonError(
        "Shopify did not return a product update result.",
        502
      );
    }

    /*
     * Shopify validation / permission errors.
     */
    if (
      Array.isArray(
        result.userErrors
      ) &&
      result.userErrors.length > 0
    ) {
      const message =
        result.userErrors
          .map(
            (error: any) => {
              const field =
                Array.isArray(
                  error?.field
                )
                  ? error.field.join(".")
                  : "";

              return field
                ? `${field}: ${error.message}`
                : error.message;
            }
          )
          .filter(Boolean)
          .join("; ") ||
        "Shopify could not update the product.";

      console.error(
        "SHOPIFY_SAVE_USER_ERROR",
        {
          shop,
          productId:
            shopifyProductId,
          userErrors:
            result.userErrors,
        }
      );

      return jsonError(
        message,
        400
      );
    }

    /*
     * Confirm Shopify actually returned
     * the updated product.
     */
    if (!result.product) {
      return jsonError(
        "Shopify did not return the updated product.",
        502
      );
    }

    console.log(
      "SHOPIFY_PRODUCT_SAVED",
      {
        shop,
        productId:
          shopifyProductId,
      }
    );

    return NextResponse.json(
      {
        success: true,
        message:
          "Product saved to Shopify successfully.",
        shop,
        product:
          result.product,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    if (error instanceof OriginGuardError) {
      return jsonError(error.message, error.status);
    }

    console.error(
      "SHOPIFY_SAVE_PRODUCT_ERROR:",
      error
    );

    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      return jsonError(
        "Shopify save request timed out. Please try again.",
        504
      );
    }

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to save product to Shopify.",
      500
    );
  }
}
