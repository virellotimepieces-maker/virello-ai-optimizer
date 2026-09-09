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
  });

  test("connect page is reachable from standalone", async ({ page }) => {
    await page.goto("/connect");
    await expect(page.getByRole("button", { name: /Subscribe|Manage Subscription|Checking/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "FIL" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Connect your Shopify store/i })).toBeVisible();
  });

  test("embedded shop query authenticates before merchant controls", async ({ page }) => {
    await page.goto("/?embedded=1&shop=gfd1cp-1y.myshopify.com");
    await expect(page).not.toHaveURL(/admin\.shopify\.com|accounts\.shopify\.com/);
    await expect(page.getByTestId("embedded-authenticating")).toBeVisible();
    await expect(page.getByRole("button", { name: /Connect Shopify/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Import Products/i })).toHaveCount(0);
    await expect(page.locator(".shop-input")).toHaveCount(0);
  });
});
