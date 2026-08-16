import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_API_VERSION = "2026-07";

type JsonRecord = Record<string, unknown>;

function json(data: JsonRecord, status = 200) {
  return NextResponse.json(data, { status });
}

function normalizeShopDomain(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

function getShopFromSessionToken(token: string) {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) return "";

    const payloadPart = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const padded =
      payloadPart +
      "=".repeat((4 - (payloadPart.length % 4)) % 4);

    const payload = JSON.parse(
      Buffer.from(padded, "base64").toString("utf8")
    ) as JsonRecord;

    if (typeof payload.dest !== "string") return "";

    return normalizeShopDomain(
      new URL(payload.dest).hostname
    );
  } catch {
    return "";
  }
}

async function exchangeSessionToken(
  shop: string,
  sessionToken: string
) {
  const clientId =
    process.env.SHOPIFY_API_KEY?.trim();

  const clientSecret =
    process.env.SHOPIFY_API_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing SHOPIFY_API_KEY or SHOPIFY_API_SECRET in Vercel Environment Variables."
    );
  }

  const body = new URLSearchParams({
    grant_type:
      "urn:ietf:params:oauth:grant-type:token-exchange",
    client_id: clientId,
    client_secret: clientSecret,
    subject_token: sessionToken,
    subject_token_type:
      "urn:ietf:params:oauth:token-type:id_token",
    requested_token_type:
      "urn:shopify:params:oauth:token-type:online-access-token",
  }).toString();

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

  let data: JsonRecord = {};

  try {
    const parsed = JSON.parse(text);

    if (parsed && typeof parsed === "object") {
      data = parsed as JsonRecord;
    }
  } catch {
    throw new Error(
      `Shopify token exchange returned non-JSON data (HTTP ${response.status}).`
    );
  }

  if (!response.ok) {
    const detail =
      typeof data.error_description === "string"
        ? data.error_description
        : typeof data.error === "string"
          ? data.error
          : `HTTP ${response.status}`;

    throw new Error(
      `Shopify token exchange failed: ${detail}`
    );
  }

  const accessToken = data.access_token;

  if (
    typeof accessToken !== "string" ||
    !accessToken
  ) {
    throw new Error(
      "Shopify did not return an access token."
    );
  }

  return accessToken;
}

export async function GET(
  request: NextRequest
) {
  try {
    const sessionToken =
      request.headers
        .get("authorization")
        ?.replace(/^Bearer\s+/i, "") ||
      request.headers.get(
        "x-shopify-session-token"
      ) ||
      "";

    if (!sessionToken) {
      return json(
        {
          success: false,
          error:
            "Shopify session token is unavailable. Open Virello from Shopify Admin.",
        },
        401
      );
    }

    const tokenShop =
      getShopFromSessionToken(sessionToken);

    const configuredShop =
      process.env.SHOPIFY_STORE_DOMAIN
        ? normalizeShopDomain(
            process.env.SHOPIFY_STORE_DOMAIN
          )
        : "";

    const shop =
      tokenShop || configuredShop;

    if (
      !shop ||
      !shop.endsWith(".myshopify.com")
    ) {
      return json(
        {
          success: false,
          error:
            "Shopify store domain could not be determined.",
        },
        400
      );
    }

    const accessToken =
      await exchangeSessionToken(
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
          "X-Shopify-Access-Token":
            accessToken,
        },
        body: JSON.stringify({ query }),
        cache: "no-store",
      }
    );

    const text = await response.text();

    let result: JsonRecord = {};

    try {
      const parsed = JSON.parse(text);

      if (
        parsed &&
        typeof parsed === "object"
      ) {
        result = parsed as JsonRecord;
      }
    } catch {
      throw new Error(
        `Shopify Admin API returned non-JSON data (HTTP ${response.status}).`
      );
    }

    if (!response.ok) {
      return json(
        {
          success: false,
          error:
            "Shopify Admin API request failed.",
          details: result,
        },
        response.status
      );
    }

    if (
      Array.isArray(result.errors) &&
      result.errors.length > 0
    ) {
      return json(
        {
          success: false,
          error:
            "Shopify GraphQL error.",
          details: result.errors,
        },
        500
      );
    }

    const data =
      result.data as
        | JsonRecord
        | undefined;

    const connection =
      data?.products as
        | JsonRecord
        | undefined;

    const nodes =
      Array.isArray(connection?.nodes)
        ? connection.nodes
        : [];

    const products = nodes.map(
      (node) => {
        const item =
          (node || {}) as JsonRecord;

        const variants =
          item.variants as
            | JsonRecord
            | undefined;

        const variantNodes =
          Array.isArray(
            variants?.nodes
          )
            ? variants.nodes
            : [];

        const firstVariant =
          (variantNodes[0] || {}) as JsonRecord;

        const image =
          item.featuredImage as
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
            typeof item.descriptionHtml ===
            "string"
              ? item.descriptionHtml
              : "",

          productType:
            typeof item.productType ===
            "string"
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
            typeof firstVariant.price ===
            "string"
              ? firstVariant.price
              : "",

          images:
            image &&
            typeof image.url === "string"
              ? [
                  {
                    url: image.url,
                    altText:
                      typeof image.altText ===
                      "string"
                        ? image.altText
                        : null,
                  },
                ]
              : [],

          featuredImage:
            image &&
            typeof image.url === "string"
              ? image.url
              : null,
        };
      }
    );

    return json({
      success: true,
      products,
    });
  } catch (error) {
    console.error(
      "Shopify products error:",
      error
    );

    return json(
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
