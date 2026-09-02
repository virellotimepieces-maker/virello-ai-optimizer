import { parseAppLocale, type AppLocale } from "./locales";

export type OptimizerProduct = {
  id?: string;
  title: string;
  description?: string;
  productType?: string;
  vendor?: string;
  tags?: string[];
  price?: string;
};

export type OptimizationResult = {
  analysis: {
    targetCustomer: string;
    purchaseMotivation: string;
    strongestFeatures: string[];
    missingInformation: string[];
    conversionCopy: string;
  };
  optimization: {
    title: string;
    description: string;
    seoTitle: string;
    metaDescription: string;
    tags: string[];
    conversionCopy: string;
  };
  reasoning: string;
};

export class OptimizerError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "OptimizerError";
    this.status = status;
  }
}

type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

let optimizerFetch: FetchLike = fetch as FetchLike;

export function setOptimizerFetchForTests(fn: FetchLike | null): void {
  optimizerFetch = fn ?? (fetch as FetchLike);
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

export function sourceFactText(product: OptimizerProduct): string {
  return [
    product.title,
    product.description,
    product.productType,
    product.vendor,
    product.price,
    ...(product.tags ?? []),
  ]
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();
}

const INVENTED_CLAIM =
  /\b(certified|certification|warranty|guarantee|guaranteed|fda|iso\s*\d+|clinically|award[- ]winning|best[- ]seller|#1|star review|verified review)\b/i;
const PRICE_CLAIM = /(?:php|usd|\$|€|₱)\s?\d[\d,]*(?:\.\d+)?/gi;

export function inventedClaimsIn(source: string, generated: string): string[] {
  const issues: string[] = [];
  const sourceLower = source.toLowerCase();
  const generatedLower = generated.toLowerCase();
  const claim = generatedLower.match(INVENTED_CLAIM);
  if (claim && !sourceLower.includes(claim[0].toLowerCase())) {
    issues.push(`Invented claim: ${claim[0]}`);
  }
  const prices = generated.match(PRICE_CLAIM) || [];
  for (const price of prices) {
    if (!sourceLower.includes(price.toLowerCase()) && !sourceLower.includes(price.replace(/[^\d.]/g, ""))) {
      issues.push(`Invented price: ${price}`);
    }
  }
  return issues;
}

export function validateOptimizationResult(raw: unknown): OptimizationResult {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const analysis = data.analysis && typeof data.analysis === "object" ? (data.analysis as Record<string, unknown>) : {};
  const optimization =
    data.optimization && typeof data.optimization === "object"
      ? (data.optimization as Record<string, unknown>)
      : {};

  const result: OptimizationResult = {
    analysis: {
      targetCustomer: cleanText(analysis.targetCustomer),
      purchaseMotivation: cleanText(analysis.purchaseMotivation),
      strongestFeatures: cleanArray(analysis.strongestFeatures),
      missingInformation: cleanArray(analysis.missingInformation),
      conversionCopy: cleanText(analysis.conversionCopy),
    },
    optimization: {
      title: cleanText(optimization.title).slice(0, 120),
      description: cleanText(optimization.description),
      seoTitle: cleanText(optimization.seoTitle).slice(0, 70),
      metaDescription: cleanText(optimization.metaDescription).slice(0, 160),
      tags: cleanArray(optimization.tags).slice(0, 20),
      conversionCopy: cleanText(optimization.conversionCopy),
    },
    reasoning: cleanText(data.reasoning),
  };

  if (!result.optimization.title || !result.optimization.description) {
    throw new OptimizerError("AI result is missing a product title or description.", 502);
  }
  return result;
}

export function assertGroundedResult(
  product: OptimizerProduct,
  result: OptimizationResult
): void {
  const source = sourceFactText(product);
  const generated = [
    result.optimization.title,
    result.optimization.description,
    result.optimization.seoTitle,
    result.optimization.metaDescription,
    result.optimization.conversionCopy,
    result.optimization.tags.join(" "),
    result.analysis.strongestFeatures.join(" "),
  ].join(" \n ");
  const issues = inventedClaimsIn(source, generated);
  if (issues.length) {
    throw new OptimizerError(
      `The AI invented details that are not in the product data: ${issues.join("; ")}`,
      422
    );
  }
}

function languageInstruction(outputLocale: AppLocale): string {
  return outputLocale === "fil"
    ? "Write all customer-facing product copy in clear Filipino (Tagalog). Keep brand names and SKUs unchanged."
    : "Write all customer-facing product copy in clear English. Keep brand names and SKUs unchanged.";
}

export function buildOptimizerMessages(
  product: OptimizerProduct,
  outputLocale: AppLocale
): { system: string; user: string } {
  return {
    system: `You are Virello AI Optimizer, a Shopify product listing optimizer.
Optimize only the supplied product. Never invent features, claims, specifications, prices, reviews, certifications, warranties, or guarantees.
If a fact is missing, list it under missingInformation instead of inventing it.
${languageInstruction(outputLocale)}
Return JSON only with keys analysis (targetCustomer, purchaseMotivation, strongestFeatures, missingInformation, conversionCopy), optimization (title, description, seoTitle, metaDescription, tags, conversionCopy), and reasoning.`,
    user: JSON.stringify(product),
  };
}

function parseModelText(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenced?.[1]?.trim() || trimmed;
  return JSON.parse(jsonText);
}

async function callModel(system: string, user: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new OptimizerError("OPENAI_API_KEY is not configured.", 500);
  }
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const response = await optimizerFetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new OptimizerError("The AI optimizer is unavailable right now.", response.status >= 400 ? response.status : 502);
  }
  let payload: { choices?: Array<{ message?: { content?: string } }> };
  try {
    payload = JSON.parse(text) as typeof payload;
  } catch {
    throw new OptimizerError("The AI optimizer returned an invalid response.", 502);
  }
  const content = payload.choices?.[0]?.message?.content?.trim() || "";
  if (!content) throw new OptimizerError("The AI optimizer returned no optimization result.", 502);
  return content;
}

export async function optimizeProduct(
  product: OptimizerProduct,
  outputLocale: AppLocale = "en"
): Promise<OptimizationResult> {
  if (!cleanText(product.title)) {
    throw new OptimizerError("Product title is required for AI optimization.", 400);
  }
  const locale = parseAppLocale(outputLocale);
  const { system, user } = buildOptimizerMessages(product, locale);
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const content = await callModel(
        attempt === 0 ? system : `${system}\nRetry: return valid JSON and do not invent facts.`,
        user
      );
      const result = validateOptimizationResult(parseModelText(content));
      assertGroundedResult(product, result);
      return result;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof OptimizerError) throw lastError;
  throw new OptimizerError("The AI optimizer could not produce a valid result.", 502);
}
