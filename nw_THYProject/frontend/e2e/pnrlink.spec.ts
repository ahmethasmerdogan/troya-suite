import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("troya.onboarded", "1"); localStorage.setItem("troya.lang", "tr"); localStorage.setItem("troya.user", "a.erdogan"); });
});

// QuickRes ↔ Troya bağı — rezervasyondan kesime, uygunluktan rezervasyona.
test.describe("Rezervasyon → bilet", () => {
  test("PNR'dan Bilet Kes formu yolcu ve seferle dolu açılır", async ({ page }) => {
    await page.goto("/res/TR8N1P");
    await page.getByRole("button", { name: /Bilet Kes/i }).click();

    await expect(page).toHaveURL(/\/issue\?pnr=TR8N1P/);
    await expect(page.getByText(/TR8N1P rezervasyonundan dolduruldu/)).toBeVisible();

    // Yolcu adımı PNR'daki yolcuyla dolu geldi.
    await expect(page.getByRole("textbox", { name: /Soyadı/ })).toHaveValue("DEMIR");

    // Sefer adımında rezervasyondaki uçuş seçili ve işaretli.
    await page.getByRole("button", { name: "İleri" }).click();
    await expect(page.getByText(/Rezervasyonda onaylı/)).toBeVisible();
  });

  test("uygunluk sorgusunda sınıfa tıklayınca rezervasyon formu o seferle açılır", async ({ page }) => {
    await page.goto("/res/availability");
    await page.locator("input[type=date]").fill("2026-09-10");
    await page.getByRole("button", { name: "Ara", exact: true }).click();

    await page.getByRole("button", { name: /Economy/ }).first().click();
    await expect(page).toHaveURL(/\/res\/new\?/);
    await expect(page.getByText(/Uygunluk sorgusundan gelindi/)).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Uçuş No/ })).toHaveValue("198");
  });
});
