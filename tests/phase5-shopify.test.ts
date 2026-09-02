import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { issueAppSession } from "../app/api/_lib/app-session";
import {
  ProductAccessError,
  requirePaidProductAccess,
} from "../app/api/_lib/product-access";
import { isShopifyAdminAuthorizeUrl, normalizeShop, shopifyAdminAppHref } from "../app/api/_lib/shop-domain";
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
    async json() {
      return body;
    },
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
    expect(normalizeShop("gfd1cp-1v.myshopify.com")).toBe("gfd1cp-1v.myshopify.com");
    expect(normalizeShop("gfd1cp-1v")).toBe("gfd1cp-1v.myshopify.com");
    expect(normalizeShop("https://admin.shopify.com/store/gfd1cp-1v")).toBe(
      "gfd1cp-1v.myshopify.com"
    );
    expect(normalizeShop("-bad.myshopify.com")).toBe("");
    expect(normalizeShop("bad-.myshopify.com")).toBe("");
    expect(normalizeShop("example.com")).toBe("");
    expect(shopifyAdminAppHref("gfd1cp-1y.myshopify.com")).toBe(
      "https://admin.shopify.com/store/gfd1cp-1y/apps/virello-ai-optimizer?shop=gfd1cp-1y.myshopify.com"
    );
  });

  it("reports Shopify secret kind and length without exposing the secret", async () => {
    process.env.SHOPIFY_API_KEY = "99a9fda60d48cb24828f243360fffc40";
    process.env.SHOPIFY_API_SECRET = "shpss_xxxx-secret-value";
    const { GET } = await import("../app/api/auth/shopify/secret-status/route");
    const response = await GET();
    const body = (await response.json()) as {
      success?: boolean;
      secretKind?: string;
      secretLength?: number;
      looksLikeClientId?: boolean;
      clientId?: string;
    };
    expect(body.success).toBe(true);
    expect(body.secretKind).toBe("shpss");
    expect(body.secretLength).toBe("shpss_xxxx-secret-value".length);
    expect(body.looksLikeClientId).toBe(false);
    expect(body.clientId).toBe("99a9fda60d48cb24828f243360fffc40");
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/xxxx-secret-value/);
    expect(text).not.toMatch(/shpss_/);
  });

  it("rejects storefront roots and admin.shopify.com rewrites for gfd1cp-1v", () => {
    expect(
      isShopifyAdminAuthorizeUrl(
        "https://gfd1cp-1v.myshopify.com/admin/oauth/authorize?client_id=x"
      )
    ).toBe(true);
    expect(isShopifyAdminAuthorizeUrl("https://gfd1cp-1v.myshopify.com/")).toBe(
      false
    );
    expect(
      isShopifyAdminAuthorizeUrl(
        "https://admin.shopify.com/store/gfd1cp-1v/oauth/authorize?client_id=x&shop=gfd1cp-1v.myshopify.com"
      )
    ).toBe(false);
    const built = buildShopifyAuthorizeUrl({
      shop: "gfd1cp-1v.myshopify.com",
      flow: "standalone",
    });
    const url = new URL(built.url);
    expect(url.origin).toBe("https://gfd1cp-1v.myshopify.com");
    expect(url.pathname).toBe("/admin/oauth/authorize");
    expect(built.url).not.toContain("admin.shopify.com/store/");
  });

  it("builds a standalone authorize URL with APP_URL callback and signed state", () => {
    const built = buildShopifyAuthorizeUrl({ shop: SHOP, flow: "standalone" });
    const url = new URL(built.url);
    expect(url.origin).toBe(`https://${SHOP}`);
    expect(url.pathname).toBe("/admin/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("shopify-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.virello.example/api/auth/shopify/callback"
    );
    expect(url.searchParams.get("scope")).toContain("write_products");
    expect(verifySignedOAuthState(built.state, SHOP, SECRET)).toBe(true);
    expect(parseSignedOAuthState(built.state, SHOP, SECRET)?.flow).toBe("standalone");
    expect(shopifyCallbackUrl()).toBe(
      "https://app.virello.example/api/auth/shopify/callback"
    );
    expect(isShopifyAdminAuthorizeUrl(built.url)).toBe(true);
    expect(built.url).not.toContain("admin.shopify.com/store/");
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
    expect(page.products[0].handle).toBe("");
    expect(page.products[0].variants[0]).toContain("29.99");
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
    expect(page).toMatch(/Accept:\s*"application\/json"/);
    expect(connect).toMatch(/Accept:\s*"application\/json"/);
    expect(page).toMatch(/isShopifyAdminAuthorizeUrl/);
    expect(connect).toMatch(/isShopifyAdminAuthorizeUrl/);
  });
});

