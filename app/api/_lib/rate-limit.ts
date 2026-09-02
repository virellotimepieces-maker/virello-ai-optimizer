import { dbQuery } from "./database";
import { normalizeShop } from "./shop-domain";

export class RateLimitError extends Error {
  status = 429;
  constructor(message = "Too many requests. Try again shortly.") {
    super(message);
    this.name = "RateLimitError";
  }
}

export async function resetRateLimitForTests(): Promise<void> {
  await dbQuery("DELETE FROM rate_limit_buckets");
}

export async function cleanupExpiredRateLimits(now = Date.now()): Promise<number> {
  const rows = await dbQuery<{ bucket_key: string }>(
    `DELETE FROM rate_limit_buckets
     WHERE expires_at_ms <= $1
     RETURNING bucket_key`,
    [now]
  );
  return rows.length;
}

export async function assertRateLimit(
  key: string,
  limit: number,
  windowMs = 60_000
): Promise<void> {
  const bucketKey = key.trim();
  if (!bucketKey) {
    throw new RateLimitError();
  }

  const now = Date.now();
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const expiresAtMs = windowStartMs + windowMs;

  const rows = await dbQuery<{ hit_count: number | string }>(
    `INSERT INTO rate_limit_buckets (bucket_key, window_start_ms, hit_count, expires_at_ms)
     VALUES ($1, $2, 1, $3)
     ON CONFLICT (bucket_key, window_start_ms)
     DO UPDATE SET hit_count = rate_limit_buckets.hit_count + 1
     RETURNING hit_count`,
    [bucketKey, windowStartMs, expiresAtMs]
  );

  const hits = Number(rows[0]?.hit_count ?? 0);
  if (hits > limit) {
    throw new RateLimitError();
  }

  if (hits === 1 || hits % 25 === 0) {
    await cleanupExpiredRateLimits(now).catch(() => 0);
  }
}

export function clientKey(
  request: { headers: { get(name: string): string | null } },
  prefix: string
): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip =
    forwarded.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  return `${prefix}:ip:${ip}`;
}

export function shopRateKey(prefix: string, shop: string): string {
  const normalized = normalizeShop(shop);
  return normalized ? `${prefix}:shop:${normalized}` : `${prefix}:shop:unknown`;
}

export function tenantRateKey(
  request: { headers: { get(name: string): string | null } },
  prefix: string,
  shop = ""
): string {
  const normalized = normalizeShop(shop);
  if (normalized) return shopRateKey(prefix, normalized);
  return clientKey(request, prefix);
}
