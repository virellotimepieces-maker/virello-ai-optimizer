import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dbQuery, neonSql } from "../app/api/_lib/database";
import {
  rollbackPhase2,
  rollbackPhase4,
  rollbackPhase10ShopifyBilling,
  splitSqlStatements,
} from "../app/api/_lib/migrate";
import { saveShopifySession } from "../app/api/_lib/shopify-auth";
import {
  createAppSession,
  getActiveAppSession,
  revokeShopifyInstallation,
  upsertShop,
} from "../app/api/_lib/shops";
import { billingForShop } from "../app/api/_lib/shopify-billing";
import { consumeAiUsage, peekAiUsage } from "../app/api/_lib/usage";
import { seedShopifyBilling } from "./helpers/shopify-billing";
import {
  claimWebhookEvent,
  markWebhookEvent,
} from "../app/api/_lib/webhook-events";
import { clearTestDatabase, usePglite } from "./helpers/pglite";

const SHOP_A = "store-alpha.myshopify.com";
const SHOP_B = "store-beta.myshopify.com";

async function tableNames(): Promise<string[]> {
  const rows = await dbQuery<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
     ORDER BY table_name`
  );
  return rows.map((row) => String(row.table_name));
}

describe("Phase 2 SQL migrations", () => {
  it("splits dollar-quoted statements without breaking DO blocks", () => {
    const sql = `
      CREATE TABLE t (id int);
      DO $$ BEGIN
        ALTER TABLE t ADD CONSTRAINT t_pk PRIMARY KEY (id);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
      CREATE INDEX t_idx ON t (id);
    `;
    const statements = splitSqlStatements(sql);
    expect(statements).toHaveLength(3);
    expect(statements[1]).toContain("duplicate_object");
  });
});

describe("Phase 2 database behavior", () => {
  beforeEach(async () => {
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "x".repeat(32);
    process.env.AI_SUBSCRIBER_USAGE_LIMIT = "1000";
    await usePglite();
  });

  afterEach(() => {
    clearTestDatabase();
    delete process.env.AI_SUBSCRIBER_USAGE_LIMIT;
  });

  it("applies versioned migrations and creates related tables", async () => {
    const names = await tableNames();
    expect(names).toEqual(
      expect.arrayContaining([
        "schema_migrations",
        "shops",
        "shopify_sessions",
        "shop_subscriptions",
        "subscriber_usage",
        "stripe_webhook_events",
        "webhook_events",
        "app_sessions",
        "stripe_customers",
        "stripe_invoices",
        "rate_limit_buckets",
        "shopify_app_subscriptions",
        "subscriber_usage_events",
      ])
    );

    const versions = await dbQuery<{ version: string }>(
      "SELECT version FROM schema_migrations ORDER BY version"
    );
    expect(versions.map((row) => row.version)).toEqual([
      "001_subscriber_usage",
      "002_shopify_accounts",
      "003_phase2_schema",
      "004_phase3_sessions",
      "005_phase4_billing",
      "006_phase6_locales",
      "007_rate_limits",
      "008_shop_binding",
      "009_expiring_offline_tokens",
      "010_shopify_billing",
      "011_usage_idempotency",
    ]);
  });

  it("rolls Phase 2 back without dropping billing tables", async () => {
    await upsertShop(SHOP_A);
    await dbQuery(
      `INSERT INTO shop_subscriptions (
         shop, stripe_customer_id, stripe_subscription_id, status,
         current_period_start, current_period_end
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [SHOP_A, "cus_keep", "sub_keep", "active", 1_700_000_000, 1_702_592_000]
    );

    const { exec } = neonSql();
    await rollbackPhase10ShopifyBilling(exec);
    await rollbackPhase4(exec);
    await rollbackPhase2(exec);

    const names = await tableNames();
    expect(names).toContain("shop_subscriptions");
    expect(names).toContain("subscriber_usage");
    expect(names).not.toContain("shops");
    expect(names).not.toContain("app_sessions");
    expect(names).not.toContain("webhook_events");

    const billing = await dbQuery<{ stripe_subscription_id: string }>(
      "SELECT stripe_subscription_id FROM shop_subscriptions WHERE shop = $1",
      [SHOP_A]
    );
    expect(billing[0]?.stripe_subscription_id).toBe("sub_keep");
  });

  it("rejects duplicate provider event IDs after processing", async () => {
    const first = await claimWebhookEvent({
      provider: "stripe",
      eventId: "evt_1",
      eventType: "checkout.session.completed",
      shop: SHOP_A,
    });
    expect(first).toBe("claimed");
    await markWebhookEvent("stripe", "evt_1", "processed");

    const second = await claimWebhookEvent({
      provider: "stripe",
      eventId: "evt_1",
      eventType: "checkout.session.completed",
      shop: SHOP_A,
    });
    expect(second).toBe("duplicate");

    const shopifyFirst = await claimWebhookEvent({
      provider: "shopify",
      eventId: "wh_1",
      eventType: "app/uninstalled",
      shop: SHOP_A,
    });
    expect(shopifyFirst).toBe("claimed");
    await markWebhookEvent("shopify", "wh_1", "processed");
    expect(
      await claimWebhookEvent({
        provider: "shopify",
        eventId: "wh_1",
        eventType: "app/uninstalled",
        shop: SHOP_A,
      })
    ).toBe("duplicate");
  });

  it("keeps usage, sessions, and subscriptions tenant-isolated", async () => {
    await upsertShop(SHOP_A);
    await upsertShop(SHOP_B);
    await seedShopifyBilling(SHOP_A, {
      subscriptionGid: "gid://shopify/AppSubscription/a",
      currentPeriodStart: 100,
      currentPeriodEnd: 200,
    });
    await seedShopifyBilling(SHOP_B, {
      subscriptionGid: "gid://shopify/AppSubscription/b",
      currentPeriodStart: 100,
      currentPeriodEnd: 200,
    });

    await consumeAiUsage(SHOP_A, "sub_a", 100);
    await consumeAiUsage(SHOP_A, "sub_a", 100);

    const peekA = await peekAiUsage(SHOP_A, "sub_a", 100);
    const peekB = await peekAiUsage(SHOP_B, "sub_b", 100);
    expect(peekA.used).toBe(2);
    expect(peekB.used).toBe(0);

    await expect(consumeAiUsage(SHOP_B, "sub_a", 100)).rejects.toMatchObject({
      status: 429,
    });
    expect((await peekAiUsage(SHOP_A, "sub_a", 100)).used).toBe(2);

    await createAppSession({
      id: "sess_a",
      shop: SHOP_A,
      stripeCustomerId: "cus_a",
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(await getActiveAppSession("sess_a", SHOP_B)).toBeNull();
    expect((await getActiveAppSession("sess_a", SHOP_A))?.shop).toBe(SHOP_A);
    expect((await billingForShop(SHOP_A))?.subscriptionId).toBe(
      "gid://shopify/AppSubscription/a"
    );
    expect((await billingForShop(SHOP_B))?.subscriptionId).toBe(
      "gid://shopify/AppSubscription/b"
    );
  });

  it("revokes the Shopify install on uninstall and keeps billing for reinstall", async () => {
    await saveShopifySession(SHOP_A, "offline-token-alpha", "read_products");
    await seedShopifyBilling(SHOP_A, {
      subscriptionGid: "gid://shopify/AppSubscription/persist",
      currentPeriodStart: 100,
      currentPeriodEnd: 200,
    });

    await revokeShopifyInstallation(SHOP_A);

    const sessions = await dbQuery<{
      encrypted_access_token: string;
      revoked_at: string | null;
    }>(
      "SELECT encrypted_access_token, revoked_at FROM shopify_sessions WHERE shop = $1",
      [SHOP_A]
    );
    expect(sessions[0]?.encrypted_access_token).toBe("");
    expect(sessions[0]?.revoked_at).toBeTruthy();

    const shopRow = await dbQuery<{ uninstalled_at: string | null }>(
      "SELECT uninstalled_at FROM shops WHERE shop = $1",
      [SHOP_A]
    );
    expect(shopRow[0]?.uninstalled_at).toBeTruthy();
    expect((await billingForShop(SHOP_A))?.subscriptionId).toBe(
      "gid://shopify/AppSubscription/persist"
    );

    await saveShopifySession(SHOP_A, "offline-token-reinstall", "read_products");
    const restored = await dbQuery<{
      revoked_at: string | null;
      encrypted_access_token: string;
    }>(
      "SELECT revoked_at, encrypted_access_token FROM shopify_sessions WHERE shop = $1",
      [SHOP_A]
    );
    expect(restored[0]?.revoked_at).toBeNull();
    expect(restored[0]?.encrypted_access_token).not.toBe("");
    expect((await billingForShop(SHOP_A))?.subscriptionId).toBe(
      "gid://shopify/AppSubscription/persist"
    );
  });

  it("enforces the monthly allowance atomically under concurrent consumes", async () => {
    process.env.AI_SUBSCRIBER_USAGE_LIMIT = "8";
    await upsertShop(SHOP_A);
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        consumeAiUsage(SHOP_A, "sub_race", 1_700_000_000)
      )
    );
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(8);
    expect(rejected).toHaveLength(12);
    expect((await peekAiUsage(SHOP_A, "sub_race", 1_700_000_000)).used).toBe(8);
    expect((await peekAiUsage(SHOP_A, "sub_race", 1_700_000_000)).remaining).toBe(
      0
    );
  });

  it("starts a new counter when the billing period changes", async () => {
    process.env.AI_SUBSCRIBER_USAGE_LIMIT = "1000";
    await upsertShop(SHOP_A);
    await consumeAiUsage(SHOP_A, "sub_month", 100);
    await consumeAiUsage(SHOP_A, "sub_month", 100);
    const nextMonth = await consumeAiUsage(SHOP_A, "sub_month", 200);
    expect(nextMonth.used).toBe(1);
    expect(nextMonth.remaining).toBe(999);
    expect((await peekAiUsage(SHOP_A, "sub_month", 100)).used).toBe(2);
  });

  it("does not consume quota for a failed AI request", async () => {
    await upsertShop(SHOP_A);
    const before = await peekAiUsage(SHOP_A, "sub_fail", 100);
    expect(before.used).toBe(0);
    const peekedAgain = await peekAiUsage(SHOP_A, "sub_fail", 100);
    expect(peekedAgain.used).toBe(0);

    const analyze = readFileSync("app/api/ai/analyze/route.ts", "utf8");
    const optimizer = readFileSync("app/api/_lib/optimizer.ts", "utf8");
    const authorizeAt = analyze.indexOf("authorizeSubscriberForAI");
    const openaiAt = optimizer.indexOf("https://api.openai.com/v1/chat/completions");
    const consumeAt = analyze.lastIndexOf("recordSuccessfulAiOptimization");
    expect(authorizeAt).toBeGreaterThan(-1);
    expect(openaiAt).toBeGreaterThan(-1);
    expect(consumeAt).toBeGreaterThan(authorizeAt);
    expect(analyze.indexOf("optimizeProduct")).toBeGreaterThan(authorizeAt);
    expect(analyze.lastIndexOf("optimizeProduct")).toBeLessThan(consumeAt);
    expect(analyze).toMatch(/parseIdempotencyKey/);
    expect(analyze).toMatch(/Idempotency-Key/);
  });

  it("charges a repeated successful optimization only once when the idempotency key matches", async () => {
    await upsertShop(SHOP_A);
    const key = "opt-same-request-key";
    const first = await consumeAiUsage(SHOP_A, "sub_idem", 100, key);
    const second = await consumeAiUsage(SHOP_A, "sub_idem", 100, key);
    const concurrent = await Promise.all([
      consumeAiUsage(SHOP_A, "sub_idem", 100, key),
      consumeAiUsage(SHOP_A, "sub_idem", 100, key),
    ]);
    expect(first.used).toBe(1);
    expect(second.used).toBe(1);
    expect(concurrent.map((item) => item.used)).toEqual([1, 1]);
    expect((await peekAiUsage(SHOP_A, "sub_idem", 100)).used).toBe(1);

    const other = await consumeAiUsage(SHOP_A, "sub_idem", 100, "opt-second-click-key");
    expect(other.used).toBe(2);
  });

  it("does not increment usage from subscription, import, or status routes", () => {
    const status = readFileSync("app/api/subscriber/status/route.ts", "utf8");
    const products = readFileSync("app/api/shopify/products/route.ts", "utf8");
    const subscribe = readFileSync("app/api/billing/subscribe/route.ts", "utf8");
    const home = readFileSync("app/home-client.tsx", "utf8");
    expect(status).not.toMatch(/consumeAiUsage|recordSuccessfulAiOptimization/);
    expect(products).not.toMatch(/consumeAiUsage|recordSuccessfulAiOptimization/);
    expect(subscribe).not.toMatch(/consumeAiUsage|recordSuccessfulAiOptimization/);
    expect(readFileSync("app/api/_lib/optimizer.ts", "utf8")).not.toMatch(
      /consumeAiUsage|recordSuccessfulAiOptimization/
    );
    expect(home).toMatch(/optimizingLock/);
    expect(home).toMatch(/Idempotency-Key/);
    expect(home.match(/data-testid="save-dock"/g)).toHaveLength(1);
  });
});
