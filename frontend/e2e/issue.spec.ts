import { test, expect } from "@playwright/test";

// Bilet kesme sihirbazı (IssueWizard). Adımlar: Yolcu → Segmentler →
// Fare & Ödeme → Onay → Bileti Kes. Mock issueTicket idempotent bileti döner;
// IssueSuccess overlay "Bilete git" ile detay route'una yönlendirir.

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
    await expect(page.getByText(/Soyadı en az 2 karakter/)).toBeVisible();
  });

  test("uçtan uca bilet kesilir ve detaya yönlendirir", async ({ page }) => {
    await page.goto("/issue");

    // --- Adım 0: Yolcu ---
    await page.getByPlaceholder("ERDOGAN").fill("YILMAZ");
    await page.getByPlaceholder("AHMET").fill("MEHMET");
    // Validating Carrier varsayılan "TK" — placeholder ile doğrula.
    await expect(page.getByPlaceholder("TK").first()).toHaveValue("TK");
    await page.getByRole("button", { name: /İleri/ }).click();

    // --- Adım 1: Segmentler ---
    await expect(page.getByText("Uçuş Segmentleri")).toBeVisible();

    // Nereden / Nereye: AirportCombobox — yaz + Enter (ilk sonucu seçer).
    const from = page.getByPlaceholder("İstanbul / IST");
    await from.click();
    await from.fill("IST");
    await from.press("Enter");

    const to = page.getByPlaceholder("Tokyo / NRT");
    await to.click();
    await to.fill("ESB");
    await to.press("Enter");

    await page.getByPlaceholder("TK198").fill("TK2406");
    await page.getByPlaceholder("C", { exact: true }).fill("Y"); // RBD
    await page.getByPlaceholder("CFLEX").fill("YFLEX");

    // Kalkış: DatePicker popover → bir gün seç; TimePicker → bir slot seç.
    await page.getByRole("button", { name: "Tarih seçin" }).click();
    // react-day-picker: etkin (devre dışı olmayan) bir gün düğmesi tıkla.
    await page
      .getByRole("button", { name: /^15(th|\.|,| )/ })
      .or(page.locator(".rdp-day_button:not([disabled])").first())
      .first()
      .click();
    // Saat seçici inputuna odaklan → bir slot tıkla.
    await page.getByPlaceholder("--:--").click();
    await page.getByRole("button", { name: "08:00", exact: true }).click();

    await page.getByRole("button", { name: /İleri/ }).click();

    // --- Adım 2: Fare & Ödeme ---
    await expect(page.getByText("Ücret (Fare / TFC)")).toBeVisible();
    await page.getByPlaceholder("1285000").fill("125000");
    await page.getByPlaceholder("38400").fill("8400");
    // FOP varsayılan kredi kartı — Nakit seç (ek alan istemez).
    await page.getByRole("button", { name: /Nakit/ }).first().click();
    await page.getByRole("button", { name: /İleri/ }).click();

    // --- Adım 3: Onay → Bileti Kes ---
    await expect(page.getByText("Toplam tahsilat")).toBeVisible();
    // Tek tıklama bileti keser; başarı overlay'i (z-[70]) hemen üste biner —
    // force ile tek seferde tıkla, yoksa Playwright kaplanan butona retry edip timeout olur.
    await page.getByRole("button", { name: /Bileti Kes/ }).click({ force: true });

    // IssueSuccess overlay göründü → bilet kesildi.
    await expect(page.getByText("Bilet Kesildi")).toBeVisible({ timeout: 15_000 });
    // "Bileti aç" düğmesi detaya yönlendirir (overlay 3.5sn sonra otomatik de yönlendirir).
    await page.getByRole("button", { name: /Bileti aç/ }).click();

    // Yeni bilet detay route'u (235… ile başlayan numara).
    await expect(page).toHaveURL(/\/tickets\/235\d+/, { timeout: 15_000 });
  });
});
