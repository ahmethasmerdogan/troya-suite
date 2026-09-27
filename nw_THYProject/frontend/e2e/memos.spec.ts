import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("troya.onboarded", "1"); localStorage.setItem("troya.lang", "tr"); localStorage.setItem("troya.user", "a.erdogan"); });
});

// ADM/ACM — acente dekontu kesilir, acente itiraz eder, itiraz karara bağlanır.
test("acente satışına ADM kesilir; inceleme süresinde faturalanmaz; itiraz kabulüyle geri çekilir", async ({ page }) => {
  await page.goto("/memos");
  await expect(page.getByRole("heading", { name: "ADM / ACM" })).toBeVisible();
  const firstRow = page.locator("tbody tr", { hasText: "235-" }).first();
  await expect(firstRow).toBeVisible();
  // Tohum dekontlarından birinin bileti acente satışıdır — yeni dekont ona kesilir.
  const tn = ((await firstRow.innerText()).match(/\b\d{13}\b/) ?? [""])[0];
  expect(tn).toMatch(/^\d{13}$/);

  await page.getByRole("button", { name: "Dekont kes" }).click();
  const dlg = page.getByRole("dialog", { name: "Dekont kes" });
  await dlg.getByRole("textbox", { name: "Bilet no" }).fill(tn);
  await expect(dlg.getByText(/Satan acente:/)).toBeVisible();
  await dlg.getByRole("combobox", { name: "Gerekçe" }).selectOption({ label: "Kesim süresi (TTL) ihlali" });
  await dlg.getByRole("textbox", { name: "Ücret farkı" }).fill("500");
  await dlg.getByRole("button", { name: "Dekontu kes" }).click();

  const drawer = page.getByRole("dialog", { name: /^ADM 235-ADM-/ });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("button", { name: "BSP faturasına al" })).toBeDisabled();
  await expect(drawer.getByText(/inceleme süresi/)).toBeVisible();

  await drawer.getByRole("textbox", { name: "İtiraz gerekçesi" }).fill("Rezervasyon süresinde biletlendi");
  await drawer.getByRole("button", { name: /Acente itirazını kaydet/ }).click();
  await expect(drawer.getByText("Acente itirazı")).toBeVisible();
  await drawer.getByRole("button", { name: /İtirazı kabul et/ }).click();
  await expect(drawer.getByText("Geri çekildi").first()).toBeVisible();
});
