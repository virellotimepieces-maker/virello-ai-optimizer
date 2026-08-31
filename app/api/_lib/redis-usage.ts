type UsageInput = {
  subscriptionId: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  requestedCount: number;
  limit: number;
};

export type PersistentUsage = {
  used: number;
  limit: number;
  remaining: number;
};

class UsageStorageError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "UsageStorageError";
    this.status = status;
  }
}

function getRedisConfiguration(): {
  url: string;
  token: string;
} {
  const url =
    process.env.UPSTASH_REDIS_REST_URL
      ?.trim()
      .replace(/\/+$/, "") || "";

  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN
      ?.trim() || "";

  if (!url || !token) {
    throw new UsageStorageError(
      "Subscriber usage storage is not configured.",
      503
    );
  }

  return { url, token };
}

async function runRedisCommand<T>(
  command: Array<string | number>
): Promise<T> {
  const { url, token } =
    getRedisConfiguration();

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });
  } catch {
    throw new UsageStorageError(
      "Subscriber usage storage is temporarily unavailable.",
      503
    );
  }

  const text = await response.text();

  let data: {
    result?: T;
    error?: string;
  };

  try {
    data = JSON.parse(text);
  } catch {
    throw new UsageStorageError(
      "Subscriber usage storage returned an invalid response.",
      502
    );
  }

  if (!response.ok || data.error) {
    console.error("UPSTASH_REDIS_ERROR", {
      status: response.status,
      error: data.error,
    });

    throw new UsageStorageError(
      "Subscriber usage storage is temporarily unavailable.",
      503
    );
  }

  return data.result as T;
}

export async function incrementSubscriberUsage(
  input: UsageInput
): Promise<PersistentUsage> {
  const {
    subscriptionId,
    currentPeriodStart,
    currentPeriodEnd,
    requestedCount,
    limit,
  } = input;

  const usageKey =
    `virello:ai-usage:v1:${subscriptionId}:${currentPeriodStart}`;

  const expiresAt = Math.max(
    currentPeriodEnd + 60 * 60 * 24 * 7,
    Math.floor(Date.now() / 1000) + 60 * 60
  );

  const script = `
    local current = tonumber(redis.call("GET", KEYS[1]) or "0")
    local cookieCount = tonumber(ARGV[2]) or 0
    local usageLimit = tonumber(ARGV[1])
    local expiration = tonumber(ARGV[3])

    if cookieCount > current then
      current = cookieCount
      redis.call("SET", KEYS[1], current)
    end

    if current >= usageLimit then
      redis.call("EXPIREAT", KEYS[1], expiration)
      return -1
    end

    local nextCount = redis.call("INCR", KEYS[1])
    redis.call("EXPIREAT", KEYS[1], expiration)
    return nextCount
  `;

  const used = await runRedisCommand<number>([
    "EVAL",
    script,
    1,
    usageKey,
    limit,
    Math.max(0, requestedCount),
    expiresAt,
  ]);

  if (
    typeof used !== "number" ||
    !Number.isFinite(used)
  ) {
    throw new UsageStorageError(
      "Subscriber usage storage returned an invalid count.",
      502
    );
  }

  if (used < 0) {
    throw new UsageStorageError(
      "You have reached your AI usage limit for the current billing period.",
      429
    );
  }

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}
