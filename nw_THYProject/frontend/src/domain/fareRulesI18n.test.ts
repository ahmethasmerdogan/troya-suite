import { describe, expect, it } from "vitest";
import { computePenalty, fareRuleFor, ruleSummary, waiverLabel } from "./fareRules";
import { CHANGE_TYPE_LABEL, CHANGE_TYPE_LABEL_EN, changeTypeLabel, classifyChange } from "./changeRules";
import { FARE_TYPES } from "./fareTypes";
import type { Coupon, Segment, Ticket } from "./types";

/*
 * Kural metinlerinin İngilizcesi — SADECE metin eklendi.
 * Bu dosyanın asıl işi, dilin hiçbir SAYIYI ve hiçbir SINIFLANDIRMAYI
 * değiştirmediğini kilitlemek.
 */

const seg = (origin: string, destination: string, rbd = "Y"): Segment => ({
  origin, destination, marketingCarrier: "TK", flightNumber: "1", rbd,
  departure: "2026-09-01T08:00:00Z", arrival: "2026-09-01T12:00:00Z",
  fareBasis: "YFLEX", reservationStatus: "OK",
});

const coupon = (seq: number, s: Segment, status: Coupon["status"] = "O"): Coupon =>
  ({ seq, segment: s, status } as Coupon);

const ticket = (coupons: Coupon[]): Ticket => ({ coupons } as Ticket);

describe("kural metinleri — dil yalnız metni değiştirir", () => {
  it("varsayılan dil TR kalır (çağıran değişmeden)", () => {
    expect(ruleSummary(fareRuleFor("bilinmeyen"))[0]).toMatch(/ücretsiz/);
    expect(ruleSummary(fareRuleFor("eco-promo"))).toEqual(ruleSummary(fareRuleFor("eco-promo"), undefined, "tr"));
    expect(waiverLabel("family_death")).toBe("yakının vefatı");
  });

  it("EN özeti aynı sayıda satır üretir ve Türkçe kalıntı bırakmaz", () => {
    for (const ft of FARE_TYPES) {
      const rule = fareRuleFor(ft.id);
      const tr = ruleSummary(rule);
      const en = ruleSummary(rule, undefined, "en");
      expect(en).toHaveLength(tr.length);
      expect(en.join(" ")).not.toMatch(/kalkıştan|Muafiyet|İade|Değişiklik|ücretsiz|yok,/);
    }
  });

  it("EN metinde de aynı tutarlar geçer (yalnız binlik ayracı yerelleşir)", () => {
    const rule = fareRuleFor("biz-classic")!;
    const tr = ruleSummary(rule).join(" ");
    const en = ruleSummary(rule, undefined, "en").join(" ");
    expect(tr).toContain("1.500");
    expect(en).toContain("1,500");
    expect(tr).toContain("3.000");
    expect(en).toContain("3,000");
  });

  it("ceza gerekçesinin İngilizcesi tutarı DEĞİŞTİRMEZ", () => {
    const r = fareRuleFor("biz-saver")!.change!.beforeDeparture!;
    const p = computePenalty(r, 20000)!;
    expect(p.amount).toBe(3000); // fareRules.test.ts'teki hesabın aynısı
    expect(p.explain).toContain("yüksek olan");
    expect(p.explainEn).toContain("higher of");
    expect(p.explainEn).not.toMatch(/[çğışöü]/i);
  });

  it("değişiklik türü etiketi dile göre seçilir, tür aynı kalır", () => {
    expect(changeTypeLabel("reissue")).toBe(CHANGE_TYPE_LABEL.reissue);
    expect(changeTypeLabel("reissue", "en")).toBe(CHANGE_TYPE_LABEL_EN.reissue);
  });

  it("classifyChange sınıflandırması aynı; yalnız rationaleEn eklendi", () => {
    const t = ticket([coupon(1, seg("IST", "JFK")), coupon(2, seg("JFK", "IST"))]);
    const a = classifyChange(t, [seg("IST", "LAX"), seg("LAX", "IST")]);
    expect(a.type).toBe("rerouting");
    expect(a.recommendedFlow).toBe("exchange");
    expect(a.rationale).toContain("REROUTING");
    expect(a.rationaleEn).toContain("REROUTING");
    expect(a.rationaleEn).not.toMatch(/[çğışöü]/i);
  });

  it("her ücret ailesinin İngilizce açıklaması var", () => {
    for (const ft of FARE_TYPES) {
      expect(ft.noteEn.length).toBeGreaterThan(0);
      expect(ft.noteEn).not.toMatch(/[çğışöü]/i);
    }
  });
});
