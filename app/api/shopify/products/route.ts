import { NextRequest, NextResponse } from "next/server";
import { OriginGuardError, assertSafeMutation } from "../../_lib/origin-guard";
import { authenticateShopifyRequest } from "../../_lib/shopify-auth";

const SHOPIFY_API_VERSION = "2026-07";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    assertSafeMutation(request);
    const { shop, accessToken } = await authenticateShopifyRequest(request);

    const body = await request.json();

    const {
      productId,
      title,
      description,
      productType,
      tags,
      seoTitle,
      metaDescription,
    } = body ?? {};

    if (typeof productId !== "string" || !productId.trim()) {
      return errorResponse("Product ID is required.", 400);
    }

    const input: Record<string, unknown> = {
      id: productId.trim(),
    };

    if (typeof title === "string") {
      input.title = title.trim();
    }

    if (typeof description === "string") {
      input.descriptionHtml = description;
    }

    if (typeof productType === "string") {
      input.productType = productType.trim();
    }

    if (Array.isArray(tags)) {
      input.tags = tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter(Boolean);
    } else if (typeof tags === "string") {
      input.tags = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }

    const seo: Record<string, string> = {};

    if (typeof seoTitle === "string") {
      seo.title = seoTitle.trim();
    }

    if (typeof metaDescription === "string") {
      seo.description = metaDescription.trim();
    }

    if (Object.keys(seo).length > 0) {
      input.seo = seo;
    }

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

    const response = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query: mutation,
          variables: { input },
        }),
        cache: "no-store",
      }
    );

    const text = await response.text();

    let data: unknown;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Shopify returned a non-JSON response (${response.status}).`
      );
    }

    const responseData = data as {
      errors?: Array<{ message?: string }>;
      data?: {
        productUpdate?: {
          product?: unknown;
          userErrors?: Array<{ field?: string[]; message?: string }>;
        };
      };
    };

    if (!response.ok) {
      throw new Error(
        responseData.errors?.[0]?.message ||
          `Shopify API request failed (${response.status}).`
      );
    }

    if (responseData.errors?.length) {
      throw new Error(
        responseData.errors
          .map((error) => error.message || "Shopify GraphQL error.")
          .join("; ")
      );
    }

    const result = responseData.data?.productUpdate;

    if (!result) {
      throw new Error("Shopify did not return a product update result.");
    }

    if (result.userErrors?.length) {
      throw new Error(
        result.userErrors
          .map((error) => error.message || "Shopify product update failed.")
          .join("; ")
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Product saved to Shopify successfully.",
        product: result.product,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    if (error instanceof OriginGuardError) {
      return errorResponse(error.message, error.status);
    }

    console.error("SHOPIFY_SAVE_PRODUCT_ERROR:", error);

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unable to save product to Shopify.",
      500
    );
  }
}
