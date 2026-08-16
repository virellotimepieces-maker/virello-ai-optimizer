export async function GET(request: NextRequest) {
  try {
    // 1. Kunin ang shop at access token mula sa Vercel Environment Variables
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || process.env.SHOPIFY_API_SECRET;

    if (!shop || !accessToken) {
      return jsonResponse(
        {
          success: false,
          error: "Missing SHOPIFY_STORE_DOMAIN or Access Token in Environment Variables.",
        },
        400
      );
    }

    // Siguraduhin na malinis ang domain (walang https://)
    const cleanShop = shop.replace(/^https?:\/\//, "");

    // 2. I-fetch ang products mula sa Shopify GraphQL API
    const products = await getProducts(cleanShop, accessToken);

    return jsonResponse({
      success: true,
      shop: cleanShop,
      products,
    });
  } catch (error) {
    console.error("Shopify products route error:", error);

    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to connect to Shopify.",
      },
      500
    );
  }
}
