import { test, expect } from "@playwright/test";

// Yolcu hakları (EU261 · SHY-YOLCU · UK261) — bilet kaydından hak ediş hesabı.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("troya.onboarded", "1"); localStorage.setItem("troya.lang", "tr");
    localStorage.setItem("troya.user", "a.erdogan");
  });
});

test("IST→FRA iptali: SHY-YOLCU €400; olağanüstü hâlde tazminat yok; kayda yazılır", async ({ page }) => {
  await page.goto("/tickets/2359988776655");
  await page.getByRole("button", { name: /İşlemler/ }).click();
  await page.getByRole("menuitem", { name: /Tazminat hesabı/ }).click();

  const dlg = page.getByRole("dialog", { name: /Yolcu hakları/ });
  await expect(dlg.getByText("SHY-YOLCU").first()).toBeVisible();
  await expect(dlg.getByText(/400\s*€/).first()).toBeVisible();
  await expect(dlg.getByText(/AB taşıyıcısı değil/)).toBeVisible();

  await dlg.getByText(/Olağanüstü hâl/).click();
  await expect(dlg.getByText("Tazminat doğmuyor")).toBeVisible();

  await dlg.getByRole("button", { name: "Kayda yaz" }).click();
  await expect(page.getByText("Hak ediş bilet kaydına yazıldı")).toBeVisible();
  await expect(page.getByText("Yolcu hakkı değerlendirildi").first()).toBeVisible();
});
