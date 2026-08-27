import { NextRequest, NextResponse } from "next/server";
import { resolveShopDomain } from "../../../lib/shopify-domain";

const SHOPIFY_API_VERSION = "2026-07";

class ShopifyRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getHeaderToken(request: NextRequest) {
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

function getShopFromToken(token: string) {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return "";
    }

    const payload = JSON.parse(
      Buffer.from(
        parts[1],
        "base64url"
      ).toString("utf8")
    );

    if (typeof payload.dest !== "string") {
      return "";
    }

    return resolveShopDomain(new URL(payload.dest).hostname);
  } catch {
    return "";
  }
}

async function exchangeToken(
  shop: string,
  idToken: string
) {
  const apiKey =
    process.env.SHOPIFY_API_KEY;

  const apiSecret =
    process.env.SHOPIFY_API_SECRET;

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
    throw new Error(
      `Shopify token exchange returned non-JSON response (${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error_description ||
        data?.error ||
        "Shopify token exchange failed."
    );
  }

  if (!data?.access_token) {
    throw new Error(
      "Shopify did not return an Admin API access token."
    );
  }

  return data.access_token as string;
}

async function getShopifySession(request: NextRequest) {
  const sessionToken = getHeaderToken(request);
  const cookieAccessToken =
    request.cookies.get(
      "virello_shopify_access_token"
    )?.value || "";
  const cookieShop = resolveShopDomain(
    request.cookies.get(
      "virello_shopify_shop"
    )?.value || ""
  );

  if (cookieAccessToken && cookieShop) {
    return {
      shop: cookieShop,
      accessToken: cookieAccessToken,
    };
  }

  if (!sessionToken) {
    return null;
  }

  const shop =
    resolveShopDomain(
      request.headers.get("x-shopify-shop")?.trim() || ""
    ) || getShopFromToken(sessionToken);

  if (!shop) {
    throw new ShopifyRequestError(
      "Shopify store could not be determined.",
      400
    );
  }

  return {
    shop,
    accessToken: await exchangeToken(
      shop,
      sessionToken
    ),
  };
}

export async function GET(
  request: NextRequest
) {
  try {
    const session =
      await getShopifySession(request);

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Shopify connection is missing.",
        },
        { status: 401 }
      );
    }

    const query = `
      query GetProducts {
        products(first: 50, sortKey: UPDATED_AT, reverse: true) {
          edges {
            node {
              id
              title
              descriptionHtml
              productType
              tags
              status
              vendor
              featuredImage {
                url
                altText
              }
              images(first: 5) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
              variants(first: 1) {
                edges {
                  node {
                    price
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(
      `https://${session.shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          "X-Shopify-Access-Token":
            session.accessToken,
        },
        body: JSON.stringify({
          query,
        }),
        cache: "no-store",
      }
    );

    const text =
      await response.text();

    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Shopify returned a non-JSON response (${response.status}).`
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

    const products = Array.isArray(
      data?.data?.products?.edges
    )
      ? data.data.products.edges.map(
          ({ node }: any) => ({
            id: node.id,
            title: node.title,
            description:
              node.descriptionHtml,
            productType:
              node.productType,
            tags: Array.isArray(node.tags)
              ? node.tags
              : [],
            status: node.status,
            vendor: node.vendor,
            price:
              node.variants?.edges?.[0]?.node
                ?.price || "",
            featuredImage:
              node.featuredImage?.url ||
              null,
            images: Array.isArray(
              node.images?.edges
            )
              ? node.images.edges.map(
                  ({ node: image }: any) => ({
                    url: image.url,
                    altText:
                      image.altText,
                  })
                )
              : [],
          })
        )
      : [];

    return NextResponse.json({
      success: true,
      shop: session.shop,
      products,
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
      {
        status:
          error instanceof ShopifyRequestError
            ? error.status
            : 500,
      }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const session =
      await getShopifySession(request);

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Shopify connection is missing.",
        },
        { status: 401 }
      );
    }

    const body =
      await request.json();

    const {
      productId,
      title,
      description,
      productType,
      tags,
      seoTitle,
      metaDescription,
    } = body;

    if (!productId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Product ID is required.",
        },
        { status: 400 }
      );
    }

    const tagList =
      Array.isArray(tags)
        ? tags
        : typeof tags === "string"
          ? tags
              .split(",")
              .map(
                (tag: string) =>
                  tag.trim()
              )
              .filter(Boolean)
          : [];

    const mutation = `
      mutation UpdateProduct(
        $input: ProductInput!
      ) {
        productUpdate(input: $input) {
          product {
            id
            title
            descriptionHtml
            productType
            tags
            seo {
              title
              description
            }
          }

          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        id: productId,

        ...(typeof title === "string"
          ? {
              title: title.trim(),
            }
          : {}),

        ...(typeof description === "string"
          ? {
              descriptionHtml:
                description,
            }
          : {}),

        ...(typeof productType === "string"
          ? {
              productType:
                productType.trim(),
            }
          : {}),

        tags: tagList,

        seo: {
          ...(typeof seoTitle === "string"
            ? {
                title:
                  seoTitle.trim(),
              }
            : {}),

          ...(typeof metaDescription ===
          "string"
            ? {
                description:
                  metaDescription.trim(),
              }
            : {}),
        },
      },
    };

    const response = await fetch(
      `https://${session.shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          "X-Shopify-Access-Token":
            session.accessToken,
        },
        body: JSON.stringify({
          query: mutation,
          variables,
        }),
        cache: "no-store",
      }
    );

    const text =
      await response.text();

    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Shopify returned a non-JSON response (${response.status}).`
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
          .map(
            (error: any) =>
              error.message
          )
          .join("; ")
      );
    }

    const result =
      data?.data?.productUpdate;

    if (!result) {
      throw new Error(
        "Shopify did not return a product update result."
      );
    }

    if (result.userErrors?.length) {
      throw new Error(
        result.userErrors
          .map(
            (error: any) =>
              error.message
          )
          .join("; ")
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Product saved to Shopify successfully.",
      product:
        result.product,
    });
  } catch (error) {
    console.error(
      "SHOPIFY_SAVE_PRODUCT_ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to save product to Shopify.",
      },
      {
        status:
          error instanceof ShopifyRequestError
            ? error.status
            : 500,
      }
    );
  }
}
