import { test, expect } from "@playwright/test";

// Auth gate + hızlı test kullanıcısı girişi.
test.describe("Login", () => {
  test("giriş yapılmadan uygulama login ekranı gösterir", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("troya.onboarded", "1"));
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Giriş yap" })).toBeVisible();
    await expect(page.getByText("Hızlı giriş")).toBeVisible();
  });

  test("test kullanıcısı kartıyla hızlı giriş → panele girer", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("troya.onboarded", "1"));
    await page.goto("/");
    // Admin test kullanıcısı kartına tıkla
    await page.getByRole("button", { name: /Ahmet Erdoğan/ }).click();
    // Login ekranı kaybolur, uygulama açılır (login başlığı gider)
    await expect(page.getByRole("heading", { name: "Giriş yap" })).toBeHidden({ timeout: 10_000 });
  });

  test("bilinmeyen kullanıcı adıyla form hata verir", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("troya.onboarded", "1"));
    await page.goto("/");
    await page.getByPlaceholder("örn. a.erdogan").fill("yok.kullanici");
    await page.getByRole("button", { name: /Giriş Yap/ }).click();
    await expect(page.getByText(/Kullanıcı bulunamadı/)).toBeVisible();
  });
});
