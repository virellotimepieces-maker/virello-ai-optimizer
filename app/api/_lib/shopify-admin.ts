import { ShopifyAuthError } from "./shopify-auth";

export const SHOPIFY_API_VERSION = "2026-07";
export const SHOPIFY_PRODUCT_PAGE_SIZE = 50;
const MAX_RETRIES = 3;
const MAX_RETRY_WAIT_MS = 5_000;

export class ShopifyRateLimitError extends Error {
  status = 429;
  constructor(message = "Shopify is rate limiting requests. Try again shortly.") {
    super(message);
    this.name = "ShopifyRateLimitError";
  }
}

export class ShopifyTokenExpiredError extends ShopifyAuthError {
  constructor(message = "Shopify access expired. Reconnect the store.") {
    super(message, 401);
    this.name = "ShopifyTokenExpiredError";
  }
}

type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; cache?: RequestCache }
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

let shopifyFetchImpl: FetchLike = fetch as FetchLike;
let waitImpl = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function setShopifyAdminFetchForTests(fn: FetchLike | null): void {
  shopifyFetchImpl = fn ?? (fetch as FetchLike);
}

export function setShopifyAdminWaitForTests(fn: ((ms: number) => Promise<unknown>) | null): void {
  waitImpl = fn ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
}

function retryAfterMs(headers: { get(name: string): string | null }): number {
  const retryAfter = Number(headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(MAX_RETRY_WAIT_MS, Math.max(0, retryAfter * 1000));
  }
  return 400;
}

export async function shopifyAdminGraphql<T>(
  shop: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  let lastStatus = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await shopifyFetchImpl(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query, variables }),
        cache: "no-store",
      }
    );

    lastStatus = response.status;

    if (response.status === 401 || response.status === 403) {
      throw new ShopifyTokenExpiredError();
    }

    if (response.status === 429) {
      if (attempt === MAX_RETRIES) throw new ShopifyRateLimitError();
      await waitImpl(retryAfterMs(response.headers));
      continue;
    }

    const text = await response.text();
    let payload: {
      errors?: Array<{ message?: string; extensions?: { code?: string } }>;
      data?: T;
    };
    try {
      payload = JSON.parse(text) as typeof payload;
    } catch {
      throw new Error(`Shopify returned a non-JSON response (${response.status}).`);
    }

    const throttle = payload.errors?.some(
      (error) => error.extensions?.code === "THROTTLED"
    );
    if (throttle) {
      if (attempt === MAX_RETRIES) throw new ShopifyRateLimitError();
      await waitImpl(retryAfterMs(response.headers));
      continue;
    }

    if (!response.ok) {
      throw new Error(
        payload.errors?.[0]?.message || `Shopify API request failed (${response.status}).`
      );
    }

    if (payload.errors?.length) {
      throw new Error(
        payload.errors.map((error) => error.message || "Shopify GraphQL error.").join("; ")
      );
    }

    if (!payload.data) {
      throw new Error("Shopify did not return GraphQL data.");
    }

    return payload.data;
  }

  throw new Error(`Shopify API request failed (${lastStatus || 502}).`);
}
