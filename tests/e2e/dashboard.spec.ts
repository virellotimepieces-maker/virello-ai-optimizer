import { expect, test } from "@playwright/test";

test.describe("Virello dashboard", () => {
  test("standalone home shows Subscribe, Connect, and FIL/EN", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Subscribe|Mag-subscribe|Checking/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "FIL" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Connect Shopify|Ikonekta/i })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/content clinic|Framer|prompt clinic/i);
    await page.getByRole("button", { name: "FIL" }).first().click();
    await expect(page.getByRole("heading", { name: /I-optimize ang Shopify/i })).toBeVisible();
  });

  test("connect page is reachable from standalone", async ({ page }) => {
    await page.goto("/connect");
    await expect(page.getByRole("button", { name: /Subscribe|Manage Subscription/i })).toBeVisible();
  });

  test("embedded query string still renders the optimizer shell", async ({ page }) => {
    await page.goto("/?embedded=1");
    await expect(page.locator(".brand-name")).toContainText("Virello AI Optimizer");
    await expect(page.getByRole("button", { name: /Import|Mag-import/i })).toBeVisible();
  });
});
