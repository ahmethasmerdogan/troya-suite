import { test, expect } from "@playwright/test";

// Onboarding modal'ını atla (pointer event'leri yakalıyor).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("troya.onboarded", "1"); localStorage.setItem("troya.user", "a.erdogan"); });
});

// Arama akışı — mock store'da bilinen bilet 2351234567890 (mockData.ts).
// searchTickets ticketNumber/surname/PNR/havalimanı ile filtreler.
test.describe("Ticket search & detail", () => {
  test("bilet numarasıyla arama sonucu döner ve detay açılır", async ({ page }) => {
    await page.goto("/search");

    const input = page.getByPlaceholder("TKT no · ERDOGAN · PNR · IST · TK198 · kart son4");
    await input.fill("2351234567890");

    // Sonuç satırı (DataTable hücresinde mono bilet no) görünür olmalı.
    const cell = page.getByText("2351234567890", { exact: true });
    await expect(cell).toBeVisible();

    // Satıra tıkla → ticket detail route'una git (onRowClick navigate).
    await cell.click();
    await expect(page).toHaveURL(/\/tickets\/2351234567890/);
  });

  test("eşleşmeyen aramada boş durum gösterilir", async ({ page }) => {
    await page.goto("/search");
    await page
      .getByPlaceholder("TKT no · ERDOGAN · PNR · IST · TK198 · kart son4")
      .fill("ZZZZZZZ-YOK");
    await expect(page.getByText("Eşleşen bilet bulunamadı")).toBeVisible();
  });

  test("gelişmiş arama paneli açılıp kapanır", async ({ page }) => {
    await page.goto("/search");
    await page.getByRole("button", { name: /Gelişmiş/ }).click();
    // Gelişmiş panelde "Yolcu soyadı" alanı (placeholder tam "ERDOGAN").
    await expect(page.getByPlaceholder("ERDOGAN", { exact: true })).toBeVisible();
  });
});
