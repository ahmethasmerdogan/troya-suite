import { test, expect } from "@playwright/test";

// EMD retrieval / Satış raporu / Order arama / ⌘K birleşik retrieval (2026-07-12 ek).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("troya.onboarded", "1"); localStorage.setItem("troya.lang", "tr"); localStorage.setItem("troya.user", "a.erdogan"); });
});

test.describe("EMD retrieval", () => {
  test("EMD arama sayfası açılır, listeden EMD detayına gidilir", async ({ page }) => {
    await page.goto("/emds");
    await expect(page.getByRole("heading", { name: "EMD Ara" })).toBeVisible();
    // EMD tablosunda en az bir satır (13-hane EMD no mono hücre).
    const emdCell = page.locator("table tbody tr td").filter({ hasText: /^\d{13}$/ }).first();
    await expect(emdCell).toBeVisible({ timeout: 10_000 });
    await emdCell.click();
    // EMD detay: /emds/<13hane> + "Belge Bilgisi" kartı.
    await expect(page).toHaveURL(/\/emds\/\d{13}/);
    await expect(page.getByText("Belge Bilgisi")).toBeVisible();
    await expect(page.getByText("Kuponlar")).toBeVisible();
  });

  test("EMD RFISC ile aranınca sonuç filtrelenir", async ({ page }) => {
    await page.goto("/emds");
    await page.getByPlaceholder(/EMD no/).fill("0CC");
    // Filtreli sonuçta Fazla Bagaj hizmeti görünür.
    await expect(page.getByText("Fazla Bagaj 23kg").first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Satış / İşlem raporu", () => {
  test("rapor açılır, işlemler ve özet görünür", async ({ page }) => {
    await page.goto("/report");
    await expect(page.getByRole("heading", { name: "Satış / İşlem Raporu" })).toBeVisible();
    await expect(page.getByText(/Toplam/)).toBeVisible();
    // İşlem tablosunda en az bir satır (event-sourced history'den türetilen).
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Order arama", () => {
  test("order sayfasında arama çubuğu görünür", async ({ page }) => {
    await page.goto("/orders");
    await expect(page.getByPlaceholder(/Order ID/)).toBeVisible();
  });
});
