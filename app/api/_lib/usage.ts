import { dbQuery } from "./database";
import { normalizeShop } from "./shop-domain";
import { getUsageLimit, type SubscriberUsage } from "./usage-limit";

export type { SubscriberUsage };

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string }).code;
  const message = error instanceof Error ? error.message : String(error);
  return code === "23505" || /duplicate key value|unique constraint/i.test(message);
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
  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}

export async function consumeAiUsage(
  shop: string,
  subscriptionId: string,
  periodStart: number
): Promise<SubscriberUsage> {
  const normalized = normalizeShop(shop);
  if (!normalized) {
    throw Object.assign(new Error("Invalid Shopify store."), { status: 400 });
  }

  const limit = getUsageLimit();
  const params = [normalized, subscriptionId, periodStart, limit];
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

  const used = Number(rows[0].usage_count);
  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}
