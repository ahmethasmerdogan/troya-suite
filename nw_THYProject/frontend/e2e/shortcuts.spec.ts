import { test, expect } from "@playwright/test";

// Bilet kaydında e / r / v kısayolları. Buton ipuçları ("Kısayol: e") ve ekran
// kılavuzu bunları vaat ediyordu ama v2 yeniden yazımında bağ kopmuştu.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("troya.onboarded", "1"); localStorage.setItem("troya.lang", "tr");
    localStorage.setItem("troya.user", "a.erdogan");
  });
});

test("e tuşu exchange akışını açar, Esc kapatır", async ({ page }) => {
  await page.goto("/tickets/2351234567890");
  await expect(page.getByRole("heading", { name: "2351234567890" })).toBeVisible();
  await page.keyboard.press("e");
  await expect(page.getByText("Eski bilet 2351234567890")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Eski bilet 2351234567890")).toBeHidden();
});

test("v tuşu void akışını açar", async ({ page }) => {
  await page.goto("/tickets/2351234567890");
  await expect(page.getByRole("heading", { name: "2351234567890" })).toBeVisible();
  await page.keyboard.press("v");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("kısayol, palet açıkken yazılan harfle tetiklenmez", async ({ page }) => {
  await page.goto("/tickets/2351234567890");
  await expect(page.getByRole("heading", { name: "2351234567890" })).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.keyboard.type("erv");
  await expect(page.getByText("Eski bilet 2351234567890")).toBeHidden();
});
