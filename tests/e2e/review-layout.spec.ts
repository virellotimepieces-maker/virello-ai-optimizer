import { expect, test } from "@playwright/test";

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

function overlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) {
  return !(
    a.y + a.height <= b.y + 1 ||
    b.y + b.height <= a.y + 1 ||
    a.x + a.width <= b.x + 1 ||
    b.x + b.width <= a.x + 1
  );
}

test.describe("review approval layout", () => {
  test("shows one in-flow approval dock that does not cover fields", async ({ page }, testInfo) => {
    const width = testInfo.project.name === "mobile" ? 390 : 1280;
    const height = testInfo.project.name === "mobile" ? 844 : 800;
    await page.setViewportSize({ width, height });
    await page.goto("/?e2eReview=1");

    await expect(page.getByTestId("brand-voice")).toHaveValue("refined");
    await expect(page.getByTestId("save-dock")).toHaveCount(1);
    await expect(page.getByTestId("save-shopify")).toHaveCount(1);
    const save = page.getByTestId("save-shopify");
    await expect(save).toBeDisabled();
    await expect(page.getByTestId("merchant-insights")).toBeVisible();
    await expect(page.getByTestId("merchant-insights")).toContainText(/not saved to Shopify/i);

    const title = page.locator("#opt-title");
    await expect(title).toBeVisible();
    await title.fill(
      "Pagani Design PD-1701 Stainless Steel Quartz Chronograph Watch With Sapphire Crystal And A Very Long Editable Title"
    );
    const titleBox = await title.boundingBox();
    expect(titleBox).not.toBeNull();
    expect(titleBox!.x).toBeGreaterThanOrEqual(-1);
    expect(titleBox!.x + titleBox!.width).toBeLessThanOrEqual(width + 1);

    const fields = ["#opt-title", "#opt-description", "#opt-conversion", "#an-customer", "#an-missing"];
    for (const selector of fields) {
      const field = page.locator(selector);
      await field.scrollIntoViewIfNeeded();
      const fieldBox = await field.boundingBox();
      const dockBox = await page.getByTestId("save-dock").boundingBox();
      expect(fieldBox).not.toBeNull();
      expect(dockBox).not.toBeNull();
      expect(overlap(fieldBox!, dockBox!)).toBe(false);
    }

    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeVisible();
    const saveBox = await save.boundingBox();
    expect(saveBox).not.toBeNull();
    expect(saveBox!.y).toBeGreaterThanOrEqual(0);
    expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual(height + 1);

    await page.getByTestId("approve-save").check();
    await expect(save).toBeEnabled();
    await assertNoHorizontalOverflow(page);
  });
});
