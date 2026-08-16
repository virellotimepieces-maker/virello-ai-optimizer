import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_API_VERSION = "2026-07";

function getShopFromToken(token: string): string {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) return "";

    const base64 = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const padded =
      base64 +
      "=".repeat((4 - (base64.length % 4)) % 4);

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

    const shop = getShopFromToken(sessionToken);

    if (!shop || !shop.endsWith(".myshopify.com")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not determine the Shopify store from the session token.",
        },
        { status: 401 }
      );
    }

    const clientId =
      process.env.SHOPIFY_API_KEY ||
      process.env.SHOPIFY_CLIENT_ID ||
      "";

    const clientSecret =
      process.env.SHOPIFY_API_SECRET ||
      process.env.SHOPIFY_CLIENT_SECRET ||
      "";

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Shopify client credentials are not configured on the server.",
        },
        { status: 500 }
      );
    }

    const tokenExchange = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type:
            "urn:ietf:params:oauth:grant-type:token-exchange",
          subject_token: sessionToken,
          subject_token_type:
            "urn:ietf:params:oauth:token-type:id_token",
          requested_token_type:
            "urn:shopify:params:oauth:token-type:online-access-token",
        }).toString(),
        cache: "no-store",
      }
    );

    const tokenData = await tokenExchange.json();

    if (!tokenExchange.ok || !tokenData.access_token) {
      return NextResponse.json(
        {
          success: false,
          error:
            tokenData.error_description ||
            tokenData.error ||
            "Shopify token exchange failed.",
        },
        { status: tokenExchange.status || 401 }
      );
    }

    const query = `
      query Products {
        products(first: 100) {
          nodes {
            id
            title
            descriptionHtml
            productType
            tags
            vendor
            status

            featuredImage {
              url
              altText
            }

            images(first: 6) {
              nodes {
                url
                altText
              }
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
          "X-Shopify-Access-Token":
            tokenData.access_token,
        },
        body: JSON.stringify({ query }),
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok || data.errors) {
      return NextResponse.json(
        {
          success: false,
          error:
            data.errors?.[0]?.message ||
            "Unable to load Shopify products.",
        },
        { status: response.status || 502 }
      );
    }

    const products =
      data.data?.products?.nodes || [];

    return NextResponse.json({
      success: true,
      shop,
      products: products.map((product: any) => ({
        id: product.id,
        title: product.title,
        description:
          product.descriptionHtml || "",
        productType:
          product.productType || "",
        tags: product.tags || [],
        vendor: product.vendor || "",
        status: product.status || "",
        price:
          product.variants?.nodes?.[0]?.price ||
          "",
        images:
          product.images?.nodes || [],
        featuredImage:
          product.featuredImage?.url || null,
      })),
    });
  } catch (error) {
    console.error(
      "Shopify products API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Shopify connection failed.",
      },
      { status: 500 }
    );
  }
}
