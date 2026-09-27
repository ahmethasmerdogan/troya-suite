import { test, expect } from "@playwright/test";

// Tarife değişikliği → Q7 kuyruğu → bilet → yolcu bilgilendirildi (TK → HK).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("troya.onboarded", "1"); localStorage.setItem("troya.lang", "tr");
    localStorage.setItem("troya.user", "a.erdogan");
  });
});

test("sefer saati toplu değişir, iş Q7'ye düşer, yolcu bilgilendirilince kupon HK olur", async ({ page }) => {
  await page.goto("/schedule-change");
  await page.locator('[data-tour="skchg.flights"] button[aria-label]').first().click();
  await expect(page.getByText(/Zorunlu değişiklik/)).toBeVisible();
  await page.getByRole("button", { name: /bilete uygula/ }).click();
  await expect(page.getByText(/bilet güncellendi/).first()).toBeVisible();

  await page.getByRole("button", { name: "Q7 kuyruğunu aç" }).click();
  await page.getByRole("button", { name: /Q7 Tarife değişikliği/ }).click();
  await expect(page.getByText(/tarife değişikliği/).first()).toBeVisible();
  await page.keyboard.press("o");

  const ack = page.getByRole("button", { name: /Yolcu bilgilendirildi/ });
  await expect(ack).toBeVisible();
  await expect(page.getByText(/INVOL SKCHG/).first()).toBeVisible();
  await ack.click();
  await expect(page.getByText("Kupon HK'ya döndü")).toBeVisible();
  await expect(ack).toHaveCount(0);
});
