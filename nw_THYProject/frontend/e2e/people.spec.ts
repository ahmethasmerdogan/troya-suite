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
    await page.getByRole("button", { name: "Yeni", exact: true }).click();
    await page.getByRole("button", { name: /Yeni kanal/ }).click();
    await page.getByRole("textbox", { name: /Kanal adı/ }).fill("Gate Ekibi");
    await page.getByRole("button", { name: "Kanalı aç" }).click();

    await expect(page.getByText("Gate Ekibi").first()).toBeVisible();
  });

  test("yeni sohbet kişi arayarak başlatılır ve listede hemen görünür", async ({ page }) => {
    await page.goto("/chat");
    await page.getByRole("button", { name: "Yeni", exact: true }).click();
    await page.getByRole("button", { name: /Yeni sohbet/ }).click();
    await page.getByPlaceholder("Ad · unvan · birim").fill("Biletleme");
    await page.getByRole("dialog").getByRole("button", { name: /Mert Kaya/ }).click();

    await expect(page.getByPlaceholder("Mesaj yazın…")).toBeVisible();
    // Mesaj yazılmadan da sohbet listesine düşer — yoksa "hiçbir şey olmadı" hissi.
    await expect(page.getByText("İlk mesajı yazarak konuşmayı başlatın.")).toBeVisible();
  });

  test("grup oluşturulur, üyeleri görünür ve mesaj gönderilir", async ({ page }) => {
    await page.goto("/chat");
    await page.getByRole("button", { name: "Yeni", exact: true }).click();
    await page.getByRole("button", { name: /Yeni grup/ }).click();

    await page.getByRole("textbox", { name: /Grup adı/ }).fill("Gate Vardiyası");
    const dlg = page.getByRole("dialog");
    await dlg.getByRole("button", { name: /Mert Kaya/ }).click();
    await dlg.getByRole("button", { name: /Zeynep Şahin/ }).click();
    await expect(page.getByText("2 kişi seçildi")).toBeVisible();
    await page.getByRole("button", { name: "Grubu oluştur" }).click();

    // Sol panelde GRUPLAR bölümü ve başlıkta üye sayısı.
    await expect(page.getByText("Gruplar")).toBeVisible();
    // Sol panelde satır, başlıkta üye butonu — ikisi de "3 üye" yazar.
    await expect(page.getByRole("button", { name: "3 üye" }).first()).toBeVisible();

    await page.getByPlaceholder("Mesaj yazın…").fill("Gate C14 için ek personel lazım.");
    await page.getByRole("button", { name: "Gönder" }).click();
    await expect(page.locator("section").getByText("Gate C14 için ek personel lazım.")).toBeVisible();
  });

  test("özel kanal yalnız üyelerine görünür", async ({ page }) => {
    await page.goto("/chat");
    await page.getByRole("button", { name: "Yeni", exact: true }).click();
    await page.getByRole("button", { name: /Yeni kanal/ }).click();
    await page.getByRole("textbox", { name: /Kanal adı/ }).fill("Şef Odası");
    // Üye seçilince kanal ÖZEL olur.
    await page.getByRole("dialog").getByRole("button", { name: /Zeynep Şahin/ }).click();
    await page.getByRole("button", { name: "Kanalı aç" }).click();

    await expect(page.getByText("Özel kanal")).toBeVisible();
    await expect(page.getByRole("button", { name: "Kanaldan ayrıl" })).toBeVisible();
  });

  test("kişi kartı unvan, birim ve bağlı olduğu yöneticiyi gösterir", async ({ page }) => {
    await page.goto("/chat");
    await page.getByRole("button", { name: /Mert Kaya kişi kartı/ }).click();
    await expect(page.getByText("Biletleme Süpervizörü").first()).toBeVisible();
    await expect(page.getByText("Bağlı olduğu")).toBeVisible();
  });
});
