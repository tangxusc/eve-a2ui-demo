import { expect, test } from "@playwright/test";
import { openApp, renderCoffeeSurface } from "./helpers";

test.describe("界面交互回传", () => {
  test("点击界面按钮后动作回到 Agent，界面原地更新", async ({ page }) => {
    await openApp(page);
    const surface = await renderCoffeeSurface(page);
    const before = await surface.innerText();

    const actionButton = surface.getByRole("button", { name: /下单|提交|确认/ }).first();
    await expect(actionButton).toBeVisible();
    const actionLabel = (await actionButton.innerText()).trim();
    await actionButton.click();

    const chip = page.getByTestId("action-chip");
    await expect(chip).toBeVisible();
    await expect(chip).toContainText("点击了界面按钮");
    await expect(chip).toContainText(/[a-z]+_[a-z_]+/);

    await expect(page.getByTestId("surface-updated").first()).toBeVisible();
    await expect
      .poll(async () => surface.innerText(), { timeout: 120_000 })
      .not.toBe(before);
    await expect(surface).toContainText(/已下单|取餐|已支付|已完成|成功/);

    // The same surface is updated in place: one card, one surface id.
    await expect(page.getByTestId("a2ui-surface")).toHaveCount(1);
    expect(actionLabel.length).toBeGreaterThan(0);
  });

  test("后续文字指令也走 update_ui 更新同一个界面", async ({ page }) => {
    await openApp(page);
    const surface = await renderCoffeeSurface(page);

    await page.getByTestId("composer-input").fill("把杯型换成大杯，并加奶。");
    await page.getByTestId("composer-send").click();

    await expect(page.getByTestId("surface-updated").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /大杯/ }).first(),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("a2ui-surface")).toHaveCount(1);
    await expect(surface).toContainText("大杯");
  });
});