describe("Phase 5 OAuth start for development shops", () => {
  beforeEach(async () => {
    process.env.APP_URL = "https://app.virello.example";
    process.env.SHOPIFY_API_KEY = "shopify-client-id";
    process.env.SHOPIFY_API_SECRET = SECRET;
    await usePglite();
  });

  afterEach(() => {
    clearTestDatabase();
  });

  it("returns a Shopify authorize URL for gfd1cp-1v.myshopify.com", async () => {
    const { GET } = await import("../app/api/auth/shopify/route");
    const request = new NextRequest(
      "https://app.virello.example/api/auth/shopify?shop=gfd1cp-1v.myshopify.com&flow=standalone",
      { headers: { accept: "application/json" } }
    );
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; shop?: string; url?: string };
    expect(body.success).toBe(true);
    expect(body.shop).toBe("gfd1cp-1v.myshopify.com");
    const url = new URL(body.url || "");
    expect(url.origin).toBe("https://gfd1cp-1v.myshopify.com");
    expect(url.pathname).toBe("/admin/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("shopify-client-id");
    expect(url.searchParams.get("scope")).toContain("write_products");
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.virello.example/api/auth/shopify/callback"
    );
    expect(isShopifyAdminAuthorizeUrl(body.url || "")).toBe(true);
    expect(body.url).not.toContain("admin.shopify.com/store/");
  });

  it.each(["gfd1cp-1v.myshopify.com", "bcya1v-xp.myshopify.com"])(
    "sets Location to %s/admin/oauth/authorize, never admin.shopify.com/store",
    async (shop) => {
      const { GET } = await import("../app/api/auth/shopify/route");
      const request = new NextRequest(
        `https://app.virello.example/api/auth/shopify?shop=${shop}&flow=standalone`,
        { headers: { accept: "text/html" } }
      );
      const response = await GET(request);
      expect(response.status).toBe(307);
      const location = response.headers.get("location") || "";
      const url = new URL(location);
      expect(url.origin).toBe(`https://${shop}`);
      expect(url.pathname).toBe("/admin/oauth/authorize");
      expect(url.searchParams.get("client_id")).toBe("shopify-client-id");
      expect(url.searchParams.get("scope")).toBe("read_products,write_products");
      expect(url.searchParams.get("state")).toBeTruthy();
      expect(url.searchParams.get("redirect_uri")).toBe(
        "https://app.virello.example/api/auth/shopify/callback"
      );
      expect(location).toContain(`https://${shop}/admin/oauth/authorize`);
      expect(location).not.toContain("admin.shopify.com/store/");
    }
  );

  it("accepts the shop handle without the myshopify suffix", async () => {
    const { GET } = await import("../app/api/auth/shopify/route");
    const request = new NextRequest(
      "https://app.virello.example/api/auth/shopify?shop=gfd1cp-1v&flow=standalone",
      { headers: { accept: "application/json" } }
    );
    const response = await GET(request);
    const body = (await response.json()) as { shop?: string; url?: string };
    expect(response.status).toBe(200);
    expect(body.shop).toBe("gfd1cp-1v.myshopify.com");
    expect(body.url).toContain("https://gfd1cp-1v.myshopify.com/admin/oauth/authorize");
    expect(body.url).not.toContain("admin.shopify.com/store/");
    expect(isShopifyAdminAuthorizeUrl(body.url || "")).toBe(true);
  });

  it("returns a visible JSON error for an invalid shop", async () => {
    const { GET } = await import("../app/api/auth/shopify/route");
    const request = new NextRequest(
      "https://app.virello.example/api/auth/shopify?shop=example.com&flow=standalone",
      { headers: { accept: "application/json" } }
    );
    const response = await GET(request);
    expect(response.status).toBe(400);
    const body = (await response.json()) as { success: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/Invalid Shopify store/i);
  });

  it("builds the official authorize URL for gfd1cp-1y.myshopify.com", async () => {
    const { GET } = await import("../app/api/auth/shopify/route");
    const request = new NextRequest(
      "https://app.virello.example/api/auth/shopify?shop=gfd1cp-1y.myshopify.com&flow=standalone",
      { headers: { accept: "application/json" } }
    );
    const response = await GET(request);
    const body = (await response.json()) as { success: boolean; url?: string; shop?: string };
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.shop).toBe("gfd1cp-1y.myshopify.com");
    const url = new URL(body.url || "");
    expect(url.origin).toBe("https://gfd1cp-1y.myshopify.com");
    expect(url.pathname).toBe("/admin/oauth/authorize");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.virello.example/api/auth/shopify/callback"
    );
    expect(body.url).not.toContain("admin.shopify.com/store/");
  });

  it("declares legacy install flow so standalone authorization-code grant is allowed", () => {
    const toml = readFileSync("shopify.app.toml", "utf8");
    expect(toml).toMatch(/\[access_scopes\][\s\S]*use_legacy_install_flow\s*=\s*true/);
    expect(toml).toMatch(
      /https:\/\/virello-ai-optimizer\.vercel\.app\/api\/auth\/shopify\/callback/
    );
    expect(toml).not.toMatch(/use_legacy_install_flow\s*=\s*false/);
    expect(toml).toMatch(/compliance_topics\s*=\s*\[[^\]]*customers\/data_request/);
  });
});

