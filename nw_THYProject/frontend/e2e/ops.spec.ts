import { test, expect } from "@playwright/test";

// HUB Kontrol / Operasyon paneli — board + KPI + drill-down.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("troya.onboarded", "1"); localStorage.setItem("troya.lang", "tr");
    localStorage.setItem("troya.user", "a.erdogan"); // admin → ops.view var
  });
});

test("HUB Kontrol paneli açılır: KPI + board + drill-down", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/ops");
  await expect(page.getByRole("heading", { name: "HUB Kontrol" })).toBeVisible();
  await expect(page.getByText("OTP / D0")).toBeVisible();
  await expect(page.getByText("Uçuş Board'u")).toBeVisible();
  await expect(page.getByText("Aktif Uyarılar")).toBeVisible();

  // bir uçuşa tıkla → drill-down (funnel + binmeyenler + milestone)
  await page.getByRole("button", { name: /TK712/ }).first().click();
  await expect(page.getByText("Yolcu akışı")).toBeVisible();
  await expect(page.getByText("Binmeyenler")).toBeVisible();
  await expect(page.getByText("A-CDM milestone")).toBeVisible();

  expect(errors).toEqual([]);
});

test("HUB Kontrol: board filtresi + uyarı kapatma", async ({ page }) => {
  await page.goto("/ops");
  await expect(page.getByText("Uçuş Board'u")).toBeVisible();

  // Riskli filtresine geç
  await page.getByRole("button", { name: /^Riskli/ }).click();
  await page.waitForTimeout(200);

  // İlk uyarıyı "Uygula" ile kapat → uyarı sayısı azalır
  const before = await page.getByRole("button", { name: /Uygula/ }).count();
  expect(before).toBeGreaterThan(0);
  await page.getByRole("button", { name: /Uygula/ }).first().click();
  await expect(page.getByText("İşlem uygulandı")).toBeVisible();
  await page.waitForTimeout(400);
  const after = await page.getByRole("button", { name: /Uygula/ }).count();
  expect(after).toBeLessThan(before);
});
