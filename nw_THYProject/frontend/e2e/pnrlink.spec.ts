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

  test("biletlenmiş PNR'da mükerrer kesim yerine bilet açılır; durum Türkçe yazar", async ({ page }) => {
    await page.goto("/res/XQ7T2M");
    await expect(page.getByText("Biletlendi").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Bilet Kes/i })).toHaveCount(0);
    await page.getByRole("button", { name: "Bileti aç" }).click();
    await expect(page).toHaveURL(/\/tickets\/2351234567890/);
  });

  test("uygunluk sorgusunda sınıfa tıklayınca rezervasyon formu o seferle açılır", async ({ page }) => {
    await page.goto("/res/availability");
    // Tarih takvimden seçilir (tarayıcının "mm/dd/yyyy" kutusu değil).
    await page.getByRole("button", { name: /Eyl|Eki|Kas|Ara|Oca|Şub|Mar|Nis|May|Haz|Tem|Ağu|Gün/ }).first().click();
    await page.getByRole("button", { name: "Yarın", exact: true }).click();
    await page.getByRole("button", { name: "Ara", exact: true }).click();

    // Seferler güzergâha özgüdür; ilk açık Economy sınıfının seferi forma taşınır.
    const cls = page.getByRole("button", { name: /^Economy [A-Z] [1-9]$/ }).first();
    const flightNo = await cls.locator("xpath=ancestor::div[contains(@class,'grid')][1]").locator("span.num").first().innerText();
    await cls.click();
    await expect(page).toHaveURL(/\/res\/new\?/);
    await expect(page.getByText(/Uygunluk sorgusundan gelindi/)).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Uçuş No/ })).toHaveValue(flightNo.replace(/^TK/, ""));
  });
});
