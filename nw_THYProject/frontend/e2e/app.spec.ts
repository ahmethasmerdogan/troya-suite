import { test, expect } from "@playwright/test";

// İlk-kullanım onboarding modal'ı pointer event'leri yakalar; her testten
// önce "troya.onboarded" localStorage flag'i set ederek atla.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("troya.onboarded", "1"); localStorage.setItem("troya.user", "a.erdogan"); });
});

// Uygulama kabuğu (AppShell) + temel navigasyon. Selektörler kaynaktan
// doğrulandı: Panel h1 greeting, sidebar TanStack Router linkleri, URL assertion.
test.describe("App shell & navigation", () => {
  test("ana panel açılır ve başlık görünür", async ({ page }) => {
    await page.goto("/");
    // Panel.tsx: <h1>{greeting}, Ahmet</h1>
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ahmet");
  });

  test("bilet arama sayfasına gidilebilir (URL + arama girişi)", async ({ page }) => {
    await page.goto("/search");
    await expect(page).toHaveURL(/\/search/);
    // TicketSearch SearchBar input — placeholder kaynaktan.
    await expect(
      page.getByPlaceholder("TKT no · ERDOGAN · PNR · IST · TK198 · kart son4"),
    ).toBeVisible();
  });

  test("issue wizard sayfası 5 adımlı sihirbazı gösterir", async ({ page }) => {
    await page.goto("/issue");
    await expect(page).toHaveURL(/\/issue/);
    // IssueWizard STEPS: Yolcu / Sefer / Ücret / Ödeme / Onay
    await expect(page.getByText("Yolcu Bilgileri")).toBeVisible();
    await expect(page.getByRole("button", { name: /İleri/ })).toBeVisible();
  });
});
