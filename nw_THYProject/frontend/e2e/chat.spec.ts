import { test, expect } from "@playwright/test";

// Mesajlaşma — bilet iliştirme + iliştirilen kaydın canlı görüntüsü + durum bildirimi.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("troya.onboarded", "1");
    localStorage.setItem("troya.user", "a.erdogan");
    localStorage.removeItem("troya.chat.v1.msgs"); // her testte temiz arşiv
  });
  await page.setViewportSize({ width: 1440, height: 900 });
});

test.describe("Mesajlaşma", () => {
  test("bilet iliştirilir, mesajla gönderilir ve sağ panelde canlı açılır", async ({ page }) => {
    await page.goto("/chat");

    await page.getByRole("button", { name: "Bilet ekle" }).click();
    // Sol paneldeki sohbet önizlemesi de bilet no taşıyabilir — seçiciyi modala daralt.
    const row = page.getByRole("dialog").getByRole("button", { name: /\d{13}/ }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    const ticketNo = (await row.innerText()).match(/\d{13}/)![0];
    await row.click();

    // İlişik şeridi göründü → mesajı gönder.
    await expect(page.getByRole("button", { name: "İlişiği kaldır" })).toBeVisible();
    await page.getByPlaceholder("Mesaj yazın…").fill("Bu bilete bakar mısın?");
    await page.getByRole("button", { name: "Gönder" }).click();

    // Baloncuk + kayıt kartı.
    // Sol paneldeki sohbet önizlemesi aynı metni taşıyor — mesaj alanına daralt.
    await expect(page.locator("section").getByText("Bu bilete bakar mısın?")).toBeVisible();
    const card = page.getByRole("button", { name: `${ticketNo} kaydını görüntüle` });
    await expect(card).toBeVisible();

    // Kartı aç → sağ panelde bilet görüntüsü canlı kayıttan gelir.
    await card.click();
    await expect(page.getByText("Bilet görüntüsü")).toBeVisible();
    await expect(page.getByRole("link", { name: /Bilette aç/ })).toBeVisible({ timeout: 10_000 });
  });

  test("kendi durumumu bildiririm ve seçim korunur", async ({ page }) => {
    await page.goto("/chat");
    const busy = page.getByRole("button", { name: "Meşgul" });
    await busy.click();
    await expect(busy).toHaveAttribute("aria-pressed", "true");
  });
});
