import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_API_VERSION = "2026-07";

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

async function readResponse(response: Response) {
  const text = await response.text();

  try {
    return {
      ok: true,
      data: JSON.parse(text),
      raw: text,
    };
  } catch {
    return {
      ok: false,
      data: null,
      raw: text,
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Shopify App Bridge sends the session token here.
    const authorization = request.headers.get("authorization");

    const sessionToken =
      authorization?.replace(/^Bearer\s+/i, "").trim() ||
      request.headers.get("x-shopify-session-token")?.trim();

    if (!sessionToken) {
      return jsonResponse(
        {
          error: "Missing Shopify session token",
        },
        401
      );
    }

    const shopifyApiKey = process.env.SHOPIFY_API_KEY;
    const shopifyApiSecret = process.env.SHOPIFY_API_SECRET;

    if (!shopifyApiKey || !shopifyApiSecret) {
      console.error("Missing Shopify environment variables");

      return jsonResponse(
        {
          error: "Shopify API credentials are not configured",
        },
        500
      );
    }

    // Decode the JWT payload to determine the Shopify shop.
    const parts = sessionToken.split(".");

    if (parts.length !== 3) {
      return jsonResponse(
        {
          error: "Invalid Shopify session token",
        },
        401
      );
    }

    let payload: {
      dest?: string;
      aud?: string;
      exp?: number;
      nbf?: number;
    };

    try {
      payload = JSON.parse(
        Buffer.from(parts[1], "base64url").toString("utf8")
      );
    } catch {
      return jsonResponse(
        {
          error: "Unable to decode Shopify session token",
        },
        401
      );
    }

    if (!payload.dest) {
      return jsonResponse(
        {
          error: "Shopify shop could not be detected",
        },
        400
      );
    }

    // Shopify's dest is normally:
    // https://your-store.myshopify.com
    // or:
    // your-store.myshopify.com
    let shop: string;

    try {
      const destination = payload.dest.startsWith("http")
        ? payload.dest
        : `https://${payload.dest}`;

      shop = new URL(destination).hostname;
    } catch {
      return jsonResponse(
        {
          error: "Invalid Shopify shop destination",
        },
        400
      );
    }

    if (!shop.endsWith(".myshopify.com")) {
      return jsonResponse(
        {
          error: "Invalid Shopify shop domain",
        },
        400
      );
    }

    /*
     * STEP 1
     * Exchange Shopify session token for Admin API access token.
     */
    const tokenResponse = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          client_id: shopifyApiKey,
          client_secret: shopifyApiSecret,
          grant_type:
            "urn:ietf:params:oauth:grant-type:token-exchange",
          subject_token: sessionToken,
          subject_token_type:
            "urn:ietf:params:oauth:token-type:id_token",
          requested_token_type:
            "urn:shopify:params:oauth:token-type:online-access-token",
        }).toString(),
      }
    );

    const tokenResult = await readResponse(tokenResponse);

    if (!tokenResult.ok) {
      console.error(
        "Shopify token exchange returned non-JSON:",
        tokenResult.raw.substring(0, 500)
      );

      return jsonResponse(
        {
          error: "Shopify token exchange returned an invalid response",
          status: tokenResponse.status,
        },
        502
      );
    }

    if (!tokenResponse.ok) {
      console.error(
        "Shopify token exchange failed:",
        tokenResult.data
      );

      return jsonResponse(
        {
          error: "Shopify token exchange failed",
          details: tokenResult.data,
        },
        401
      );
    }

    const tokenData = tokenResult.data as {
      access_token?: string;
      scope?: string;
      expires_in?: number;
    };

    if (!tokenData.access_token) {
      return jsonResponse(
        {
          error: "Shopify did not return an access token",
          details: tokenData,
        },
        401
      );
    }

    /*
     * STEP 2
     * Get products from Shopify Admin GraphQL API.
     */
    const query = `
      query GetProducts {
        products(first: 50) {
          nodes {
            id
            title
            description
            productType
            tags
            images(first: 6) {
              nodes {
                url
                altText
              }
            }
          }
        }
      }
    `;

    const productsResponse = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Shopify-Access-Token": tokenData.access_token,
        },
        body: JSON.stringify({
          query,
        }),
      }
    );

    const productsResult = await readResponse(productsResponse);

    // This prevents the exact:
    // Unexpected token '<', "<!DOCTYPE..."
    // error from crashing JSON parsing.
    if (!productsResult.ok) {
      console.error(
        "Shopify products returned non-JSON:",
        productsResult.raw.substring(0, 500)
      );

      return jsonResponse(
        {
          error: "Shopify products endpoint returned an invalid response",
          status: productsResponse.status,
        },
        502
      );
    }

    const productsData = productsResult.data as {
      data?: {
        products?: {
          nodes?: unknown[];
        };
      };
      errors?: unknown[];
    };

    if (!productsResponse.ok || productsData.errors) {
      console.error(
        "Shopify products request failed:",
        productsData
      );

      return jsonResponse(
        {
          error: "Shopify products request failed",
          details: productsData.errors || productsData,
        },
        productsResponse.status || 500
      );
    }

    const products =
      productsData.data?.products?.nodes ?? [];

    return jsonResponse({
      shop,
      products,
    });
  } catch (error) {
    console.error("Shopify products route error:", error);

    return jsonResponse(
      {
        error: "Unable to connect to Shopify",
      },
      500
    );
  }
}
