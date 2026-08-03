import { test, expect } from "@playwright/test";

// Bu turda kapatılan handbook maddelerinin arayüz yüzeyleri:
// 15.1 iade tarifesi · 1.1.5.1 kontrol · 1.3.4 print exchange · 5.8 EMD makbuzu · 9.3 PTA iadesi.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("troya.onboarded", "1");
    localStorage.setItem("troya.user", "a.erdogan");
  });
  await page.setViewportSize({ width: 1440, height: 900 });
});

test("15.1 — iade türü seçilir, tutarı sistem hesaplar", async ({ page }) => {
  await page.goto("/tickets/2351234567890?flow=refund");
  await expect(page.getByText("Sistem hesabı")).toBeVisible();

  // Voluntary varsayılan; involuntary'ye geçince sebep alanı açılır.
  await page.getByRole("button", { name: /Involuntary/ }).click();
  await expect(page.getByText(/Sebep \(15\.1\.1\.1\)/)).toBeVisible();

  // 15.1.2(b): kısmen kullanılmış bilette iki hesap gösterilir.
  await expect(page.getByText(/Kullanılmayan taşımanın tek yön ücreti/)).toBeVisible();
  await expect(page.getByText(/Ödenen ücret − kullanılan taşımanın ücreti/)).toBeVisible();
});

test("1.1.5.1 — kontrol paneli açılır ve süre limitini gösterir", async ({ page }) => {
  await page.goto("/tickets/2351234567890?flow=control");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText(/Kupon kontrolü/)).toBeVisible();
  await expect(page.getByText("Devir koşulu")).toBeVisible();
  await expect(page.getByText(/Devredilecek taşıyıcı/)).toBeVisible();
});

test("1.3.4 — print exchange kağıt belge numarası ister", async ({ page }) => {
  await page.goto("/tickets/2351234567890?flow=printexchange");
  await expect(page.getByText(/X final bir statüdür/)).toBeVisible();
  await expect(page.getByPlaceholder("2359000000001")).toBeVisible();
});

test("5.8 — EMD makbuzu zorunlu alanlarla açılır", async ({ page }) => {
  await page.goto("/emds");
  const emdCell = page.locator("table tbody tr td").filter({ hasText: /^\d{13}$/ }).first();
  await expect(emdCell).toBeVisible({ timeout: 10_000 });
  await emdCell.click();
  await expect(page).toHaveURL(/\/emds\/\d{13}/);
  await page.getByRole("button", { name: "Makbuz" }).click();
  await expect(page).toHaveURL(/\/emds\/\d{13}\/receipt/);
  await expect(page.getByRole("heading", { name: "EMD Makbuzu" })).toBeVisible();
  await expect(page.getByText("Reason for Issuance (RFIC)")).toBeVisible();
  await expect(page.getByText("Terms and Conditions Notice (Appendix B)")).toBeVisible();
});

test("9.3 — PTA teslim teyidi ve iade belgesi", async ({ page }) => {
  await page.goto("/pta");
  await expect(page.getByRole("heading", { name: /PTA/ })).toBeVisible();
  await page.getByRole("button", { name: "İade" }).first().click();
  await expect(page.getByText(/Belge ve yetki/)).toBeVisible();
  await expect(page.getByText(/Agents Refund Voucher/).first()).toBeVisible();
});

test("Rapor merkezi — üç sekme ve dönem kapanışı", async ({ page }) => {
  await page.goto("/report");
  await expect(page.getByRole("heading", { name: "Satış / İşlem Raporu" })).toBeVisible();

  // Mali rapor: ceza / vergi / KDV kırılımı
  await page.getByRole("link", { name: "Mali", exact: true }).click();
  await expect(page).toHaveURL(/\/report\/financial/);
  await expect(page.getByRole("heading", { name: "Mali Rapor" })).toBeVisible();
  await expect(page.getByText("Ceza ve ücretler").first()).toBeVisible();
  await expect(page.getByText(/KDV — bilet bedelinin içinde/).first()).toBeVisible();

  // Dönem kapanışı: açık dönemde geri alma hakkı görünür
  await page.getByRole("link", { name: "Dönem Kapanışı", exact: true }).first().click();
  await expect(page).toHaveURL(/\/report\/period/);
  await expect(page.getByRole("heading", { name: "Dönem Kapanışı" })).toBeVisible();
  await expect(page.getByText("Dönem neden önemli")).toBeVisible();
  await expect(page.getByRole("button", { name: "Dönemi kapat" }).first()).toBeVisible();
});
