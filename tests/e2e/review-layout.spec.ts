import { expect, test } from "@playwright/test";

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("review approval layout", () => {
  test("shows one approval dock, keeps Save disabled, and leaves fields usable", async ({
    page,
  }, testInfo) => {
    const width = testInfo.project.name === "mobile" ? 390 : 1280;
    const height = testInfo.project.name === "mobile" ? 844 : 800;
    await page.setViewportSize({ width, height });
    await page.goto("/?e2eReview=1");

    await expect(page.getByTestId("save-dock")).toHaveCount(1);
    await expect(page.getByTestId("save-shopify")).toHaveCount(1);
    const save = page.getByTestId("save-shopify");
    await expect(save).toBeDisabled();

    const title = page.locator("#opt-title");
    await expect(title).toBeVisible();
    await title.fill(
      "Pagani Design PD-1701 Stainless Steel Quartz Chronograph Watch With Sapphire Crystal And A Very Long Editable Title"
    );
    await expect(title).toHaveValue(/Pagani Design PD-1701/);

    const titleBox = await title.boundingBox();
    expect(titleBox).not.toBeNull();
    expect(titleBox!.x).toBeGreaterThanOrEqual(-1);
    expect(titleBox!.x + titleBox!.width).toBeLessThanOrEqual(width + 1);

    const conversion = page.locator("#opt-conversion");
    await conversion.evaluate((el) => {
      const dock = document.querySelector('[data-testid="save-dock"]');
      const extra = dock instanceof HTMLElement ? dock.getBoundingClientRect().height + 24 : 180;
      el.scrollIntoView({ block: "end" });
      window.scrollBy(0, extra);
    });
    const conversionBox = await conversion.boundingBox();
    const dockBox = await page.getByTestId("save-dock").boundingBox();
    expect(conversionBox).not.toBeNull();
    expect(dockBox).not.toBeNull();
    expect(conversionBox!.y + 24).toBeLessThanOrEqual(dockBox!.y + 1);

    await page.getByTestId("approve-save").check();
    await expect(save).toBeEnabled();
    await expect(page.locator("#opt-description")).toBeVisible();
    await expect(page.locator("#opt-tags")).toBeVisible();
    await expect(page.locator("#opt-keywords")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});
