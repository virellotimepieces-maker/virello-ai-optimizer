import { NextRequest, NextResponse } from "next/server";
import { ProductAccessError, requirePaidProductAccess } from "../../_lib/product-access";
import { ShopifyAuthError } from "../../_lib/shopify-auth";

const SHOPIFY_API_VERSION = "2026-07";
const SHOPIFY_MYSHOPIFY_SUFFIX = ".myshopify.com";

function normalizeShop(value: string) {
  const raw = value.trim().toLowerCase();

  if (!raw) {
    return "";
  }

  try {
    const withProtocol = /^https?:\/\//i.test(raw)
      ? raw
      : `https://${raw}`;

    const url = new URL(withProtocol);
    const hostname = url.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    if (
      !hostname.endsWith(SHOPIFY_MYSHOPIFY_SUFFIX) ||
      hostname === SHOPIFY_MYSHOPIFY_SUFFIX
    ) {
      return "";
    }

    return hostname;
  } catch {
    return "";
  }
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      connected: false,
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

export async function GET(request: NextRequest) {
  try {
    const { shop, accessToken } = await requirePaidProductAccess(request);

    const query = `
      query GetProducts {
        products(first: 100) {
          nodes {
            id
            title
            descriptionHtml
            productType
            vendor
            status
            tags
            variants(first: 1) {
              nodes {
                price
              }
            }
          }
        }
      }
    `;

    const response = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query,
        }),
        cache: "no-store",
      }
    );

    const text = await response.text();

    let data: unknown;

    try {
      data = JSON.parse(text);
    } catch {
      return errorResponse(
        `Shopify returned an invalid response (${response.status}).`,
        502
      );
    }

    const result = data as {
      errors?: Array<{
        message?: string;
      }>;
      data?: {
        products?: {
          nodes?: Array<{
            id?: string;
            title?: string;
            descriptionHtml?: string;
            productType?: string;
            vendor?: string;
            status?: string;
            tags?: string[];
            variants?: {
              nodes?: Array<{
                price?: string;
              }>;
            };
          }>;
        };
      };
    };

    if (!response.ok) {
      return errorResponse(
        result.errors?.[0]?.message ||
          `Shopify API request failed (${response.status}).`,
        response.status
      );
    }

    if (result.errors?.length) {
      return errorResponse(
        result.errors
          .map(
            (error) =>
              error.message || "Shopify GraphQL error."
          )
          .join("; "),
        502
      );
    }

    const nodes = result.data?.products?.nodes || [];

    const products = nodes
      .filter(
        (product) =>
          typeof product.id === "string" &&
          product.id.length > 0
      )
      .map((product) => ({
        id: product.id,
        title: product.title || "",
        description:
          product.descriptionHtml || "",
        productType:
          product.productType || "",
        vendor: product.vendor || "",
        price:
          product.variants?.nodes?.[0]?.price || "",
        status:
          product.status || "",
        tags: Array.isArray(product.tags)
          ? product.tags
          : [],
      }));

    return NextResponse.json(
      {
        success: true,
        connected: true,
        platform: "shopify",
        shop,
        count: products.length,
        products,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
          "X-Virello-Platform": "shopify",
        },
      }
    );
  } catch (error) {
    const status =
      error instanceof ProductAccessError || error instanceof ShopifyAuthError
        ? error.status
        : 500;
    if (status >= 500) {
      console.error("SHOPIFY_PRODUCTS_GET_ERROR:", error);
    }

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unable to load Shopify products.",
      status
    );
  }
}
