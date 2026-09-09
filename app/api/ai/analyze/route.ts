import { NextRequest, NextResponse } from "next/server";
import {
  authorizeSubscriberForAI,
  recordSuccessfulAiOptimization,
} from "../../_lib/subscriber";
import { OriginGuardError, assertSafeMutation } from "../../_lib/origin-guard";
import { ProductAccessError } from "../../_lib/product-access";
import { ShopifyAuthError } from "../../_lib/shopify-auth";
import { stripHtml } from "../../_lib/listing-html";
import {
  runOptimizeProduct,
  OptimizerError,
  type OptimizerProduct,
} from "../../_lib/optimizer";
import { parseAppLocale } from "../../_lib/locales";
import { assertRateLimit, RateLimitError, tenantRateKey } from "../../_lib/rate-limit";
import { parseIdempotencyKey } from "../../_lib/usage";
import { parseBrandVoice } from "../../_lib/brand-voice";
import { parseMerchantFacts } from "../../_lib/merchant-facts";
import { publicErrorMessage } from "../../_lib/public-error";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  try {
    assertSafeMutation(request);
    const subscriber = await authorizeSubscriberForAI(request);
    await assertRateLimit(tenantRateKey(request, "ai", subscriber.shop), 20);
    const body = await request.json().catch(() => ({}));
    const idempotencyKey = parseIdempotencyKey(
      request.headers.get("Idempotency-Key") || body?.idempotencyKey
    );
    const source = body?.product && typeof body.product === "object" ? body.product : body;
    const product: OptimizerProduct = {
      id: typeof source.id === "string" ? source.id : undefined,
      title: typeof source.title === "string" ? stripHtml(source.title) : "",
      description: typeof source.description === "string" ? stripHtml(source.description) : "",
      productType: typeof source.productType === "string" ? source.productType : "",
      vendor: typeof source.vendor === "string" ? source.vendor : "",
      tags: Array.isArray(source.tags) ? source.tags : [],
      price: typeof source.price === "string" ? source.price : "",
      handle: typeof source.handle === "string" ? source.handle : "",
      options: Array.isArray(source.options)
        ? source.options.filter((item: unknown): item is string => typeof item === "string")
        : [],
      variants: Array.isArray(source.variants)
        ? source.variants.filter((item: unknown): item is string => typeof item === "string")
        : [],
      merchantFacts: parseMerchantFacts(body.merchantFacts || source.merchantFacts),
    };

    const outputLocale = parseAppLocale(body.outputLocale || body.output);
    const brandVoice = parseBrandVoice(body.brandVoice || body.voice);
    const outcome = await runOptimizeProduct(product, outputLocale, subscriber.shop, brandVoice);
    const recorded = outcome.chargeUsage
      ? await recordSuccessfulAiOptimization(
          subscriber.shop,
          subscriber.subscription,
          idempotencyKey
        )
      : { usage: subscriber.usage };

    return NextResponse.json({
      success: true,
      result: outcome.result,
      usage: recorded.usage,
    });
  } catch (error) {
    if (error instanceof OriginGuardError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof ProductAccessError || error instanceof ShopifyAuthError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof OptimizerError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof RateLimitError) {
      return errorResponse(error.message, error.status);
    }
    const status = (error as { status?: number }).status;
    if (status === 429 || status === 402) {
      return errorResponse(
        publicErrorMessage(error, "Request could not be authorized."),
        status
      );
    }
    console.error("AI_ANALYZE_ERROR:", error);
    return errorResponse("Unable to optimize this product.", 500);
  }
}
