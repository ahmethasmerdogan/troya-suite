import { describe, it, expect } from "vitest";
import { denialReason, paxSeatNotes, seatDenial } from "./seatRules";
import { SSR_CATALOG, ssrByCode, ssrCategoryLabel, ssrDefLabel, ssrLabel, SSR_CATEGORY_LABEL, SSR_CATEGORY_LABEL_EN } from "./ssr";
import { seatFromId, type CheckinPassenger, type Seat } from "./checkin";

/*
 * Kural AÇIKLAMALARININ İngilizcesi — yalnız METİN eklendi.
 *
 * Bu dosya iki şeyi birden kilitler:
 *   1. TR metinler BİREBİR aynı kaldı (varsayılan dil değişmedi),
 *   2. `en` yalnız metni değiştirir — kural kodu, not sayısı, uygunluk kararı
 *      hiçbir dilde farklı çıkmaz.
 * Mevcut davranışı kilitleyen `seatRules.test.ts` bu dosyayla değiştirilmedi.
 */
const FLIGHT = "TK198-D"; // B777-300ER: Business 1-8, exit 9/30/31, bulkhead 1/9
const base: CheckinPassenger = {
  id: "t1", surname: "TEST", givenName: "USER", pnr: "AAAAAA",
  cabin: "Economy", status: "not_checked", bags: 0,
};
const seat = (id: string): Seat => {
  const s = seatFromId(id, FLIGHT);
  if (!s) throw new Error("geçersiz koltuk: " + id);
  return s;
};

/** Her ret kodunu tetikleyen örnek — dört kural da denenir. */
const CASES: [string, CheckinPassenger, Seat][] = [
  ["CABIN", base, seat("3A")],
  ["EXIT", { ...base, infant: true }, seat("30A")],
  ["EXIT", { ...base, child: true }, seat("30A")],
  ["EXIT", { ...base, ssr: ["WCHR"] }, seat("30A")],
  ["WINDOW_ONLY", { ...base, ssr: ["WCHC"] }, seat("20C")],
  ["BULKHEAD", { ...base, ssr: ["PETC"] }, seatFromId("9A", "TK6-D")!],
];

describe("seatRules — gerekçenin İngilizcesi", () => {
  it("TR gerekçeler birebir korunur (varsayılan dil değişmedi)", () => {
    expect(seatDenial(base, seat("3A"))?.reason).toBe("Business kabini — yolcunun bileti Economy.");
    expect(seatDenial({ ...base, infant: true }, seat("30A"))?.reason)
      .toBe("Çıkış sırası — kucak bebeği olan yolcuya verilemez.");
    expect(seatDenial({ ...base, ssr: ["WCHC"] }, seat("20C"))?.reason)
      .toBe("WCHC/STCR — yalnızca pencere kenarına yer verilebilir.");
  });

  it("her ret hem TR hem EN gerekçe taşır; kod ve karar dilden bağımsız", () => {
    for (const [code, pax, s] of CASES) {
      const d = seatDenial(pax, s);
      expect(d?.code).toBe(code);
      expect(d!.reason.trim().length).toBeGreaterThan(0);
      expect(d!.reasonEn.trim().length).toBeGreaterThan(0);
      expect(d!.reasonEn).not.toBe(d!.reason);
      // EN gerekçede Türkçe'ye özgü harf kalmamalı (yarım çeviri kaçmasın).
      expect(d!.reasonEn).not.toMatch(/[çğışöüÇĞİŞÖÜ]/);
      // denialReason: varsayılan TR, "en" İngilizce.
      expect(denialReason(d!)).toBe(d!.reason);
      expect(denialReason(d!, "tr")).toBe(d!.reason);
      expect(denialReason(d!, "en")).toBe(d!.reasonEn);
    }
  });

  it("uygun koltuk her dilde uygundur (null)", () => {
    expect(seatDenial(base, seat("30B"))).toBeNull();
    expect(seatDenial({ ...base, ssr: ["WCHC"] }, seat("20A"))).toBeNull();
  });
});

describe("paxSeatNotes — dil yalnız metni seçer", () => {
  const pax: CheckinPassenger = { ...base, infant: true, child: true, ssr: ["WCHC", "PETC", "BLND"] };

  it("varsayılan çağrı TR kalır (mevcut çağıran yerler etkilenmez)", () => {
    expect(paxSeatNotes(pax)).toEqual(paxSeatNotes(pax, "tr"));
    expect(paxSeatNotes(pax)[0]).toBe("Kucak bebeği — çıkış sırası kapalı; ön sıra (bassinet) önerilir.");
  });

  it("EN aynı SAYIDA not üretir — kural değil metin değişir", () => {
    const tr = paxSeatNotes(pax, "tr");
    const en = paxSeatNotes(pax, "en");
    expect(en.length).toBe(tr.length);
    expect(en.length).toBe(5); // bebek + çocuk + WCHC + PETC + BLND
    for (let i = 0; i < en.length; i++) expect(en[i]).not.toBe(tr[i]);
    expect(en.join(" ")).not.toMatch(/[çğışöüÇĞİŞÖÜ]/);
    // SSR kodu her dilde notta durur — kod dil-bağımsız kimliktir.
    for (const code of ["WCHC", "PETC", "BLND"]) expect(en.join(" ")).toContain(code);
  });

  it("kısıtsız yolcu her dilde nota konu değildir", () => {
    expect(paxSeatNotes(base, "en")).toEqual([]);
  });
});

describe("SSR kataloğu — iki dilli açıklama", () => {
  it("her kayıtta TR ve EN açıklama var, kodlar değişmedi", () => {
    for (const s of SSR_CATALOG) {
      expect(s.code).toMatch(/^[A-Z]{4}$/);
      expect(s.label.trim().length).toBeGreaterThan(0);
      expect(s.labelEn.trim().length).toBeGreaterThan(0);
      expect(s.labelEn).not.toMatch(/[çğışöüÇĞİŞÖÜ]/);
      expect(ssrDefLabel(s)).toBe(s.label);
      expect(ssrDefLabel(s, "en")).toBe(s.labelEn);
    }
  });

  it("ssrLabel, ssrByCode(...)?.label ile aynı davranır", () => {
    expect(ssrLabel("WCHR")).toBe(ssrByCode("WCHR")?.label);
    expect(ssrLabel("wchr")).toBe(ssrByCode("WCHR")?.label); // büyük/küçük harf duyarsız
    expect(ssrLabel("WCHR", "en")).toBe("Wheelchair — can walk to the ramp");
    expect(ssrLabel("ZZZZ")).toBeUndefined();
    expect(ssrLabel("ZZZZ", "en")).toBeUndefined();
  });

  it("kategori etiketleri her iki dilde tam", () => {
    for (const cat of Object.keys(SSR_CATEGORY_LABEL) as (keyof typeof SSR_CATEGORY_LABEL)[]) {
      expect(SSR_CATEGORY_LABEL_EN[cat]?.trim().length).toBeGreaterThan(0);
      expect(ssrCategoryLabel(cat)).toBe(SSR_CATEGORY_LABEL[cat]);
      expect(ssrCategoryLabel(cat, "en")).toBe(SSR_CATEGORY_LABEL_EN[cat]);
    }
  });
});
