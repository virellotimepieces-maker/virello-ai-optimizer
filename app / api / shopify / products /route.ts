import { NextResponse } from "next/server";

const SHOPIFY_API_VERSION = "2026-07";

export async function GET() {
  try {
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    if (!shop) {
      return NextResponse.json(
        { error: "SHOPIFY_STORE_DOMAIN is not configured" },
        { status: 500 }
      );
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: "SHOPIFY_ADMIN_ACCESS_TOKEN is not configured" },
        { status: 500 }
      );
    }

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
                edges {
                  node {
                    id
                    title
                    handle
                    descriptionHtml
                    status
                    vendor
                    productType
                    tags
                    seo {
                      title
                      description
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

    const data = await response.json();

    if (!response.ok || data.errors) {
      return NextResponse.json(
        {
          error: "Shopify API request failed",
          details: data.errors || data,
        },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json({
      products: data.data.products.edges.map(
        (edge: { node: unknown }) => edge.node
      ),
    });
  } catch (error) {
    console.error("Shopify products error:", error);

    return NextResponse.json(
      {
        error: "Unable to connect to Shopify",
      },
      { status: 500 }
    );
  }
}
