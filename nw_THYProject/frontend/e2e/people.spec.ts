import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("troya.onboarded", "1"); localStorage.setItem("troya.lang", "tr");
    localStorage.setItem("troya.user", "a.erdogan");
    localStorage.setItem("troya.role", "admin");
  });
});

test.describe("Kullanıcı yönetimi", () => {
  test("yeni kullanıcı eklenir ve değişiklik kaydına düşer", async ({ page }) => {
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Yeni kullanıcı" }).click();

    await page.getByRole("textbox", { name: /Ad Soyad/ }).fill("Deniz Ak");
    await page.getByRole("textbox", { name: /E-posta/ }).fill("d.ak@thy.com");
    await page.getByRole("textbox", { name: /Unvan/ }).fill("Check-in Görevlisi");
    await page.getByRole("button", { name: "Kullanıcıyı ekle" }).click();

    await expect(page.getByText("Deniz Ak").first()).toBeVisible();
    await expect(page.getByText("Eklendi")).toBeVisible();
  });

  test("rol atamada kazanılan ve kaybedilen yetkiler önceden gösterilir", async ({ page }) => {
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Rol" }).first().click();

    await expect(page.getByText("Kazanacağı yetkiler")).toBeVisible();
    // Gerekçe girilmeden atama yapılamaz.
    await expect(page.getByRole("button", { name: "Rolü ata" })).toBeDisabled();
  });
});

test.describe("Profil", () => {
  test("profil kartı birim, yönetici ve yetkileri gösterir", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Profilim" })).toBeVisible();
    await expect(page.getByText("Rolüm ve yetkilerim")).toBeVisible();
    await expect(page.getByText("Bana bağlı personel")).toBeVisible();
  });
});

test.describe("Mesajlaşma — yeni sohbet ve kanal", () => {
  test("yeni kanal açılır ve listede görünür", async ({ page }) => {
    await page.goto("/chat");
    await page.getByRole("button", { name: "Yeni kanal" }).click();
    await page.getByRole("textbox", { name: /Kanal adı/ }).fill("Gate Ekibi");
    await page.getByRole("button", { name: "Kanalı aç" }).click();

    await expect(page.getByText("Gate Ekibi").first()).toBeVisible();
  });

  test("yeni sohbet kişi arayarak başlatılır", async ({ page }) => {
    await page.goto("/chat");
    await page.getByRole("button", { name: "Yeni sohbet" }).click();
    await page.getByPlaceholder("Ad · unvan · birim").fill("Biletleme");
    await page.getByRole("dialog").getByRole("button", { name: /Mert Kaya/ }).click();

    await expect(page.getByPlaceholder("Mesaj yazın…")).toBeVisible();
  });

  test("kişi kartı unvan, birim ve bağlı olduğu yöneticiyi gösterir", async ({ page }) => {
    await page.goto("/chat");
    await page.getByRole("button", { name: /Mert Kaya kişi kartı/ }).click();
    await expect(page.getByText("Biletleme Süpervizörü").first()).toBeVisible();
    await expect(page.getByText("Bağlı olduğu")).toBeVisible();
  });
});
