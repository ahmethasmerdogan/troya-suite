import { test, expect } from "@playwright/test";

// Regresyon — exchange'de kalkış tarihini düzenleyince "Invalid time value" hatası fırlamamalı;
// drawer kapanmalı ve başarı toast'ı gelmeli (önceki bug: datetime boş/yarım değer onChange'i patlatıyordu).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("troya.onboarded", "1"); localStorage.setItem("troya.lang", "tr");
    localStorage.setItem("troya.user", "a.erdogan");
  });
});

test("exchange: ?flow ile açılan drawer kapatılabilir (reopen bug regresyonu)", async ({ page }) => {
  // Sidebar İşlemler yolu (?flow=exchange) ile gelince drawer açılır; kapatınca tekrar açılmamalı.
  await page.goto("/tickets/2351234567890?flow=exchange");
  await expect(page.getByText("Eski bilet 2351234567890")).toBeVisible();
  // flow param URL'den temizlenmeli (tek seferlik tüketim)
  await expect(page).toHaveURL(/\/tickets\/2351234567890$/);
  // X ile kapat → kapalı kalmalı
  await page.locator('[role="dialog"] button').first().click();
  await expect(page.getByText("Eski bilet 2351234567890")).toBeHidden();
});

test("exchange: kalkış tarihi düzenlenir, hata yok, tamamlanır", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/tickets/2351234567890");
  await expect(page.getByRole("heading", { name: "2351234567890" })).toBeVisible();
  await page.getByRole("button", { name: /Exchange/ }).first().click();

  const dt = page.locator('input[type="datetime-local"]').first();
  await dt.fill(""); // temizle (eski bug burada patlıyordu)
  await dt.fill("2026-09-15T10:30"); // yeni geçerli tarih

  await page.getByRole("button", { name: /Devam/ }).click();
  await page.getByRole("button", { name: /Onayla ve Kes/ }).click();

  // Yeni bilete yönlenir + başarı toast'ı
  await expect(page).toHaveURL(/\/tickets\/235\d+/, { timeout: 15_000 });
  await expect(page.getByText(/Exchange tamamlandı/)).toBeVisible();
  expect(errors, "datetime düzenleme JS hatası fırlatmamalı").toEqual([]);
});
