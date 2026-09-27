import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("troya.onboarded", "1"); localStorage.setItem("troya.lang", "tr"); localStorage.setItem("troya.user", "a.erdogan"); });
});

// Kalkış kontrolü gişesi — uçuşlar arası yolcu araması, geç kabul, belge kontrolü.
test.describe("Kalkış kontrolü", () => {
  test("giriş panosunda yolcu tüm uçuşlarda aranır ve uçuşunda açılır", async ({ page }) => {
    await page.goto("/checkin");
    await expect(page.getByRole("heading", { name: "Kalkış Kontrolü" })).toBeVisible();
    await page.getByPlaceholder(/Pasaport, TC kimlik/).fill("SCHNEIDER");
    await page.getByRole("button", { name: /SCHNEIDER\/PAUL · TK1591/ }).click();
    await expect(page).toHaveURL(/\/checkin\/TK1591-D\?pax=SCHNEIDER/);
    await expect(page.getByText("SCHNEIDER/PAUL")).toBeVisible();
  });

  test("kontuarı kapanmış uçuşta kabul yalnız gerekçeli geç kabulle yapılır ve kayda geçer", async ({ page }) => {
    await page.goto("/checkin/TK198-D"); // dış hat, kalkışa 55 dk → kontuar kapalı, kapı açık
    await expect(page.getByText("Kontuar kapandı")).toBeVisible();

    await page.getByRole("button", { name: "Geç kabul" }).first().click();
    const dlg = page.getByRole("dialog", { name: "Geç kabul" });
    await dlg.getByText("Gecikmeli bağlantı uçuşundan gelen yolcu").click();
    await dlg.getByRole("button", { name: "Koltuk seçimine geç" }).click();

    await expect(page).toHaveURL(/late=CONN/);
    await expect(page.getByText(/Geç kabul · Gecikmeli bağlantı/)).toBeVisible();
    await page.getByRole("button", { name: /· boş$/ }).first().click();
    await page.getByRole("button", { name: "Kabul et" }).click();

    await expect(page).toHaveURL(/\/checkin\/TK198-D$/);
    await expect(page.getByText("Geç kabul", { exact: true }).first()).toBeVisible();
  });

  test("belgesi uygun olmayan yolcu kabul edilemez; belge kontrolü gerekçeyi söyler", async ({ page }) => {
    await page.goto("/checkin/TK1591-D");
    await page.getByRole("button", { name: /^Belge sorunu/ }).click();

    const row = page.getByText("Belge uygun değil").first();
    await expect(row).toBeVisible();
    await page.getByRole("button", { name: "Belge", exact: true }).first().click();
    const dlg = page.getByRole("dialog", { name: "Seyahat belgesi kontrolü" });
    await expect(dlg.getByText("NOT OK — kabul edilemez")).toBeVisible();
    await expect(dlg.getByText("OK TO BOARD — makam onayı")).toBeVisible();
  });

  test("uçuş kapanışı onay ister; vazgeçilince uçuş açık kalır", async ({ page }) => {
    await page.goto("/checkin/TK1591-D");
    await page.getByRole("button", { name: "Uçuşu kapat" }).click();
    const dlg = page.getByRole("dialog", { name: "Uçuşu kapat" });
    await expect(dlg.getByText(/geri alınamaz/)).toBeVisible();
    await dlg.getByRole("button", { name: "İptal" }).click();
    await expect(dlg).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Uçuşu kapat" })).toBeVisible();
  });
});
