export class RateLimitError extends Error {
  status = 429;
  constructor(message = "Too many requests. Try again shortly.") {
    super(message);
    this.name = "RateLimitError";
  }
}

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function resetRateLimitForTests(): void {
  buckets.clear();
}

export function assertRateLimit(
  key: string,
  limit: number,
  windowMs = 60_000
): void {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) {
    throw new RateLimitError();
  }
  current.count += 1;
}

export function clientKey(request: { headers: { get(name: string): string | null }; nextUrl?: { pathname: string } }, prefix: string): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return `${prefix}:${ip}`;
}
