import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_API_VERSION = "2026-07";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function getShopDomain(): string {
  const raw = process.env.SHOPIFY_STORE_DOMAIN?.trim();

  if (!raw) return "";

  return raw
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

async function getShopifyAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const shop = getShopDomain();
  const clientId = process.env.SHOPIFY_API_KEY;
  const clientSecret = process.env.SHOPIFY_API_SECRET;

  if (!shop || !clientId || !clientSecret) {
    throw new Error(
      "Missing Shopify credentials in Vercel Environment Variables."
    );
  }

  const response = await fetch(
    `https://${shop}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      cache: "no-store",
    }
  );

  const result = await response.json();

  if (!response.ok || !result.access_token) {
    throw new Error(
      result.error_description ||
        result.error ||
        `Shopify token request failed (${response.status})`
    );
  }

  cachedToken = result.access_token;

  tokenExpiresAt =
    Date.now() + Number(result.expires_in || 86399) * 1000;

  return result.access_token;
}

export async function GET(_request: NextRequest) {
  const shop = getShopDomain();

  if (!shop) {
    return jsonResponse(
      {
        success: false,
        error: "Shopify store domain is not configured.",
      },
      500
    );
  }

  try {
    const accessToken = await getShopifyAccessToken();

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
            createdAt
            updatedAt

            featuredImage {
              url
              altText
            }

            variants(first: 10) {
              nodes {
                id
                title
                price
                compareAtPrice
                sku
                inventoryQuantity
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
        body: JSON.stringify({ query }),
        cache: "no-store",
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return jsonResponse(
        {
          success: false,
          error: "Shopify API request failed.",
          details: result,
        },
        response.status
      );
    }

    if (result.errors) {
      return jsonResponse(
        {
          success: false,
          error: "Shopify GraphQL error.",
          details: result.errors,
        },
        500
      );
    }

    return jsonResponse({
      success: true,
      data: result.data,
    });
  } catch (error: any) {
    return jsonResponse(
      {
        success: false,
        error:
          error?.message ||
          "Failed to connect to Shopify.",
      },
      500
    );
  }
}
