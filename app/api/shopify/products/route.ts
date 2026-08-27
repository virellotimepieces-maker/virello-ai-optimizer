import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  clearShopifyCookies,
  resolveShopifySession,
  shopifyGraphQL,
} from "../../_lib/shopify";

type ShopifyProductNode = {
  id: string;
  title: string;
  descriptionHtml: string;
  productType: string;
  tags: string[];
  status: string;
  vendor: string;
  featuredImage?: {
    url?: string;
  } | null;
  images?: {
    edges?: Array<{
      node?: {
        url?: string;
        altText?: string | null;
      };
    }>;
  };
  variants?: {
    edges?: Array<{
      node?: {
        price?: string;
      };
    }>;
  };
};

function toInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeProduct(node: ShopifyProductNode) {
  const firstVariant = node.variants?.edges?.[0]?.node;

  return {
    id: node.id,
    title: node.title || "",
    description: stripHtml(node.descriptionHtml || ""),
    productType: node.productType || "",
    tags: Array.isArray(node.tags) ? node.tags : [],
    status: node.status || "",
    vendor: node.vendor || "",
    price: firstVariant?.price || "",
    featuredImage: node.featuredImage?.url || null,
    images: (node.images?.edges || [])
      .map((edge) => ({
        url: edge.node?.url || "",
        altText: edge.node?.altText || null,
      }))
      .filter((image) => Boolean(image.url)),
  };
}

async function getShopifyProductsResponse(
  request: NextRequest
) {
  try {
    const { shop, accessToken } =
      await resolveShopifySession(request);

    const limit = Math.min(
      250,
      Math.max(1, toInt(request.nextUrl.searchParams.get("limit"), 50))
    );

    const cursor =
      request.nextUrl.searchParams.get("cursor") || null;

    const query = `
      query Products($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          edges {
            cursor
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
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const data = await shopifyGraphQL<{
      products?: {
        edges?: Array<{
          cursor: string;
          node: ShopifyProductNode;
        }>;
        pageInfo?: {
          hasNextPage?: boolean;
          endCursor?: string | null;
        };
      };
    }>(shop, accessToken, query, {
      first: limit,
      after: cursor,
    });

    const edges = data.products?.edges || [];
    const pageInfo = data.products?.pageInfo;

    return NextResponse.json({
      success: true,
      products: edges.map((edge) =>
        normalizeProduct(edge.node)
      ),
      pagination: {
        hasNextPage: Boolean(pageInfo?.hasNextPage),
        endCursor: pageInfo?.endCursor || null,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      const response = NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: error.status }
      );

      if (error.code === "SHOPIFY_TOKEN_EXPIRED") {
        clearShopifyCookies(response);
        response.headers.set(
          "X-Shopify-Retry-Invalid-Session-Request",
          "1"
        );
      }

      return response;
    }

    console.error("SHOPIFY_PRODUCTS_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to load Shopify products.",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return getShopifyProductsResponse(request);
}
