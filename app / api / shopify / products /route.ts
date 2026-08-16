import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_API_VERSION = "2026-07";

function normalizeShopDomain(value: string): string {
  return value
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

function getShopFromToken(token: string): string {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return "";
    }

    const base64 = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const padded =
      base64 + "=".repeat((4 - (base64.length % 4)) % 4);

    const payload = JSON.parse(
      Buffer.from(padded, "base64").toString("utf8")
    );

    if (typeof payload.dest !== "string") {
      return "";
    }

    return new URL(payload.dest).hostname;
  } catch {
    return "";
  }
}

async function exchangeSessionToken(
  shop: string,
  sessionToken: string
): Promise<string> {
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error(
      "SHOPIFY_API_KEY or SHOPIFY_API_SECRET is missing"
    );
  }

  const response = await fetch(
    `https://${shop}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        grant_type:
          "urn:ietf:params:oauth:grant-type:token-exchange",
        subject_token: sessionToken,
        subject_token_type:
          "urn:ietf:params:oauth:token-type:id_token",
        requested_token_type:
          "urn:shopify:params:oauth:token-type:online-access-token",
      }),
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Shopify token exchange failed: ${JSON.stringify(data)}`
    );
  }

  const accessToken = data?.access_token;

  if (typeof accessToken !== "string" || !accessToken) {
    throw new Error("Shopify did not return an access token");
  }

  return accessToken;
}

export async function GET(request: NextRequest) {
  try {
    const sessionToken =
      request.headers
        .get("authorization")
        ?.replace(/^Bearer\s+/i, "") ||
      request.headers.get("x-shopify-session-token") ||
      "";

    if (!sessionToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Shopify session token is unavailable.",
        },
        { status: 401 }
      );
    }

    const tokenShop = getShopFromToken(sessionToken);

    const configuredShop = process.env.SHOPIFY_STORE_DOMAIN
      ? normalizeShopDomain(process.env.SHOPIFY_STORE_DOMAIN)
      : "";

    const shop = tokenShop || configuredShop;

    if (!shop) {
      return NextResponse.json(
        {
          success: false,
          error: "Shopify store domain could not be determined.",
        },
        { status: 400 }
      );
    }

    const accessToken = await exchangeSessionToken(
      shop,
      sessionToken
    );

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
      return NextResponse.json(
        {
          success: false,
          error: "Shopify API request failed.",
          details: result,
        },
        { status: response.status }
      );
    }

    if (result?.errors) {
      return NextResponse.json(
        {
          success: false,
          error: "Shopify GraphQL error.",
          details: result.errors,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Shopify products error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch Shopify products.",
      },
      { status: 500 }
    );
  }
}
