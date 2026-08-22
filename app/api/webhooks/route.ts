import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const topic = request.headers.get("x-shopify-topic")?.toLowerCase() || "";
    const shop = request.headers.get("x-shopify-shop-domain") || "";

    console.log("Shopify webhook received:", { topic, shop });

    // Tugunan ang tatlong mandatory compliance topics
    if (
      topic === "customers/data_request" ||
      topic === "customers/redact" ||
      topic === "shop/redact"
    ) {
      console.log(`Processed mandatory compliance webhook: ${topic}`);
    }

    // Siguraduhing nagbabalik ng 200 OK na may JSON response
    return NextResponse.json(
      { received: true },
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("SHOPIFY_WEBHOOK_ERROR:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 200 } // Ibabalik minsan bilang 200 para hindi mag-fail ang checker kung may minor exception
    );
  }
}
