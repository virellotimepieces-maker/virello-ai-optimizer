import { dbQuery } from "./database";
import { normalizeShop } from "./shop-domain";
import { getUsageLimit, type SubscriberUsage } from "./usage-limit";

export type { SubscriberUsage };

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string }).code;
  const message = error instanceof Error ? error.message : String(error);
  return code === "23505" || /duplicate key value|unique constraint/i.test(message);
}

export function parseIdempotencyKey(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < 8 || text.length > 128) return "";
  if (!/^[A-Za-z0-9._:-]+$/.test(text)) return "";
  return text;
}

function asFlag(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1 || value === "1";
}

function asUsage(used: number, limit: number): SubscriberUsage {
  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}

export async function peekAiUsage(
  shop: string,
  subscriptionId: string,
  periodStart: number
): Promise<SubscriberUsage> {
  const normalized = normalizeShop(shop);
  const limit = getUsageLimit();
  const rows = await dbQuery<{ usage_count: number }>(
    `SELECT usage_count
     FROM subscriber_usage
     WHERE subscription_id = $1
       AND period_start = $2
       AND (shop = $3 OR shop IS NULL)
     LIMIT 1`,
    [subscriptionId, periodStart, normalized]
  );
  const used = Number(rows[0]?.usage_count ?? 0);
  return asUsage(used, limit);
}

async function incrementAiUsage(
  shop: string,
  subscriptionId: string,
  periodStart: number
): Promise<SubscriberUsage> {
  const limit = getUsageLimit();
  const params = [shop, subscriptionId, periodStart, limit];
  const sql = `INSERT INTO subscriber_usage (
       shop, subscription_id, period_start, usage_count, updated_at
     ) VALUES ($1, $2, $3, 1, NOW())
     ON CONFLICT (subscription_id, period_start)
     DO UPDATE SET
       usage_count = subscriber_usage.usage_count + 1,
       shop = COALESCE(subscriber_usage.shop, EXCLUDED.shop),
       updated_at = NOW()
     WHERE subscriber_usage.usage_count < $4
       AND (
         subscriber_usage.shop IS NULL
         OR subscriber_usage.shop = EXCLUDED.shop
       )
     RETURNING usage_count`;

  let rows: { usage_count: number }[] = [];
  try {
    rows = await dbQuery<{ usage_count: number }>(sql, params);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const peeked = await peekAiUsage(shop, subscriptionId, periodStart);
    if (peeked.used > 0) return peeked;
    rows = await dbQuery<{ usage_count: number }>(sql, params);
  }

  if (!rows.length) {
    throw Object.assign(
      new Error(
        "You have reached your AI usage limit for the current billing period."
      ),
      { status: 429 }
    );
  }

  return asUsage(Number(rows[0].usage_count), limit);
}

async function consumeIdempotentAiUsage(
  shop: string,
  subscriptionId: string,
  periodStart: number,
  idempotencyKey: string
): Promise<SubscriberUsage> {
  const limit = getUsageLimit();
  const rows = await dbQuery<{
    usage_count: number | string | null;
    duplicate: boolean;
    incremented: boolean;
    claimed: boolean;
  }>(
    `WITH already AS (
       SELECT u.usage_count
       FROM subscriber_usage_events e
       JOIN subscriber_usage u
         ON u.subscription_id = e.subscription_id
        AND u.period_start = e.period_start
       WHERE e.subscription_id = $2
         AND e.period_start = $3
         AND e.idempotency_key = $5
       LIMIT 1
     ),
     claimed AS (
       INSERT INTO subscriber_usage_events (
         shop, subscription_id, period_start, idempotency_key
       )
       SELECT $1, $2, $3, $5
       WHERE NOT EXISTS (SELECT 1 FROM already)
       ON CONFLICT (subscription_id, period_start, idempotency_key) DO NOTHING
       RETURNING shop, subscription_id, period_start
     ),
     upserted AS (
       INSERT INTO subscriber_usage (
         shop, subscription_id, period_start, usage_count, updated_at
       )
       SELECT shop, subscription_id, period_start, 1, NOW() FROM claimed
       ON CONFLICT (subscription_id, period_start)
       DO UPDATE SET
         usage_count = subscriber_usage.usage_count + 1,
         shop = COALESCE(subscriber_usage.shop, EXCLUDED.shop),
         updated_at = NOW()
       WHERE subscriber_usage.usage_count < $4
         AND (
           subscriber_usage.shop IS NULL
           OR subscriber_usage.shop = EXCLUDED.shop
         )
       RETURNING usage_count
     )
     SELECT
       COALESCE(
         (SELECT usage_count FROM already),
         (SELECT usage_count FROM upserted),
         (
           SELECT usage_count FROM subscriber_usage
           WHERE subscription_id = $2 AND period_start = $3
           LIMIT 1
         ),
         0
       ) AS usage_count,
       EXISTS (SELECT 1 FROM already) AS duplicate,
       EXISTS (SELECT 1 FROM upserted) AS incremented,
       EXISTS (SELECT 1 FROM claimed) AS claimed`,
    [shop, subscriptionId, periodStart, limit, idempotencyKey]
  );

  const row = rows[0];
  const used = Number(row?.usage_count ?? 0);
  const duplicate = asFlag(row?.duplicate);
  const incremented = asFlag(row?.incremented);
  const claimed = asFlag(row?.claimed);
  if (duplicate || incremented) {
    return asUsage(used, limit);
  }
  if (claimed && !incremented) {
    throw Object.assign(
      new Error(
        "You have reached your AI usage limit for the current billing period."
      ),
      { status: 429 }
    );
  }
  if (used > 0) {
    return asUsage(used, limit);
  }
  throw Object.assign(
    new Error(
      "You have reached your AI usage limit for the current billing period."
    ),
    { status: 429 }
  );
}

export async function consumeAiUsage(
  shop: string,
  subscriptionId: string,
  periodStart: number,
  idempotencyKey?: string
): Promise<SubscriberUsage> {
  const normalized = normalizeShop(shop);
  if (!normalized) {
    throw Object.assign(new Error("Invalid Shopify store."), { status: 400 });
  }

  const key = parseIdempotencyKey(idempotencyKey);
  if (key) {
    try {
      return await consumeIdempotentAiUsage(
        normalized,
        subscriptionId,
        periodStart,
        key
      );
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return peekAiUsage(normalized, subscriptionId, periodStart);
    }
  }

  return incrementAiUsage(normalized, subscriptionId, periodStart);
}
