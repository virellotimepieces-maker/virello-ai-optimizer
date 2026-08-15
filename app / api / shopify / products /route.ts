import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_API_VERSION = "2026-07";

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function getSessionToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/i);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  const token =
    request.headers.get("x-shopify-session-token")?.trim();

  return token || "";
}

function getShopFromToken(token: string) {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return "";
    }

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

    const destination = payload.dest.startsWith("http")
      ? payload.dest
      : `https://${payload.dest}`;

    const hostname = new URL(destination).hostname;

    if (!hostname.endsWith(".myshopify.com")) {
      return "";
    }

    return hostname;
  } catch {
    return "";
  }
}

async function exchangeSessionToken(
  shop: string,
  sessionToken: string
) {
  const clientId =
    process.env.SHOPIFY_API_KEY ||
    process.env.SHOPIFY_CLIENT_ID;

  const clientSecret =
    process.env.SHOPIFY_API_SECRET ||
    process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Shopify API credentials are missing."
    );
  }

  const body = new URLSearchParams();

  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set(
    "grant_type",
    "urn:ietf:params:oauth:grant-type:token-exchange"
  );
  body.set("subject_token", sessionToken);
  body.set(
    "subject_token_type",
    "urn:ietf:params:oauth:token-type:id_token"
  );
  body.set(
    "requested_token_type",
    "urn:shopify:params:oauth:token-type:online-access-token"
  );

  const response = await fetch(
    `https://${shop}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      cache: "no-store",
    }
  );

  const text = await response.text();

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    data = {
      raw: text,
    };
  }

  if (!response.ok || !data?.access_token) {
    console.error(
      "Shopify token exchange failed:",
      {
        status: response.status,
        data,
      }
    );

    throw new Error(
      data?.error_description ||
        data?.error ||
        "Shopify token exchange failed."
    );
  }

  return data.access_token as string;
}

async function getProducts(
  shop: string,
  accessToken: string
) {
  const query = `
    query GetProducts {
      products(first: 100) {
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
        Accept: "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query,
      }),
      cache: "no-store",
    }
  );

  const text = await response.text();

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    data = {
      raw: text,
    };
  }

  if (!response.ok || data?.errors) {
    console.error(
      "Shopify products request failed:",
      {
        status: response.status,
        data,
      }
    );

    throw new Error(
      data?.errors?.[0]?.message ||
        "Shopify products request failed."
    );
  }

  return data?.data?.products?.nodes ?? [];
}

export async function GET(request: NextRequest) {
  try {
    const sessionToken =
      getSessionToken(request);

    if (!sessionToken) {
      return jsonResponse(
        {
          success: false,
          error:
            "Shopify session token is missing.",
        },
        401
      );
    }

    const shop =
      getShopFromToken(sessionToken);

    if (!shop) {
      return jsonResponse(
        {
          success: false,
          error:
            "Unable to determine Shopify store from session token.",
        },
        401
      );
    }

    const accessToken =
      await exchangeSessionToken(
        shop,
        sessionToken
      );

    const products =
      await getProducts(
        shop,
        accessToken
      );

    return jsonResponse({
      success: true,
      shop,
      products,
    });
  } catch (error) {
    console.error(
      "Shopify products route error:",
      error
    );

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to connect to Shopify.",
      },
      500
    );
  }
}
