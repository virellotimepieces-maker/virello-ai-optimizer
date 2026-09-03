import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { width: 320, height: 720 },
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 412, height: 892 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
] as const;

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("responsive layout", () => {
  for (const viewport of VIEWPORTS) {
    test(`home fits ${viewport.width}px without clipping primary controls`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      const subscribe = page.getByRole("button", { name: /Subscribe|Mag-subscribe|Checking|Manage Subscription|I-manage/i });
      const connect = page.getByRole("button", { name: /Connect Shopify|Ikonekta/i });
      const en = page.getByRole("button", { name: "EN" }).first();
      const fil = page.getByRole("button", { name: "FIL" }).first();
      await expect(subscribe).toBeVisible();
      await expect(connect).toBeVisible();
      await expect(en).toBeVisible();
      await expect(fil).toBeVisible();
      for (const button of [subscribe, connect, en, fil]) {
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(40);
        expect(box!.x).toBeGreaterThanOrEqual(-1);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
      }
      await assertNoHorizontalOverflow(page);
    });
  }

  test("connect OAuth diagnostic wraps on a 360px screen instead of overflowing", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(
      "/connect?status=error&error_description=Shopify+authorization+signature+is+invalid.&oauth_diag=keys%3Dcode%2Chmac%2Chost%2Cshop%2Cstate%2Ctimestamp%7Chmac%3D64hex%7Csecrets%3D38%7Chost%3Db64%3A44%7Cstate%3D204%7Ccode%3D32%7Cmsgs%3D12%7Cinvoke%3D0"
    );
    const diag = page.getByTestId("oauth-diag");
    await expect(diag).toBeVisible();
    await expect(diag).toContainText("keys=code,hmac,host,shop,state,timestamp");
    const box = await diag.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(361);
    await assertNoHorizontalOverflow(page);
  });

  test("connect page primary buttons stay in view on a Samsung-sized screen", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/connect");
    const billing = page.getByRole("button", { name: /Subscribe|Mag-subscribe|Manage Subscription|I-manage|Checking|Opening/i });
    const connect = page.getByRole("button", { name: /Connect Shopify|Ikonekta/i });
    await expect(billing).toBeVisible();
    await expect(connect).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test("HMAC error shows retry help and Admin CTA without overflow", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(
      "/connect?status=error&error_description=Shopify+authorization+signature+is+invalid.&shop=gfd1cp-1y.myshopify.com"
    );
    await expect(page.getByTestId("hmac-retry-help")).toBeVisible();
    await expect(page.getByTestId("open-shopify-admin-top")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test("Open in Shopify Admin stays on-screen for a pending store", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/connect?shop=gfd1cp-1y.myshopify.com");
    const admin = page.getByTestId("open-shopify-admin");
    await expect(admin).toBeVisible();
    await expect(admin).toHaveText(/Shopify Admin/);
    await expect(page.getByTestId("domain-hint")).toContainText("gfd1cp-1y vs gfd1cp-1v");
    await assertNoHorizontalOverflow(page);
  });
});
