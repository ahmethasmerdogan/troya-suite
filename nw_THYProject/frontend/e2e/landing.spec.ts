import { test, expect } from "@playwright/test";

// Tanıtım sayfası: giriş gerektirmez, dili değişir, girişe ve dokümantasyona götürür.
test.describe("Tanıtım sayfası", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem("troya.onboarded", "1"); localStorage.setItem("troya.lang", "tr"); });
  });

  test("girişsiz açılır, konsol hatası vermez ve girişe yönlendirir", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/tanitim");
    await expect(page.getByRole("heading", { level: 1, name: /Biletleme, yeniden tasarlandı/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Giriş yap" })).toHaveCount(0);

    // Menü bölümlere kaydırır: ürün, modüller, yaşam döngüsü, mimari.
    await page.getByRole("button", { name: "Modüller" }).click();
    await expect(page.getByRole("heading", { name: "Tek platform. Her masa için." })).toBeVisible();

    await page.getByRole("link", { name: "Sisteme giriş" }).first().click();
    await expect(page.getByRole("heading", { name: "Giriş yap" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("dil düğmesi sayfayı İngilizceye çevirir", async ({ page }) => {
    await page.goto("/tanitim");
    await page.getByRole("button", { name: "Switch to English" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Ticketing, reimagined/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
  });

  test("modül sekmeleri içeriği ve ekran görüntüsünü değiştirir", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/tanitim");
    await page.getByRole("button", { name: "Modüller" }).click();
    const tab = page.getByRole("tab", { name: "Check-in" });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Uçak tipine göre koltuk, kurala göre kabul." })).toBeVisible();
    await expect(page.locator('img[src="/landing/checkin-tr.webp"]')).toHaveAttribute("aria-hidden", "false");
  });

  test("giriş ekranındaki bağlantı tanıtım sayfasını açar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Sistemi tanıyın" }).first().click();
    await expect(page).toHaveURL(/\/tanitim$/);
    await expect(page.getByRole("heading", { level: 1, name: /Biletleme, yeniden tasarlandı/ })).toBeVisible();
  });
});
