import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_API_VERSION = "2026-07";

export async function GET(request: NextRequest) {
  try {
    const sessionToken =
      request.headers.get("authorization")?.replace("Bearer ", "") ||
      request.headers.get("x-shopify-session-token");

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Missing Shopify session token" },
        { status: 401 }
      );
    }

    const shopifyApiKey = process.env.SHOPIFY_API_KEY;
    const shopifyApiSecret = process.env.SHOPIFY_API_SECRET;

    if (!shopifyApiKey || !shopifyApiSecret) {
      return NextResponse.json(
        { error: "Shopify API credentials are not configured" },
        { status: 500 }
      );
    }

    const payload = JSON.parse(
      Buffer.from(sessionToken.split(".")[1], "base64url").toString()
    );

    const destination = payload.dest;

    if (!destination) {
      return NextResponse.json(
        { error: "Shopify shop could not be detected" },
        { status: 400 }
      );
    }
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
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: sessionToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      requested_token_type:
        "urn:shopify:params:oauth:token-type:online-access-token",
    }).toString(),
  }
);

if (!tokenResponse.ok) {
  const errorText = await tokenResponse.text();

  return NextResponse.json(
    {
      error: "Shopify token exchange failed",
      details: errorText,
    },
    { status: 401 }
  );
}

const tokenData = await tokenResponse.json();
    const shop = new URL(destination).hostname;

    
          error: "Shopify token exchange failed",
          details: errorText,
        },
        { status: 401 }
      );
    }

    const tokenData = await tokenResponse.json();

    const query = `
      query {
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
          "X-Shopify-Access-Token": tokenData.access_token,
        },
        body: JSON.stringify({ query }),
      }
    );

    const productsData = await productsResponse.json();

    if (!productsResponse.ok || productsData.errors) {
      return NextResponse.json(
        {
          error: "Shopify products request failed",
          details: productsData.errors || productsData,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      shop,
      products: productsData.data.products.nodes,
    });
  } catch (error) {
    console.error("Shopify products error:", error);

    return NextResponse.json(
      { error: "Unable to connect to Shopify" },
      { status: 500 }
    );
  }
}
