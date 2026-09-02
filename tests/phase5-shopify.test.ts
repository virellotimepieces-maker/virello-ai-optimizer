import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { issueAppSession } from "../app/api/_lib/app-session";
import {
  ProductAccessError,
  requirePaidProductAccess,
} from "../app/api/_lib/product-access";
import { normalizeShop } from "../app/api/_lib/shop-domain";
import { saveShopifySession } from "../app/api/_lib/shopify-auth";
import {
  setShopifyAdminFetchForTests,
  setShopifyAdminWaitForTests,
  shopifyAdminGraphql,
} from "../app/api/_lib/shopify-admin";
import { buildShopifyAuthorizeUrl, shopifyCallbackUrl } from "../app/api/_lib/shopify-oauth";
import {
  importProductPage,
  parseSaveProductInput,
  saveReviewedProduct,
  ShopifyProductError,
} from "../app/api/_lib/shopify-products";
import {
  hasRequiredShopifyScopes,
  missingShopifyScopes,
} from "../app/api/_lib/shopify-scopes";
import {
  createSignedOAuthState,
  parseSignedOAuthState,
  verifySignedOAuthState,
} from "../app/api/_lib/shopify-security";
import { applySubscriptionEvent } from "../app/api/_lib/stripe-events";
import { clearTestDatabase, usePglite } from "./helpers/pglite";

const SHOP = "store-alpha.myshopify.com";
const SECRET = "shopify-client-secret-value";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get(name: string) { return headers[name.toLowerCase()] ?? headers[name] ?? null; } },
    async text() {
      return JSON.stringify(body);
    },
  };
}

describe("Phase 5 shop domains and OAuth", () => {
  beforeEach(() => {
    process.env.APP_URL = "https://app.virello.example";
    process.env.SHOPIFY_API_KEY = "shopify-client-id";
    process.env.SHOPIFY_API_SECRET = SECRET;
  });

  it("accepts valid myshopify hosts and rejects others", () => {
    expect(normalizeShop("https://Store-One.myshopify.com/admin")).toBe(
      "store-one.myshopify.com"
    );
    expect(normalizeShop("a.myshopify.com")).toBe("a.myshopify.com");
    expect(normalizeShop("-bad.myshopify.com")).toBe("");
    expect(normalizeShop("bad-.myshopify.com")).toBe("");
    expect(normalizeShop("example.com")).toBe("");
  });

  it("builds a standalone authorize URL with APP_URL callback and signed state", () => {
    const built = buildShopifyAuthorizeUrl({ shop: SHOP, flow: "standalone" });
    const url = new URL(built.url);
    expect(url.origin).toBe(`https://${SHOP}`);
    expect(url.pathname).toBe("/admin/oauth/authorize");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.virello.example/api/auth/shopify/callback"
    );
    expect(url.searchParams.get("scope")).toContain("write_products");
    expect(verifySignedOAuthState(built.state, SHOP, SECRET)).toBe(true);
    expect(parseSignedOAuthState(built.state, SHOP, SECRET)?.flow).toBe("standalone");
    expect(shopifyCallbackUrl()).toBe(
      "https://app.virello.example/api/auth/shopify/callback"
    );
  });

  it("rejects forged, expired, and cross-shop OAuth state", () => {
    const state = createSignedOAuthState(SHOP, SECRET, "standalone");
    expect(verifySignedOAuthState(state, "other.myshopify.com", SECRET)).toBe(false);
    expect(verifySignedOAuthState(`${state}x`, SHOP, SECRET)).toBe(false);
    const payload = Buffer.from(
      JSON.stringify({
        shop: SHOP,
        timestamp: Date.now() - 11 * 60 * 1000,
        flow: "standalone",
      })
    ).toString("base64url");
    const signature = createHmac("sha256", SECRET).update(payload).digest("base64url");
    expect(verifySignedOAuthState(`${payload}.${signature}`, SHOP, SECRET)).toBe(false);
  });

  it("treats write_products as covering read, and rejects empty scopes", () => {
    expect(hasRequiredShopifyScopes("write_products")).toBe(true);
    expect(hasRequiredShopifyScopes("read_products,write_products")).toBe(true);
    expect(hasRequiredShopifyScopes("read_products")).toBe(false);
    expect(missingShopifyScopes("read_products")).toEqual(["write_products"]);
  });
});

