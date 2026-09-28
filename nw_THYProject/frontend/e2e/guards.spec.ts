import { test, expect, type Page } from "@playwright/test";

// Gece denetiminde kapatılan iki sınıf hata için kalıcı regresyonlar:
// (1) para işleminde çift tıklama çift satış üretmemeli (kural 5/9),
// (2) yetkisi olmayan personel bir işlemi ya da ekranı URL ile açamamalı.

async function as(page: Page, user: string, role: string) {
  await page.addInitScript(([u, r]) => {
    localStorage.setItem("troya.onboarded", "1");
    localStorage.setItem("troya.lang", "tr");
    localStorage.setItem("troya.user", u);
    localStorage.setItem("troya.role", r);
  }, [user, role]);
}

test("kesim onayına çift tıklamak tek bilet keser", async ({ page }) => {
  await as(page, "a.erdogan", "admin");
  await page.goto("/issue");
  await page.getByPlaceholder("ERDOGAN").fill("CIFTTIK");
  await page.getByPlaceholder("AHMET").fill("TEST");
  await page.getByRole("button", { name: /İleri/ }).click();

  for (const [ph, code] of [["İstanbul / IST", "IST"], ["Tokyo / NRT", "ESB"]] as const) {
    const box = page.getByPlaceholder(ph);
    await box.click();
    await box.fill(code);
    await box.press("Enter");
  }
  await page.getByRole("button", { name: /Gün.*Ay.*Yıl/ }).click();
  await page.getByRole("button", { name: "Bugün", exact: true }).click();
  const flight = page.locator("button[aria-pressed]").first();
  await flight.click();
  await page.getByRole("button", { name: /İleri/ }).click();

  const offer = page.locator("button[aria-pressed]").first();
  await expect(offer).toBeVisible({ timeout: 10_000 });
  await offer.click();
  await page.getByRole("button", { name: /İleri/ }).click();
  await page.getByRole("button", { name: /Nakit/ }).first().click();
  await page.getByRole("button", { name: /İleri/ }).click();

  await page.getByRole("button", { name: /Bileti Kes/ }).click({ force: true });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Onaylıyorum/ }).dblclick({ force: true });
  await expect(page.getByRole("dialog", { name: "Bilet kesildi" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Bilet kaydını aç/ }).click();
  await expect(page).toHaveURL(/\/tickets\/235\d+/);

  // Bellek-içi mock: sayfa yenilenmeden (istemci tarafı gezinmeyle) aramaya geç.
  await page.getByRole("link", { name: "Bilet Ara" }).first().click();
  await page.getByPlaceholder("TKT no · ERDOGAN · PNR · IST · TK198 · kart son4").fill("CIFTTIK");
  await expect(page.getByRole("row").filter({ hasText: "CIFTTIK" })).toHaveCount(1);
});

test("personel iade akışını URL ile açamaz", async ({ page }) => {
  await as(page, "e.demir", "staff");
  await page.goto("/tickets/2351234567890?flow=refund");
  await expect(page.getByText("Bu ekrana erişim yetkiniz yok").first()).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("personel HUB Kontrol ekranını URL ile açamaz", async ({ page }) => {
  await as(page, "e.demir", "staff");
  await page.goto("/ops");
  await expect(page.getByText("Bu ekrana erişim yetkiniz yok").first()).toBeVisible();
});
