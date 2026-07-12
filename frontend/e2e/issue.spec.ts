import { test, expect } from "@playwright/test";

// Bilet kesme sihirbazı (IssueWizard). Adımlar: Yolcu → Sefer → Ücret Seçimi →
// Ödeme → Onay → Bileti Kes. Ücret ELLE GİRİLMEZ — sistem tarifesinden seçilir.
// Mock issueTicket idempotent bileti döner; IssueSuccess overlay "Bilete git" ile
// detay route'una yönlendirir.

// Onboarding modal'ını atla.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("troya.onboarded", "1"); localStorage.setItem("troya.user", "a.erdogan"); });
});

test.describe("Issue wizard", () => {
  test("zorunlu alanlar boşken İleri ilerletmez (client validation)", async ({ page }) => {
    await page.goto("/issue");
    await page.getByRole("button", { name: /İleri/ }).click();
    // Adım 0'da kalır → "Yolcu Bilgileri" hâlâ görünür, hata mesajı çıkar.
    await expect(page.getByText("Yolcu Bilgileri")).toBeVisible();
    await expect(page.getByText("Soyadı en az 2 karakter (Ch 2)")).toBeVisible();
  });

  test("uçtan uca bilet kesilir ve detaya yönlendirir", async ({ page }) => {
    await page.goto("/issue");

    // --- Adım 0: Yolcu ---
    await page.getByPlaceholder("ERDOGAN").fill("YILMAZ");
    await page.getByPlaceholder("AHMET").fill("MEHMET");
    // Validating Carrier varsayılan "TK" — placeholder ile doğrula.
    await expect(page.getByPlaceholder("TK").first()).toHaveValue("TK");
    await page.getByRole("button", { name: /İleri/ }).click();

    // --- Adım 1: Sefer — güzergah + tarih → uçuş listesinden SEÇ ---
    await expect(page.getByRole("heading", { name: "Sefer Seçimi" })).toBeVisible();

    // Nereden / Nereye: AirportCombobox — yaz + Enter (ilk sonucu seçer).
    const from = page.getByPlaceholder("İstanbul / IST");
    await from.click();
    await from.fill("IST");
    await from.press("Enter");

    const to = page.getByPlaceholder("Tokyo / NRT");
    await to.click();
    await to.fill("ESB");
    await to.press("Enter");

    // Tarih seç (popover takvim) → YALNIZ o güne ait uçuş listesi çıkar.
    // Sefer no / saat / fiyat ELLE GİRİLMEZ; uçuşlar ancak tarih seçilince görünür.
    await page.getByRole("button", { name: /Gün.*Ay.*Yıl/ }).click();
    await page.locator(".rdp-day_button:not([disabled])").first().click();

    // Uçuş listesinden ilk seferi seç (aria-pressed'li satır).
    const flight = page.locator('button[aria-pressed]').first();
    await expect(flight).toBeVisible({ timeout: 10_000 });
    await flight.click();
    await expect(flight).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: /İleri/ }).click();

    // --- Adım 2: Ücret Seçimi (sistem tarifesi) ---
    await expect(page.getByRole("heading", { name: "Ücret Seçimi" })).toBeVisible();
    // Tarife hesaplanınca ücret satırları (aria-pressed'li seçilebilir kartlar) gelir.
    const offer = page.locator('button[aria-pressed]').first();
    await expect(offer).toBeVisible({ timeout: 10_000 });
    await offer.click();
    await expect(offer).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /İleri/ }).click();

    // --- Adım 3: Ödeme ---
    await expect(page.getByRole("heading", { name: "Ödeme" })).toBeVisible();
    // FOP varsayılan kredi kartı — Nakit seç (ek alan istemez).
    await page.getByRole("button", { name: /Nakit/ }).first().click();
    await page.getByRole("button", { name: /İleri/ }).click();

    // --- Adım 4: Onay → Bileti Kes → KURUMSAL ONAY MODALI ---
    await expect(page.getByText("Toplam tahsilat")).toBeVisible();
    await page.getByRole("button", { name: /Bileti Kes/ }).click({ force: true });

    // Kesim onayı modalı: beyan işaretlenmeden "Onaylıyorum" pasif olmalı.
    await expect(page.getByRole("dialog", { name: "Bilet Kesim Onayı" })).toBeVisible();
    const confirmBtn = page.getByRole("button", { name: /Onaylıyorum/ });
    await expect(confirmBtn).toBeDisabled();
    await page.getByRole("checkbox").check();
    // Başarı overlay'i (z-[70]) hemen üste biner — force ile tek seferde tıkla.
    await confirmBtn.click({ force: true });

    // IssueSuccess overlay göründü → bilet kesildi.
    await expect(page.getByText("Bilet Kesildi")).toBeVisible({ timeout: 15_000 });
    // "Bileti aç" düğmesi detaya yönlendirir (overlay 3.5sn sonra otomatik de yönlendirir).
    await page.getByRole("button", { name: /Bileti aç/ }).click();

    // Yeni bilet detay route'u (235… ile başlayan numara).
    await expect(page).toHaveURL(/\/tickets\/235\d+/, { timeout: 15_000 });
  });
});