describe("Phase 5 import, save, and access", () => {
  beforeEach(async () => {
    process.env.APP_URL = "https://app.virello.example";
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "x".repeat(32);
    process.env.SHOPIFY_API_KEY = "shopify-client-id";
    process.env.SHOPIFY_API_SECRET = SECRET;
    setShopifyAdminWaitForTests(async () => undefined);
    await usePglite();
  });

  afterEach(() => {
    setShopifyAdminFetchForTests(null);
    setShopifyAdminWaitForTests(null);
    clearTestDatabase();
  });

  async function paidInstalledShop(scope = "read_products,write_products") {
    await saveShopifySession(SHOP, "offline-token-alpha", scope);
    await applySubscriptionEvent({
      shop: SHOP,
      object: {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        current_period_start: 1_700_000_000,
        current_period_end: 1_702_592_000,
        livemode: false,
        metadata: { shop: SHOP },
        items: {
          data: [
            {
              price: { id: "price_monthly" },
              current_period_start: 1_700_000_000,
              current_period_end: 1_702_592_000,
            },
          ],
        },
      },
      eventCreated: 10,
      livemode: false,
    });
    const sessionId = await issueAppSession({ shop: SHOP });
    return new NextRequest("https://app.virello.example/api/shopify/products", {
      method: "GET",
      headers: { cookie: `virello_sid=${sessionId}` },
    });
  }

  it("retries Shopify 429s then returns a product page and cursor", async () => {
    let calls = 0;
    setShopifyAdminFetchForTests(async () => {
      calls += 1;
      if (calls === 1) {
        return jsonResponse({ errors: [{ message: "slow down" }] }, 429, {
          "retry-after": "0",
        });
      }
      return jsonResponse({
        data: {
          products: {
            pageInfo: { hasNextPage: true, endCursor: "cursor-2" },
            nodes: [
              {
                id: "gid://shopify/Product/1",
                title: "Gold watch",
                descriptionHtml: "<p>Swiss</p>",
                productType: "Watch",
                vendor: "Virello",
                status: "ACTIVE",
                tags: ["gold"],
                seo: { title: "Gold watch", description: "Swiss" },
                variants: { nodes: [{ price: "29.99" }] },
              },
            ],
          },
        },
      });
    });

    await saveShopifySession(SHOP, "offline-token-alpha", "write_products");
    const page = await importProductPage(SHOP, "offline-token-alpha", "");
    expect(calls).toBe(2);
    expect(page.products).toHaveLength(1);
    expect(page.pageInfo.endCursor).toBe("cursor-2");
    expect(page.products[0].title).toBe("Gold watch");
  });

  it("rejects unreviewed saves and requires confirmation", () => {
    expect(() => parseSaveProductInput({})).toThrow(ShopifyProductError);
    const input = parseSaveProductInput({ productId: "gid://shopify/Product/1", title: "X" });
    expect(input.confirmed).toBe(false);
  });

  it("saves only after explicit confirmation", async () => {
    setShopifyAdminFetchForTests(async (_url, init) => {
      const body = JSON.parse(String(init?.body || "{}")) as {
        variables?: { input?: { id?: string } };
      };
      expect(body.variables?.input?.id).toBe("gid://shopify/Product/1");
      return jsonResponse({
        data: {
          productUpdate: {
            product: { id: "gid://shopify/Product/1", title: "Gold watch" },
            userErrors: [],
          },
        },
      });
    });
    await saveShopifySession(SHOP, "offline-token-alpha", "write_products");
    await expect(
      saveReviewedProduct(SHOP, "offline-token-alpha", {
        productId: "gid://shopify/Product/1",
        title: "Gold watch",
        confirmed: false,
      })
    ).rejects.toThrow(/Review and approve/);
    const product = await saveReviewedProduct(SHOP, "offline-token-alpha", {
      productId: "gid://shopify/Product/1",
      title: "Gold watch",
      confirmed: true,
    });
    expect((product as { title?: string }).title).toBe("Gold watch");
  });

  it("denies import/save when product scopes are missing", async () => {
    const request = await paidInstalledShop("read_products");
    await expect(requirePaidProductAccess(request)).rejects.toBeInstanceOf(
      ProductAccessError
    );
    await expect(requirePaidProductAccess(request)).rejects.toMatchObject({
      status: 403,
      reason: "missing_scopes",
    });
  });

  it("allows paid installed shops with write_products", async () => {
    const request = await paidInstalledShop("read_products,write_products");
    const access = await requirePaidProductAccess(request);
    expect(access.shop).toBe(SHOP);
    expect(access.access.productAccess).toBe(true);
  });

  it("does not treat GraphQL throttle as success", async () => {
    setShopifyAdminFetchForTests(async () =>
      jsonResponse({
        errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }],
      })
    );
    await expect(
      shopifyAdminGraphql(SHOP, "token", "query { shop { name } }")
    ).rejects.toThrow(/rate/i);
  });

  it("removed localStorage shop authentication from the app", () => {
    const page = readFileSync("app/page.tsx", "utf8");
    const connect = readFileSync("app/connect/page.tsx", "utf8");
    expect(page).not.toMatch(/localStorage/);
    expect(connect).not.toMatch(/localStorage/);
    expect(page).not.toMatch(/virello_shopify_shop/);
    expect(existsSync("app/api/shopify/save-product/route.ts")).toBe(false);
    expect(existsSync("app/api/stores/products/route.ts")).toBe(false);
    expect(readFileSync("app/page.tsx", "utf8")).toMatch(/\/api\/shopify\/products/);
    expect(readFileSync("app/page.tsx", "utf8")).not.toMatch(/save-product/);
  });
});
