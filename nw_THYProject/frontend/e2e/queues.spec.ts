import { test, expect } from "@playwright/test";

// Kuyruklar — kayıtlardan türeyen iş listesi; o / n / d kısayolları.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("troya.onboarded", "1"); localStorage.setItem("troya.lang", "tr");
    localStorage.setItem("troya.user", "a.erdogan");
  });
});

test("sıradaki iş tamamlanır, sonraki öne gelir; TTL kuyruğundan PNR açılır", async ({ page }) => {
  await page.goto("/queues");
  const next = page.locator('[data-tour="queues.items"]');
  await expect(next.getByText("Sıradaki iş")).toBeVisible();
  const first = await next.locator(".num").first().textContent();

  await page.keyboard.press("n");
  await expect(page.getByText("İş tamamlandı")).toBeVisible();
  await expect(next.locator(".num").first()).not.toHaveText(first ?? "");

  await page.getByRole("button", { name: /Q8 Bilet kesim süresi/ }).click();
  await expect(next.getByText(/TTL/).first()).toBeVisible();
  await page.keyboard.press("o");
  await expect(page).toHaveURL(/\/res\/[A-Z0-9]{6}$/);
});

test("süresi dolan bilet geçerlilik kuyruğunda, iade önerisiyle görünür", async ({ page }) => {
  await page.goto("/queues");
  await page.getByRole("button", { name: /Q20 Geçerlilik/ }).click();
  await expect(page.getByText(/2356000001025 · geçerlilik doldu/)).toBeVisible();
  await expect(page.getByText(/yalnız iade edilebilir/).first()).toBeVisible();
});
