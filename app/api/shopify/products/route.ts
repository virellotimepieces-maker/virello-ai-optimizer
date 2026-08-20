import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_API_VERSION = "2026-07";

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
          error: "Shopify session token is missing.",
        },
        { status: 401 }
      );
    }

    const shop = getShop(request, token);

    if (!shop) {
      return NextResponse.json(
        {
          success: false,
          error: "Shopify store could not be determined.",
        },
        { status: 400 }
      );
    }

    const accessToken =
      process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ||
      process.env.SHOPIFY_ACCESS_TOKEN ||
      "";

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "SHOPIFY_ADMIN_ACCESS_TOKEN is not configured in Vercel.",
        },
        { status: 500 }
      );
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
        images: Array.isArray(product.images?.nodes)
          ? product.images.nodes.map(
              (image: any) => ({
                url: image.url,
                altText: image.altText || null,
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
