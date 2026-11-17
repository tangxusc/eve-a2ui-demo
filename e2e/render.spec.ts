import { expect, test } from "@playwright/test";
import { openApp, renderCoffeeSurface } from "./helpers";

test.describe("A2UI 渲染", () => {
  test("模型经工具调用产出界面，官方渲染器画出组件", async ({ page }) => {
    await openApp(page);
    const surface = await renderCoffeeSurface(page);

    await expect(surface).toHaveAttribute("data-surface-id", /\w+/);
    await expect(surface).toContainText("A2UI");
    await expect(surface).toContainText("App Catalog");

    // Components came from the catalog, not from markdown.
    await expect(surface.locator(".a2-card").first()).toBeVisible();
    await expect(surface.locator(".a2-text").first()).toBeVisible();
    await expect(surface.getByTestId("a2ui-button").first()).toBeVisible();
    await expect(page.getByTestId("assistant-text").first()).not.toBeEmpty();
  });

  test("协议面板展示 createSurface / updateComponents / updateDataModel", async ({ page }) => {
    await openApp(page);
    await renderCoffeeSurface(page);

    const entries = page.getByTestId("protocol-entry");
    await expect(entries).toHaveCount(3);
    await expect(page.getByTestId("protocol-count")).toHaveText("3");

    const panel = page.getByTestId("protocol-panel");
    await expect(panel).toContainText("createSurface");
    await expect(panel).toContainText("updateComponents");
    await expect(panel).toContainText("updateDataModel");

    await entries.first().locator("summary").click();
    const json = entries.first().locator(".protocol-json");
    await expect(json).toContainText('"version": "v0.9"');
    await expect(json).toContainText('"catalogId": "https://eve-a2ui.demo/catalog/app.json"');
  });
});
