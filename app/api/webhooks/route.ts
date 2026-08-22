import { authenticate } from "@/shopify.server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // Hinahayaan nitong i-verify ng Shopify app bridge/auth ang webhook HMAC nang tama
    const { topic, shop, session, admin } = await authenticate.webhook(request);

    console.log(`Received authenticated webhook for topic ${topic} in shop ${shop}`);

    // Handle mandatory compliance webhooks
    switch (topic) {
      case "CUSTOMERS_DATA_REQUEST":
      case "CUSTOMERS_REDACT":
      case "SHOP_REDACT":
        // Tanggapin at i-process ang compliance request
        break;
      default:
        break;
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook verification failed:", error);
    // Kung mag-fail ang HMAC check ng authenticate.webhook, ibabalik nito ang 400
    return NextResponse.json({ error: "Unauthorized" }, { status: 400 });
  }
}
