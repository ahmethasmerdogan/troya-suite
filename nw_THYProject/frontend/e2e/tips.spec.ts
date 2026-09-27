import { test, expect } from "@playwright/test";

// İpucu katmanı: karşılama → ekran turu → bağlamsal balon.
// Diğer spec'ler "troya.onboarded" ile karşılamayı atlar; ipuçları varsayılan
// kapalı olduğu için onlarda hiçbir tip katmanı görünmez.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("troya.lang", "tr");
    localStorage.setItem("troya.user", "a.erdogan");
  });
});

test("ilk girişte karşılama açılır, üç sayfa gezilir, panel turu başlar ve biter", async ({ page }) => {
  await page.goto("/");
  const dlg = page.getByRole("dialog", { name: "Troya Suite'e hoş geldiniz" });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByText("Tek çalışma alanı, dört modül")).toBeVisible();
  await dlg.getByRole("button", { name: "İleri" }).click();
  await expect(dlg.getByText("Uzman hızı: klavye")).toBeVisible();
  await dlg.getByRole("button", { name: "İleri" }).click();
  await expect(dlg.getByText("Ekranlarda ipuçlarını göster")).toBeVisible();
  await dlg.getByRole("button", { name: "Panel turunu başlat" }).click();

  const tour = page.getByRole("dialog", { name: "Modüller" });
  await expect(tour).toBeVisible();
  // Son adıma kadar ilerle; "Bitir" turu kapatır.
  for (let i = 0; i < 10; i++) {
    const finish = page.getByRole("button", { name: "Bitir" });
    if (await finish.isVisible()) { await finish.click(); break; }
    await page.getByRole("button", { name: "İleri" }).click();
  }
  await expect(page.locator(".tour-spot")).toHaveCount(0);
  // Yeniden yüklemede karşılama tekrar çıkmaz.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ahmet");
  await expect(page.getByRole("dialog", { name: "Troya Suite'e hoş geldiniz" })).toHaveCount(0);
});

test("ipucu balonu okunur, 'Anladım' ile kaybolur ve geri gelmez", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("troya.onboarded", "1");
    // Yalnız ilk yüklemede tohumla — yeniden yüklemede kalıcılığı sınıyoruz.
    if (!localStorage.getItem("troya.tips.v1"))
      localStorage.setItem("troya.tips.v1", JSON.stringify({ enabled: true, seen: [], tours: ["search"], dailyHidden: false }));
  });
  await page.goto("/search");
  const beacon = page.getByRole("button", { name: "İpucu: Ne yazarsanız bulur" });
  await expect(beacon).toBeVisible();
  await beacon.click();
  await expect(page.getByText(/13 hane bilet, 6 karakter PNR/)).toBeVisible();
  await page.getByRole("button", { name: "Anladım" }).click();
  await expect(beacon).toHaveCount(0);
  await page.reload();
  await expect(page.getByPlaceholder("TKT no · ERDOGAN · PNR · IST · TK198 · kart son4")).toBeVisible();
  await expect(page.getByRole("button", { name: "İpucu: Ne yazarsanız bulur" })).toHaveCount(0);
});

test("tur önerisi şeridi 'Şimdi değil' ile kapanır; tur yardım menüsünden başlatılır", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("troya.onboarded", "1");
    localStorage.setItem("troya.tips.v1", JSON.stringify({ enabled: true, seen: [], tours: [], dailyHidden: false }));
  });
  await page.goto("/search");
  await expect(page.getByText("Bu ekranı 30 saniyede tanıyın")).toBeVisible();
  await page.getByRole("button", { name: "Şimdi değil" }).click();
  await expect(page.getByText("Bu ekranı 30 saniyede tanıyın")).toHaveCount(0);

  await page.getByRole("button", { name: "Bu ekran nasıl kullanılır" }).click();
  await page.getByRole("button", { name: /Bu ekranın turunu başlat/ }).click();
  await expect(page.getByRole("dialog", { name: "Tek akıllı çubuk" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".tour-spot")).toHaveCount(0);
});
