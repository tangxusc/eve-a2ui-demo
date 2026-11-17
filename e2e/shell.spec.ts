import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

test.describe("聊天外壳", () => {
  test("首屏展示品牌、示例与协议面板空态", async ({ page }) => {
    await openApp(page);

    const header = page.getByTestId("app-header");
    await expect(header).toBeVisible();
    await expect(header).toContainText("eve × A2UI");
    await expect(header).toContainText("deepseek-v4-flash");
    await expect(page.getByTestId("agent-status")).toContainText("就绪");

    await expect(page.getByRole("heading", { name: "让 Agent 画界面，而不是写字" })).toBeVisible();
    await expect(page.getByTestId("example-prompt")).toHaveCount(4);

    await expect(page.getByTestId("protocol-count")).toHaveText("0");
    await expect(page.getByTestId("protocol-panel")).toContainText("模型还没有发出界面消息");
  });

  test("输入框按状态启用发送按钮", async ({ page }) => {
    await openApp(page);

    const send = page.getByTestId("composer-send");
    const input = page.getByTestId("composer-input");
    await expect(send).toBeDisabled();

    await input.fill("画一个界面");
    await expect(send).toBeEnabled();

    await input.fill("   ");
    await expect(send).toBeDisabled();
  });

  test("窄屏下隐藏协议面板并保持输入可用", async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 900 });
    await openApp(page);

    await expect(page.getByTestId("protocol-panel")).toBeHidden();
    await expect(page.getByTestId("composer-input")).toBeVisible();
  });
});
