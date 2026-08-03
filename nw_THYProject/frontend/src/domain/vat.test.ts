import { describe, it, expect } from "vitest";
import { computeVat, vatRateAt } from "./vat";

// KDV Kanunu md.20/4 (bedel KDV dahil), md.14 (uluslararası istisna),
// md.13/b (yolcu servis ücreti istisnası), md.35 (iade düzeltmesi).

describe("KDV — yurt içi hava taşıması", () => {
  it("KDV toplamın İÇİNDEN iç yüzdeyle ayrıştırılır, üstüne eklenmez", () => {
    const v = computeVat(12000, true, "2026-08-03T00:00:00Z");
    expect(v.regime).toBe("taxable");
    expect(v.rate).toBe(0.2);
    // 12000 KDV dahil → matrah 10000, KDV 2000
    expect(v.amount).toBe(2000);
  });

  it("uluslararası taşıma istisnadır (md.14) — KDV sıfırdır", () => {
    const v = computeVat(12000, false, "2026-08-03T00:00:00Z");
    expect(v.regime).toBe("exempt");
    expect(v.exemptionArticle).toBe("KDV_14");
    expect(v.amount).toBe(0);
  });
});

describe("md.35 — iade düzeltmesi kesim tarihindeki oranla yapılır", () => {
  it("tarihli oran tablosu doğru dönemi verir", () => {
    expect(vatRateAt("2026-08-03")).toBe(0.2);
    expect(vatRateAt("2023-01-15")).toBe(0.18); // 10.07.2023 öncesi
    expect(vatRateAt("2020-05-01")).toBe(0.01); // COVID indirimi
  });

  it("eski tarihli bilette eski oran kullanılır", () => {
    const v = computeVat(11800, true, "2023-01-15T00:00:00Z");
    expect(v.rate).toBe(0.18);
    expect(v.amount).toBe(1800); // 11800 KDV dahil, %18 → 1800
  });
});