describe("Phase 5 OAuth callback errors", () => {
  beforeEach(() => {
    process.env.APP_URL = "https://app.virello.example";
    process.env.SHOPIFY_API_KEY = "shopify-client-id";
    process.env.SHOPIFY_API_SECRET = SECRET;
  });

  it("surfaces Shopify Unauthorized Access after a valid callback HMAC", async () => {
    const shop = "gfd1cp-1y.myshopify.com";
    const params = new URLSearchParams({
      error: "access_denied",
      error_description: "Unauthorized Access",
      shop,
      state: createSignedOAuthState(shop, SECRET, "standalone"),
      timestamp: "1700000000",
    });
    const message = [...params.entries()]
      .filter(([key]) => key !== "hmac")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    params.set("hmac", createHmac("sha256", SECRET).update(message).digest("hex"));
    const { GET } = await import("../app/api/auth/shopify/callback/route");
    const response = await GET(
      new NextRequest(`https://app.virello.example/api/auth/shopify/callback?${params}`)
    );
    expect(response.status).toBe(307);
    const location = response.headers.get("location") || "";
    expect(location).toContain("/connect");
    expect(location).toMatch(/Unauthorized(\+|%20)Access/);
  });

  it("rejects a callback with a forged HMAC when Shopify also rejects the code", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      jsonResponse({ error: "invalid_client" }, 401)) as unknown as typeof fetch;
    try {
      const params = new URLSearchParams({
        code: "auth-code",
        shop: "gfd1cp-1y.myshopify.com",
        state: createSignedOAuthState("gfd1cp-1y.myshopify.com", SECRET, "standalone"),
        hmac: "0".repeat(64),
      });
      const { GET } = await import("../app/api/auth/shopify/callback/route");
      const response = await GET(
        new NextRequest(`https://app.virello.example/api/auth/shopify/callback?${params}`)
      );
      const location = response.headers.get("location") || "";
      expect(location).toMatch(
        /signature(\+|%20)is(\+|%20)invalid|does(\+|%20)not(\+|%20)match(\+|%20)this(\+|%20)Shopify(\+|%20)app/i
      );
      expect(location).toMatch(/oauth_diag=/);
      expect(location).toMatch(/inmsg=|inmsg%3D/);
      expect(location).toMatch(/token=client|token%3Dclient/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("tells the merchant when SHOPIFY_API_SECRET is the Client ID", async () => {
    process.env.SHOPIFY_API_KEY = "99a9fda60d48cb24828f243360fffc40";
    process.env.SHOPIFY_API_SECRET = "99a9fda60d48cb24828f243360fffc40";
    const params = new URLSearchParams({
      code: "0907a61c0c8d55e99db179b68161bc00",
      hmac: "0".repeat(64),
      host: "YWRtaW4uc2hvcGlmeS5jb20vc3RvcmUvZ2ZkMWNwLTF5",
      shop: "gfd1cp-1y.myshopify.com",
      state: "0.6784241404160823",
      timestamp: "1337178173",
    });
    const { GET } = await import("../app/api/auth/shopify/callback/route");
    const response = await GET(
      new NextRequest(`https://app.virello.example/api/auth/shopify/callback?${params}`)
    );
    const location = response.headers.get("location") || "";
    expect(location).toMatch(/Client(\+|%20)ID/);
    expect(location).toMatch(/secret=id|secret%3Did/);
  });

  it("keeps the shop disconnected when Shopify sends no callback HMAC", async () => {
    const { GET } = await import("../app/api/auth/shopify/callback/route");
    const response = await GET(
      new NextRequest(
        "https://app.virello.example/api/auth/shopify/callback?shop=gfd1cp-1y.myshopify.com&error=access_denied"
      )
    );
    const location = response.headers.get("location") || "";
    expect(location).toContain("/connect");
    expect(location).toMatch(/cancelled|did(\+|%20)not(\+|%20)complete/i);
    expect(location).not.toMatch(/connected=1/);
  });

  it("forwards the legacy callback path with Shopify's raw query string", async () => {
    const { GET } = await import("../app/api/auth/callback/route");
    const raw =
      "code=auth-code&hmac=abc&host=YWRtaW4uc2hvcGlmeS5jb20vc3RvcmUvZ2ZkMWNwLTF5%3D&shop=gfd1cp-1y.myshopify.com";
    const response = await GET(
      new NextRequest(`https://app.virello.example/api/auth/callback?${raw}`)
    );
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    const location = response.headers.get("location") || "";
    const forwarded = new URL(location);
    expect(forwarded.pathname).toBe("/api/auth/shopify/callback");
    expect(forwarded.search).toBe(`?${raw}`);
  });
});
