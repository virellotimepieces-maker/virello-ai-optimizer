import { neon } from "@neondatabase/serverless";

export function database() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return neon(url);
}

let schemaPromise: Promise<void> | null = null;

export async function ensureDatabaseSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const sql = database();
      await sql`
        CREATE TABLE IF NOT EXISTS subscriber_usage (
          subscription_id TEXT NOT NULL,
          period_start BIGINT NOT NULL,
          usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (subscription_id, period_start)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS shopify_sessions (
          shop TEXT PRIMARY KEY,
          encrypted_access_token TEXT NOT NULL,
          scope TEXT NOT NULL DEFAULT '',
          installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS shop_subscriptions (
          shop TEXT PRIMARY KEY,
          stripe_customer_id TEXT NOT NULL,
          stripe_subscription_id TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL,
          current_period_start BIGINT NOT NULL DEFAULT 0,
          current_period_end BIGINT NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS stripe_webhook_events (
          event_id TEXT PRIMARY KEY,
          processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS subscriber_usage_updated_at_idx ON subscriber_usage (updated_at)`;
      await sql`CREATE INDEX IF NOT EXISTS shop_subscriptions_customer_idx ON shop_subscriptions (stripe_customer_id)`;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  await schemaPromise;
}
