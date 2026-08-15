import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_API_VERSION = "2026-07";

type ShopifyProductNode = {
  id: string;
  title: string;
  description: string;
  productType: string;
  tags: string[];
  vendor: string;
  status: string;

  featuredImage: {
    url: string;
    altText: string | null;
  } | null;

  images: {
    nodes: {
      url: string;
      altText: string | null;
    }[];
  };

  variants: {
    nodes: {
      price: string;
    }[];
  };
};

type ShopifyGraphQLResponse = {
  data?: {
    products?: {
      nodes: ShopifyProductNode[];
    };
  };
  errors?: unknown;
};

function errorResponse(
  error: string,
  status: number,
  details?: unknown
) {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(details !== undefined
        ? { details }
        : {}),
    },
    { status }
  );
}

function getSessionToken(
  request: NextRequest
) {
  const authorization =
    request.headers.get("authorization");

  if (authorization) {
    return authorization
      .replace(/^Bearer\s+/i, "")
      .trim();
  }

  return (
    request.headers
      .get("x-shopify-session-token")
      ?.trim() || ""
  );
}

function decodeSessionToken(
  token: string
) {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error(
      "Invalid Shopify session token."
    );
  }

  try {
    return JSON.parse(
      Buffer.from(
        parts[1],
        "base64url"
      ).toString("utf8")
    );
  } catch {
    throw new Error(
      "Unable to decode Shopify session token."
    );
  }
}

export async function GET(
  request: NextRequest
) {
  try {
    /*
     * 1. Get Shopify session token
     */
    const sessionToken =
      getSessionToken(request);

    if (!sessionToken) {
      return errorResponse(
        "Missing Shopify session token.",
        401
      );
    }

    /*
     * 2. Get Shopify app credentials
     */
    const shopifyApiKey =
      process.env.SHOPIFY_API_KEY;

    const shopifyApiSecret =
      process.env.SHOPIFY_API_SECRET;

    if (
      !shopifyApiKey ||
      !shopifyApiSecret
    ) {
      return errorResponse(
        "Shopify API credentials are not configured.",
        500
      );
    }

    /*
     * 3. Detect the Shopify store
     */
    const payload =
      decodeSessionToken(sessionToken);

    const destination =
      typeof payload.dest === "string"
        ? payload.dest
        : "";

    if (!destination) {
      return errorResponse(
        "Shopify shop could not be detected.",
        400
      );
    }

    const shop =
      new URL(destination).hostname;

    /*
     * 4. Exchange Shopify session token
     *    for Admin API access token
     */
    const tokenResponse =
      await fetch(
        `https://${shop}/admin/oauth/access_token`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
            Accept: "application/json",
          },

          body: new URLSearchParams({
            client_id: shopifyApiKey,

            client_secret:
              shopifyApiSecret,

            grant_type:
              "urn:ietf:params:oauth:grant-type:token-exchange",

            subject_token:
              sessionToken,

            subject_token_type:
              "urn:ietf:params:oauth:token-type:id_token",

            requested_token_type:
              "urn:shopify:params:oauth:token-type:online-access-token",
          }).toString(),

          cache: "no-store",
        }
      );

    if (!tokenResponse.ok) {
      const errorText =
        await tokenResponse.text();

      return errorResponse(
        "Shopify token exchange failed.",
        401,
        errorText
      );
    }

    const tokenData =
      await tokenResponse.json();

    const accessToken =
      tokenData?.access_token;

    if (
      typeof accessToken !== "string" ||
      !accessToken
    ) {
      return errorResponse(
        "Shopify did not return an access token.",
        401
      );
    }

    /*
     * 5. Get Shopify products
     *
     * We get:
     * - title
     * - description
     * - product type
     * - tags
     * - vendor
     * - status
     * - featured image
     * - up to 6 images
     * - first variant price
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

    const productsResponse =
      await fetch(
        `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",

            "X-Shopify-Access-Token":
              accessToken,
          },

          body: JSON.stringify({
            query,
          }),

          cache: "no-store",
        }
      );

    const productsData =
      (await productsResponse.json()) as ShopifyGraphQLResponse;

    if (
      !productsResponse.ok ||
      productsData.errors
    ) {
      return errorResponse(
        "Shopify products request failed.",
        500,
        productsData.errors ||
          productsData
      );
    }

    /*
     * 6. Make sure the product response exists
     */
    const nodes =
      productsData.data?.products?.nodes;

    if (!Array.isArray(nodes)) {
      return errorResponse(
        "Shopify returned an invalid products response.",
        500
      );
    }

    /*
     * 7. Convert Shopify data into the
     *    exact structure expected by page.tsx
     */
    const products = nodes.map(
      (item) => {
        const images =
          item.images?.nodes || [];

        const featuredImage =
          item.featuredImage?.url ||
          images[0]?.url ||
          null;

        const price =
          item.variants?.nodes?.[0]
            ?.price || "";

        return {
          id: item.id,

          title:
            item.title || "",

          description:
            item.description || "",

          productType:
            item.productType || "",

          tags: Array.isArray(item.tags)
            ? item.tags
            : [],

          status:
            item.status || "",

          vendor:
            item.vendor || "",

          price,

          images,

          featuredImage,
        };
      }
    );

    /*
     * 8. Return exactly what the frontend expects
     */
    return NextResponse.json({
      success: true,
      shop,
      products,
    });
  } catch (error) {
    console.error(
      "Shopify products error:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unable to connect to Shopify.",
      500
    );
  }
}
