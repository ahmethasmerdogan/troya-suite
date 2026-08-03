import { test, expect } from "@playwright/test";

// Sistem dokümantasyon sayfası — paydaş sunumu için merkez sayfa.
test.describe("Dokümantasyon", () => {
  test("docs sayfası açılır: hero + bölümler + teknoloji yığını görünür", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("troya.onboarded", "1"));
    await page.goto("/");
    await page.getByRole("button", { name: /Ahmet Erdoğan/ }).click();
    await expect(page.getByRole("heading", { name: "Giriş yap" })).toBeHidden({ timeout: 10_000 });

    await page.goto("/docs");
    await expect(page.getByRole("heading", { name: "Troya Suite" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Teknoloji Yığını" })).toBeVisible();
    // Teknoloji rozetleri (örnek) — yığın gerçekten render olmuş mu
    await expect(page.getByText("Spring Boot 3").first()).toBeVisible();
    await expect(page.getByText("Event Sourcing").first()).toBeVisible();
  });

  test("panel banner'ından dokümantasyona gidilir", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("troya.onboarded", "1"));
    await page.goto("/");
    await page.getByRole("button", { name: /Ahmet Erdoğan/ }).click();
    await expect(page.getByRole("heading", { name: "Giriş yap" })).toBeHidden({ timeout: 10_000 });

    await page.getByRole("link", { name: /Sistem Dokümantasyonu/ }).click();
    await expect(page).toHaveURL(/\/docs/);
    await expect(page.getByRole("heading", { name: "IATA Handbook Kapsamı" })).toBeVisible();
  });
});
