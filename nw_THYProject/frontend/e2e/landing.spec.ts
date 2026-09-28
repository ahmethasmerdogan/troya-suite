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
    await expect(page.getByRole("heading", { name: /Komut satırından/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Giriş yap" })).toHaveCount(0);

    // Bölümler sayfada: yaşam döngüsü, 17 statü, özellikler.
    await page.getByRole("button", { name: "Özellikler" }).click();
    await expect(page.getByRole("heading", { name: "Tek platform. Her masa için." })).toBeVisible();

    await page.getByRole("link", { name: "Sisteme giriş" }).first().click();
    await expect(page.getByRole("heading", { name: "Giriş yap" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("dil düğmesi sayfayı İngilizceye çevirir", async ({ page }) => {
    await page.goto("/tanitim");
    await page.getByRole("button", { name: "Switch to English" }).click();
    await expect(page.getByRole("heading", { name: /From command line/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
  });

  test("giriş ekranındaki bağlantı tanıtım sayfasını açar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Sistemi tanıyın" }).first().click();
    await expect(page).toHaveURL(/\/tanitim$/);
    await expect(page.getByRole("heading", { name: /Komut satırından/ })).toBeVisible();
  });
});
