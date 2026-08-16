import { NextResponse } from "next/server";

const SHOPIFY_API_VERSION = "2026-07";

type JsonRecord = Record<string, unknown>;

function jsonResponse(data: JsonRecord, status = 200) {
  return NextResponse.json(data, { status });
}

function getShopDomain(): string {
  return (process.env.SHOPIFY_STORE_DOMAIN || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

async function getShopifyAccessToken(shop: string): Promise<string> {
  const clientId = process.env.SHOPIFY_API_KEY?.trim();
  const clientSecret = process.env.SHOPIFY_API_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing SHOPIFY_API_KEY or SHOPIFY_API_SECRET in Vercel Environment Variables."
    );
  }

  const response = await fetch(
    `https://${shop}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      cache: "no-store",
    }
  );

  const text = await response.text();

  let data: JsonRecord = {};

  try {
    const parsed = JSON.parse(text);

    if (parsed && typeof parsed === "object") {
      data = parsed as JsonRecord;
    }
  } catch {
    throw new Error(
      `Shopify token endpoint returned non-JSON data (HTTP ${response.status}).`
    );
  }

  if (!response.ok) {
    const detail =
      typeof data.error_description === "string"
        ? data.error_description
        : typeof data.error === "string"
          ? data.error
          : `HTTP ${response.status}`;

    throw new Error(`Shopify authentication failed: ${detail}`);
  }

  const accessToken = data.access_token;

  if (typeof accessToken !== "string" || !accessToken) {
    throw new Error("Shopify did not return an access token.");
  }

  return accessToken;
}

export async function GET() {
  try {
    const shop = getShopDomain();

    if (!shop || !shop.endsWith(".myshopify.com")) {
      return jsonResponse(
        {
          success: false,
          error:
            "Invalid SHOPIFY_STORE_DOMAIN. Use your-store.myshopify.com.",
        },
        500
      );
    }

    // No Shopify browser/session token is required here.
    // Authentication is handled server-to-server.
    const accessToken = await getShopifyAccessToken(shop);

    const query = `
      query GetProducts {
        products(first: 50) {
          nodes {
            id
            title
            handle
            descriptionHtml
            vendor
            productType
            status
            tags

            featuredImage {
              url
              altText
            }

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
          Accept: "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query }),
        cache: "no-store",
      }
    );

    const text = await response.text();

    let result: JsonRecord = {};

    try {
      const parsed = JSON.parse(text);

      if (parsed && typeof parsed === "object") {
        result = parsed as JsonRecord;
      }
    } catch {
      throw new Error(
        `Shopify Admin API returned non-JSON data (HTTP ${response.status}).`
      );
    }

    if (!response.ok) {
      return jsonResponse(
        {
          success: false,
          error: "Shopify Admin API request failed.",
          details: result,
        },
        response.status
      );
    }

    if (Array.isArray(result.errors) && result.errors.length > 0) {
      return jsonResponse(
        {
          success: false,
          error: "Shopify GraphQL error.",
          details: result.errors,
        },
        500
      );
    }

    const data = result.data as JsonRecord | undefined;
    const productsConnection = data?.products as JsonRecord | undefined;

    const nodes = Array.isArray(productsConnection?.nodes)
      ? productsConnection.nodes
      : [];

    const products = nodes.map((node) => {
      const item = (node || {}) as JsonRecord;

      const variants = item.variants as JsonRecord | undefined;

      const variantNodes = Array.isArray(variants?.nodes)
        ? variants.nodes
        : [];

      const firstVariant = (variantNodes[0] || {}) as JsonRecord;

      const featuredImage = item.featuredImage as
        | JsonRecord
        | null
        | undefined;

      return {
        id:
          typeof item.id === "string"
            ? item.id
            : "",

        title:
          typeof item.title === "string"
            ? item.title
            : "",

        handle:
          typeof item.handle === "string"
            ? item.handle
            : "",

        description:
          typeof item.descriptionHtml === "string"
            ? item.descriptionHtml
            : "",

        productType:
          typeof item.productType === "string"
            ? item.productType
            : "",

        tags:
          Array.isArray(item.tags)
            ? item.tags.filter(
                (tag): tag is string =>
                  typeof tag === "string"
              )
            : [],

        status:
          typeof item.status === "string"
            ? item.status
            : "",

        vendor:
          typeof item.vendor === "string"
            ? item.vendor
            : "",

        price:
          typeof firstVariant.price === "string"
            ? firstVariant.price
            : "",

        images:
          featuredImage &&
          typeof featuredImage.url === "string"
            ? [
                {
                  url: featuredImage.url,
                  altText:
                    typeof featuredImage.altText === "string"
                      ? featuredImage.altText
                      : null,
                },
              ]
            : [],

        featuredImage:
          featuredImage &&
          typeof featuredImage.url === "string"
            ? featuredImage.url
            : null,
      };
    });

    return jsonResponse({
      success: true,
      products,
    });
  } catch (error) {
    console.error(
      "Shopify products error:",
      error
    );

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch Shopify products.",
      },
      500
    );
  }
}
