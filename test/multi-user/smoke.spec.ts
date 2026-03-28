import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("app loads and shows Golf Caddy UI", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Golf Caddy/i);
  });
});
