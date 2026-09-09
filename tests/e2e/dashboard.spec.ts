import { expect, test } from "@playwright/test";

test.describe("Virello dashboard", () => {
  test("standalone home shows Subscribe, Connect, and Live", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Subscribe|Checking/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "FIL" })).toHaveCount(0);
    await expect(page.getByTestId("live-badge")).toHaveText("Live");
    await expect(page.getByTestId("store-binding-status")).toContainText("Not connected yet");
    await expect(page.locator("body")).not.toContainText(/content clinic|Framer|prompt clinic/i);
    await expect(page.getByRole("heading", { name: /Optimize Shopify products with AI/i })).toBeVisible();
    await expect(page.getByTestId("brand-voice")).toHaveValue("refined");
    await expect(page.getByTestId("product-facts")).toBeVisible();
    await expect(page.getByTestId("product-facts")).toContainText(/Optional/i);
  });

  test("connect page is reachable from standalone", async ({ page }) => {
    await page.goto("/connect");
    await expect(page.getByRole("button", { name: /Subscribe|Manage Subscription|Checking/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "FIL" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Connect your Shopify store/i })).toBeVisible();
  });

  test("embedded Admin host authenticates before merchant controls", async ({ page }) => {
    await page.route("https://cdn.shopify.com/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "window.shopify = window.shopify || {};",
      });
    });
    await page.goto("/?embedded=1&shop=demo-store.myshopify.com");
    await expect(page).not.toHaveURL(/admin\.shopify\.com|accounts\.shopify\.com/);
    await expect(page.getByPlaceholder(/your-store.myshopify.com/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Connect Shopify/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Import Products/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Subscribe|Checking|Manage Subscription/i })).toBeVisible({
      timeout: 8_000,
    });
  });

  test("embedded handshake failure unblocks Subscribe without a Connect field", async ({ page }) => {
    await page.goto("/?embedded=1&shop=demo-store.myshopify.com");
    await expect(page).not.toHaveURL(/admin\.shopify\.com|accounts\.shopify\.com/);
    await expect(page.getByRole("button", { name: /Subscribe|Checking|Manage Subscription/i })).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.getByRole("button", { name: /Connect Shopify/i })).toHaveCount(0);
    await expect(page.getByTestId("embedded-open-admin")).toBeVisible();
  });

  test("Subscribe becomes Manage when the shop can manage billing", async ({ page }) => {
    await page.route("**/api/subscriber/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          active: true,
          canManage: true,
          shopInstalled: true,
          shop: "gfd1cp-1y.myshopify.com",
          billedShop: "gfd1cp-1y.myshopify.com",
          pendingShop: null,
          canReplaceShop: false,
          billingTest: true,
          live: false,
          usage: { used: 3, limit: 1000, remaining: 997 },
          reason: "ok",
        }),
      });
    });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Manage Subscription" })).toBeVisible();
    await expect(page.getByTestId("live-badge")).toHaveText("Test");
    await expect(page.getByTestId("test-mode-banner")).toBeVisible();
    await expect(page.getByRole("link", { name: "Privacy" })).toBeVisible();
  });

  test("privacy policy is public", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
    await expect(page.locator("body")).toContainText("shop/redact");
  });
});
