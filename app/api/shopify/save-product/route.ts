import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  clearShopifyCookies,
  resolveShopifySession,
  shopifyGraphQL,
} from "../../_lib/shopify";

function toTagList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((tag) =>
        typeof tag === "string" ? tag.trim() : ""
      )
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

export async function POST(request: NextRequest) {
  try {
    const { shop, accessToken } =
      await resolveShopifySession(request);

    const body = await request.json();

    const {
      productId,
      title,
      description,
      productType,
      tags,
      seoTitle,
      metaDescription,
    } = body;

    if (!productId || typeof productId !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Product ID is required.",
        },
        { status: 400 }
      );
    }

    const mutation = `
      mutation UpdateProduct($input: ProductInput!) {
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

    const data = await shopifyGraphQL<{
      productUpdate?: {
        product?: any;
        userErrors?: Array<{ message?: string }>;
      };
    }>(shop, accessToken, mutation, {
      input: {
        id: productId,
        ...(typeof title === "string"
          ? { title: title.trim() }
          : {}),
        ...(typeof description === "string"
          ? { descriptionHtml: description }
          : {}),
        ...(typeof productType === "string"
          ? {
              productType: productType.trim(),
            }
          : {}),
        tags: toTagList(tags),
        seo: {
          ...(typeof seoTitle === "string"
            ? { title: seoTitle.trim() }
            : {}),
          ...(typeof metaDescription === "string"
            ? {
                description: metaDescription.trim(),
              }
            : {}),
        },
      },
    });

    const result = data.productUpdate;

    if (!result) {
      throw new ApiError(
        "Shopify did not return a product update result.",
        502
      );
    }

    if (result.userErrors?.length) {
      throw new ApiError(
        result.userErrors
          .map((error) => error.message)
          .filter(Boolean)
          .join("; ") ||
          "Shopify rejected the product update.",
        400
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Product saved to Shopify successfully.",
      product: result.product,
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

    console.error(
      "SHOPIFY_SAVE_PRODUCT_ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Unable to save product to Shopify.",
      },
      { status: 500 }
    );
  }
}
