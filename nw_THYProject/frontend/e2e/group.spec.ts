import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("troya.onboarded", "1"); localStorage.setItem("troya.lang", "tr"); localStorage.setItem("troya.user", "a.erdogan"); });
});

// Grup / aile kesimi — iki yolculu PNR tek işlemde, her yolcuya ayrı bilet.
test("iki yolculu rezervasyon tek işlemde biletlenir; her yolcu kendi biletini alır", async ({ page }) => {
  await page.goto("/res/TR8N1P");
  await page.getByRole("button", { name: /Bilet Kes/i }).click();
  await expect(page).toHaveURL(/\/issue\?pnr=TR8N1P/);

  // Ana yolcu ilk biletsiz yolcu; ikincisi aynı işlemin listesine gelmiş.
  await expect(page.getByRole("textbox", { name: /Soyadı/ }).first()).toHaveValue("DEMIR");
  await expect(page.getByText("Aynı işlemde diğer yolcular")).toBeVisible();
  await expect(page.locator('input[value="AYSE"]')).toBeVisible();
  await page.getByRole("button", { name: /İleri/ }).click();

  // Sefer rezervasyondan seçili gelir.
  await expect(page.getByText(/Rezervasyonda onaylı/)).toBeVisible();
  await page.getByRole("button", { name: /İleri/ }).click();

  // Ücret: seçilince grup tahsilatı tablosu çıkar.
  const offer = page.locator("button[aria-pressed]").first();
  await expect(offer).toBeVisible({ timeout: 10_000 });
  await offer.click();
  await expect(page.getByText("Grup tahsilatı")).toBeVisible();
  await expect(page.getByText("DEMIR/AYSE")).toBeVisible();
  await page.getByRole("button", { name: /İleri/ }).click();

  await page.getByRole("button", { name: /Nakit/ }).first().click();
  await page.getByRole("button", { name: /İleri/ }).click();

  await page.getByRole("button", { name: /Bileti Kes/ }).click({ force: true });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Onaylıyorum/ }).click({ force: true });

  await expect(page.getByText(/2 bilet kesildi · GRP/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: /DEMIR\/AYSE/ })).toBeVisible();
});
