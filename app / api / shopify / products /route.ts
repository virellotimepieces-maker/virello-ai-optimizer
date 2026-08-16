import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_API_VERSION = "2024-01";

function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET(request: NextRequest) {
  const shop = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!shop || !accessToken) {
    return jsonResponse({ error: "Shopify Not Connected" }, 400);
  }

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

  try {
    const response = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();

    if (result.errors) {
      return jsonResponse({ error: result.errors }, 500);
    }

    return jsonResponse(result.data);
  } catch (error: any) {
    return jsonResponse({ error: error.message || "Failed to fetch products" }, 500);
  }
}
