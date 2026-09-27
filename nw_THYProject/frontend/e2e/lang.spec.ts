import { test, expect } from "@playwright/test";

/*
 * İngilizce smoke — bugüne kadar EN dilinde HİÇ test koşmuyordu.
 *
 * Diğer tüm spec'ler `troya.lang = "tr"` ile pinlenmiştir (çeviri turu onları
 * kırmasın diye). Burası tersini yapar: dili EN'e alır ve arayüzün gerçekten
 * İngilizce açıldığını, kritik rotaların hatasız yüklendiğini doğrular.
 */
const EN_ROUTES = ["/", "/search", "/issue", "/checkin", "/chat", "/profile", "/reports"];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("troya.onboarded", "1");
    localStorage.setItem("troya.user", "a.erdogan");
    localStorage.setItem("troya.role", "admin");
    localStorage.setItem("troya.lang", "en");
  });
});

test.describe("İngilizce arayüz", () => {
  test("kritik rotalar EN dilinde hatasız açılır", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`${page.url()} — ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error") errors.push(`${page.url()} — ${m.text()}`); });

    for (const route of EN_ROUTES) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
    }
    expect(errors).toEqual([]);
  });

  test("gezinme ve sayfa gövdesi İngilizce", async ({ page }) => {
    await page.goto("/search");
    // Kabuk — topbar araması bir BUTON (⌘K paletini açar), input değil.
    await expect(page.getByRole("link", { name: "Issue Ticket" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Search ticket, PNR, passenger/ })).toBeVisible();
    // Sayfa gövdesi — çeviri turu buraya kadar indi mi?
    await expect(page.getByRole("heading", { name: "Search Tickets" })).toBeVisible();
    // Sayfa içi arama alanı da çevrildi (örnek değerler korunur).
    await expect(page.getByPlaceholder(/card last4/)).toBeVisible();
    // Durum kuyrukları
    await expect(page.getByRole("button", { name: /^All/ })).toBeVisible();
  });

  test("<html lang> arayüz diliyle senkron", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("tarih ve tutar biçimi de dile uyar", async ({ page }) => {
    await page.goto("/search");
    // TR'de "01 Haz 2026" olan tarih EN'de ay adını İngilizce yazar.
    await expect(page.getByText(/\d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}/).first())
      .toBeVisible({ timeout: 10_000 });
  });
});
