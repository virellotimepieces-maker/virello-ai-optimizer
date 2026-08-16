import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_API_VERSION = "2024-01";

function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

async function getProducts(shop: string, accessToken: string) {
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
      body: JSON.stringify({ query }),
      cache: "no-store",
    }
  );

  const text = await response.text();
  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok || data?.errors) {
    throw new Error(data?.errors?.[0]?.message || "Shopify products request failed.");
  }

  return data?.data?.products?.nodes ?? [];
}

export async function GET(request: NextRequest) {
  try {
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || process.env.SHOPIFY_API_SECRET;

    if (!shop || !accessToken) {
      return jsonResponse({ success: false, error: "Missing env vars" }, 400);
    }

    const cleanShop = shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const products = await getProducts(cleanShop, accessToken);

    return jsonResponse({ success: true, shop: cleanShop, products });
  } catch (error) {
    return jsonResponse({ success: false, error: "Error" }, 500);
  }
}
