import { expect, type Page } from "@playwright/test";

export async function openApp(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("composer-input")).toBeVisible();
}

/** Asks for the coffee surface through the example chip and waits for A2UI to render. */
export async function renderCoffeeSurface(page: Page) {
  await page.getByTestId("example-prompt").filter({ hasText: "咖啡下单" }).click();
  const surface = page.getByTestId("a2ui-surface").first();
  await expect(surface).toBeVisible();
  return surface;
}

export async function sendMessage(page: Page, message: string): Promise<void> {
  await page.getByTestId("composer-input").fill(message);
  await page.getByTestId("composer-send").click();
}
