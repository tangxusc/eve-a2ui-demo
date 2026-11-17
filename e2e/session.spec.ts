import { expect, test } from "@playwright/test";
import { openApp, renderCoffeeSurface, sendMessage } from "./helpers";

test.describe("会话控制与指令边界", () => {
  test("概念问题只回文字，不产生界面", async ({ page }) => {
    await openApp(page);
    await sendMessage(page, "A2UI 是什么？一句话回答，不要画界面。");

    await expect(page.getByTestId("assistant-text").first()).toBeVisible();
    await expect(page.getByTestId("assistant-text").first()).not.toBeEmpty();
    await expect(page.getByTestId("a2ui-surface")).toHaveCount(0);
    await expect(page.getByTestId("protocol-count")).toHaveText("0");
  });

  test("新对话清空消息、界面与协议流", async ({ page }) => {
    await openApp(page);
    await renderCoffeeSurface(page);
    await expect(page.getByTestId("protocol-entry")).toHaveCount(3);

    await page.getByRole("button", { name: "新对话" }).click();

    await expect(page.getByRole("heading", { name: "让 Agent 画界面，而不是写字" })).toBeVisible();
    await expect(page.getByTestId("a2ui-surface")).toHaveCount(0);
    await expect(page.getByTestId("user-message")).toHaveCount(0);
    await expect(page.getByTestId("protocol-count")).toHaveText("0");
  });
});
