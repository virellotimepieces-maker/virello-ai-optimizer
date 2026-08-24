import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_API_VERSION = "2026-07";

class InvalidShopifySessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidShopifySessionError";
  }
}

function getToken(request: NextRequest) {
  return (
    request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ||
    request.headers
      .get("x-shopify-session-token")
      ?.trim() ||
    ""
  );
}

function getShop(request: NextRequest, token: string) {
  const headerShop = request.headers
    .get("x-shopify-shop")
    ?.trim();

  if (headerShop) {
    return headerShop
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "");
  }

  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return "";
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );

    if (typeof payload.dest !== "string") {
      return "";
    }

    return new URL(payload.dest).hostname;
  } catch {
    return "";
  }
}

async function exchangeToken(
  shop: string,
  idToken: string
) {
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error(
      "SHOPIFY_API_KEY or SHOPIFY_API_SECRET is missing in Vercel."
    );
  }

  const response = await fetch(
    `https://${shop}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: apiKey,
        client_secret: apiSecret,
        grant_type:
          "urn:ietf:params:oauth:grant-type:token-exchange",
        subject_token: idToken,
        subject_token_type:
          "urn:ietf:params:oauth:token-type:id_token",
        requested_token_type:
          "urn:shopify:params:oauth:token-type:online-access-token",
      }).toString(),
      cache: "no-store",
    }
  );

  const text = await response.text();

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    if (response.status === 400) {
      throw new InvalidShopifySessionError(
        "Invalid or expired Shopify session token."
      );
    }

    throw new Error(
      `Shopify token exchange returned non-JSON response (${response.status}).`
    );
  }

  if (response.status === 400) {
    throw new InvalidShopifySessionError(
      data?.error_description ||
        data?.error ||
        "Invalid or expired Shopify session token."
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error_description ||
        data?.error ||
        data?.errors?.[0]?.message ||
        `Shopify token exchange failed (${response.status}).`
    );
  }

  if (!data?.access_token) {
    throw new Error(
      "Shopify did not return an Admin API access token."
    );
  }

  return data.access_token as string;
}

async function shopifyGraphQL(
  shop: string,
  accessToken: string
) {
  const response = await fetch(
    `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: `
          query GetProducts {
            products(first: 100) {
              nodes {
                id
                title
                description
                productType
                tags
                status
                vendor

                featuredImage {
                  url
                  altText
                }

                variants(first: 1) {
                  nodes {
                    price
                  }
                }

                images(first: 20) {
                  nodes {
                    url
                    altText
                  }
                }
              }
            }
          }
        `,
      }),
      cache: "no-store",
    }
  );

  const text = await response.text();

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Shopify returned non-JSON response (${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.errors?.[0]?.message ||
        `Shopify API request failed (${response.status}).`
    );
  }

  if (data?.errors?.length) {
    throw new Error(
      data.errors
        .map((error: any) => error.message)
        .join("; ")
    );
  }

  return data?.data?.products?.nodes || [];
}

export async function GET(request: NextRequest) {
  try {
    const token = getToken(request);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Shopify session token is missing. Open Virello from Shopify Admin.",
        },
        {
          status: 401,
          headers: {
            "X-Shopify-Retry-Invalid-Session-Request": "1",
          },
        }
      );
    }

    const shop = getShop(request, token);

    if (!shop) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Shopify store could not be determined.",
        },
        { status: 400 }
      );
    }

    let accessToken: string;

    try {
      accessToken = await exchangeToken(
        shop,
        token
      );
    } catch (error) {
      if (
        error instanceof InvalidShopifySessionError
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              error.message ||
              "Invalid or expired Shopify session token.",
          },
          {
            status: 401,
            headers: {
              "X-Shopify-Retry-Invalid-Session-Request":
                "1",
            },
          }
        );
      }

      throw error;
    }

    const products = await shopifyGraphQL(
      shop,
      accessToken
    );

    const normalized = products.map(
      (product: any) => ({
        id: product.id,
        title: product.title || "",
        description: product.description || "",
        productType: product.productType || "",
        tags: Array.isArray(product.tags)
          ? product.tags
          : [],
        status: product.status || "",
        vendor: product.vendor || "",
        price:
          product.variants?.nodes?.[0]?.price || "",
        images: Array.isArray(
          product.images?.nodes
        )
          ? product.images.nodes.map(
              (image: any) => ({
                url: image.url,
                altText:
                  image.altText || null,
              })
            )
          : [],
        featuredImage:
          product.featuredImage?.url || null,
      })
    );

    return NextResponse.json({
      success: true,
      shop,
      products: normalized,
    });
  } catch (error) {
    console.error(
      "SHOPIFY_PRODUCTS_ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Shopify products.",
      },
      { status: 500 }
    );
  }
}
