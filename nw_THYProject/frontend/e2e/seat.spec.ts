import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("troya.onboarded", "1"); localStorage.setItem("troya.user", "a.erdogan"); });
});

// Kabin haritası uçak tipinden çizilir; kapalı koltuğun nedeni ekranda yazar.
test.describe("Koltuk seçimi", () => {
  test("kabin uçak tipine göre bölmelenir ve kapasite haritayla tutar", async ({ page }) => {
    await page.goto("/checkin/TK1591-D"); // Airbus A321neo
    await page.getByRole("button", { name: /Kabul et|Koltuk değiştir/ }).first().click();

    await expect(page.getByRole("heading", { name: "Koltuk Seçimi" })).toBeVisible();
    // Kabin bölmeleri düzenden geliyor (Business 1-4, Economy 5-33).
    await expect(page.getByText("Business · sıra 1–4")).toBeVisible();
    await expect(page.getByText("Economy · sıra 5–33")).toBeVisible();
    // Kapasite metni haritadaki koltuk sayısıyla aynı kaynaktan.
    await expect(page.getByText(/A321neo · C16 \/ Y174 · 190 koltuk/)).toBeVisible();
  });

  test("kapalı koltuğun nedeni panelde yazar ve seçilemez", async ({ page }) => {
    await page.goto("/checkin/TK1591-D");
    await page.getByRole("button", { name: /Kabul et|Koltuk değiştir/ }).first().click();

    // Economy yolcuya Business kabini kapalıdır ve gerekçesi yazılıdır.
    await expect(page.getByText("Kapalı koltuklar")).toBeVisible();
    await expect(page.getByText(/Business kabini/)).toBeVisible();

    // Kapalı bir koltuğa tıklamak seçim yapmaz, nedeni söyler.
    const blocked = page.getByRole("button", { name: /kapalı —/ }).first();
    await blocked.click();
    await expect(page.getByText("Bu koltuk verilemez")).toBeVisible();
    await expect(blocked).toHaveAttribute("aria-pressed", "false");
  });

  test("uygun koltuk seçilince alt şerit tarifini yazar", async ({ page }) => {
    await page.goto("/checkin/TK1591-D");
    await page.getByRole("button", { name: /Kabul et|Koltuk değiştir/ }).first().click();

    const free = page.getByRole("button", { name: /· boş$/ }).first();
    await free.click();
    await expect(free).toHaveAttribute("aria-pressed", "true");
    // Alt aksiyon şeridinde koltuk ve tarifi görünür (pencere / koridor / orta).
    await expect(page.getByText(/pencere kenarı|koridor|orta koltuk/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Kabul et" })).toBeEnabled();
  });
});
