import { describe, it, expect } from "vitest";
import { isCarrierImposed, isTfcRefundable, taxByCode } from "./taxCodes";

// Handbook 14.1 (TFC tipleri) / 14.2 (ülke-kod tablosu) + 12.11 ("refund the
// difference, if refundable") — iade edilebilirlik KALEM BAZINDADIR.

describe("14.2 — ülke ve kod eşlemesi", () => {
  it("Türkiye: iç hat VQ, dış hat TR", () => {
    expect(taxByCode("VQ")?.scope).toBe("domestic");
    expect(taxByCode("TR")?.scope).toBe("international");
    expect(taxByCode("VQ")?.country).toBe("TR");
  });

  it("YQ/YR taşıyıcı kaynaklıdır, devlet vergisi değildir", () => {
    expect(isCarrierImposed("YQ")).toBe(true);
    expect(isCarrierImposed("YR")).toBe(true);
    expect(isCarrierImposed("TR")).toBe(false);
  });
});

describe("iade edilebilirlik", () => {
  it("havalimanı harcı: kupon uçulmadıysa iade edilir, uçulduysa edilmez", () => {
    expect(isTfcRefundable("TR", false, true)).toBe(true);
    expect(isTfcRefundable("TR", true, true)).toBe(false);
  });

  it("havalimanı harcı iade edilemez ücrette de iade edilir (vergi ücret kuralına tabi değildir)", () => {
    expect(isTfcRefundable("VQ", false, false)).toBe(true);
  });

  it("taşıyıcı ek ücreti (YQ) ücret kuralına tabidir — iade edilemez üründe iade edilmez", () => {
    expect(isTfcRefundable("YQ", false, true)).toBe(true);
    expect(isTfcRefundable("YQ", false, false)).toBe(false);
  });

  // KDV ödenen tutar üzerinden alınır → ücretin iade edilebilirliğini izler.
  it("KDV ücret kuralını izler: ücret iade edilirse iade edilir, edilmezse edilmez", () => {
    expect(isTfcRefundable("KDV", false, true)).toBe(true);
    expect(isTfcRefundable("KDV", false, false)).toBe(false);
    expect(isTfcRefundable("KDV", true, true)).toBe(false); // uçulmuş kupon
  });

  // US XF: devlet harcı olmasına rağmen ücretin kuralını izler (14 C.F.R. §158.45).
  it("US XF istisnası: devlet harcı ama ücret kuralına tabi", () => {
    expect(isTfcRefundable("XF", false, false)).toBe(false);
    expect(isTfcRefundable("XF", false, true)).toBe(true);
  });

  // US AY: kullanılmamış/iade edilemez bilette bile iade edilir (49 U.S.C. §44940).
  it("US AY güvenlik ücreti iade edilemez bilette bile iade edilir", () => {
    expect(isTfcRefundable("AY", false, false)).toBe(true);
  });

  it("katalogda olmayan kod: uçulmadıysa iade edilebilir kabul edilir", () => {
    expect(isTfcRefundable("ZZ", false, false)).toBe(true);
    expect(isTfcRefundable("ZZ", true, true)).toBe(false);
  });
});
