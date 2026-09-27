import { test, expect } from "@playwright/test";

// Ad düzeltme — düzeltme ile devir ayrılır; düzeltme eşit reissue ile yeni bilet üretir.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("troya.onboarded", "1"); localStorage.setItem("troya.lang", "tr");
    localStorage.setItem("troya.user", "a.erdogan");
  });
});

test("başka bir ad devirdir, kesim kilitlenir; yazım hatası düzeltilir ve yeni bilet açılır", async ({ page }) => {
  await page.goto("/tickets/2351234567890");
  await page.getByRole("button", { name: /İşlemler/ }).click();
  await page.getByRole("menuitem", { name: /Ad düzeltme/ }).click();

  const dlg = page.getByRole("dialog", { name: "Ad düzeltme" });
  const given = dlg.getByRole("textbox", { name: "Ad", exact: true });
  const submit = dlg.getByRole("button", { name: "Düzelt ve yeniden kes" });

  await given.fill("ZEYNEP");
  await expect(dlg.getByText(/DEVİR/)).toBeVisible();
  await expect(submit).toBeDisabled();

  await given.fill("AHMED");
  await expect(dlg.getByText(/Yazım hatası — 1 karakter/)).toBeVisible();
  await submit.click();

  await expect(page).not.toHaveURL(/2351234567890$/, { timeout: 15_000 });
  await expect(page.getByText("ERDOGAN/AHMED").first()).toBeVisible();
  await expect(page.getByText("NAME CORRECTION").first()).toBeVisible();
});
