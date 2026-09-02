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

  test("connect page primary buttons stay in view on a Samsung-sized screen", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/connect");
    const billing = page.getByRole("button", { name: /Subscribe|Mag-subscribe|Manage Subscription|I-manage|Checking|Opening/i });
    const connect = page.getByRole("button", { name: /Connect Shopify|Ikonekta/i });
    await expect(billing).toBeVisible();
    await expect(connect).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});
