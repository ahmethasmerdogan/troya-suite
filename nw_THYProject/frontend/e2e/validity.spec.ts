import { test, expect } from "@playwright/test";

// Bilet geçerliliği (Handbook 12.4 / 12.9.1 / 13.10). Demo verisi bugüne
// kaydırıldığı için örnek biletlerin kalan süresi her gün aynıdır.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("troya.onboarded", "1"); localStorage.setItem("troya.lang", "tr");
    localStorage.setItem("troya.user", "a.erdogan");
  });
});

const ymd = (d: Date) => d.toISOString().slice(0, 10);

test("süresi dolmak üzere olan bilet hastalık nedeniyle uzatılır (13.10)", async ({ page }) => {
  await page.goto("/tickets/2356000001014");
  const card = page.locator('[data-tour="ticket.validity"]');
  await expect(card.getByText(/Dolmak üzere/)).toBeVisible();
  await card.getByRole("button", { name: /Hastalık nedeniyle uzat/ }).click();

  const dlg = page.getByRole("dialog", { name: /Geçerlilik uzatma/ });
  const today = new Date();
  await dlg.locator('input[type="date"]').nth(0).fill(ymd(today));
  await dlg.locator('input[type="date"]').nth(1).fill(ymd(new Date(today.getTime() + 30 * 86_400_000)));
  await dlg.getByRole("button", { name: "Uzat" }).click();

  await expect(card.getByText(/Hastalık uzatması uygulandı/)).toBeVisible();
  // Olay yaşam döngüsüne düşer (işlem sonrası çizelge tazelenir).
  await expect(page.getByRole("list").getByText("Geçerlilik uzatıldı")).toBeVisible();
});

test("süresi dolmuş, hiç kullanılmamış bilet yalnız iade edilebilir (12.9.1)", async ({ page }) => {
  await page.goto("/tickets/2356000001025");
  const card = page.locator('[data-tour="ticket.validity"]');
  await expect(card.getByText("Süresi doldu", { exact: true })).toBeVisible();
  await expect(card.getByText(/yalnız iade edilebilir/)).toBeVisible();
});
