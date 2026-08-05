import { describe, expect, it } from "vitest";
import {
  isTfcRefundable,
  taxName,
  tfcRefundReason,
  tfcRefundReasonKey,
  translateTfcReason,
} from "./taxCodes";

/**
 * Vergi kataloğunun DİL katmanı.
 *
 * Buradaki testlerin tek amacı: EN eklendi ama TR ve HESAP hiç değişmedi.
 * Kural/eşik testleri taxCodes.test.ts'te durur; oraya dokunulmadı.
 */

describe("taxName", () => {
  it("TR varsayılandır", () => {
    expect(taxName("VQ")).toBe("Havalimanı Hizmet Ücreti (iç hat)");
    expect(taxName("vq")).toBe("Havalimanı Hizmet Ücreti (iç hat)");
  });

  it("EN istenince handbook adını verir", () => {
    expect(taxName("VQ", "en")).toBe("Airport Service Charge (Domestic)");
    expect(taxName("AY", "en")).toBe("September 11th Security Fee");
  });

  it("katalogda olmayan kodda undefined döner — çağıran kendi yedeğini basar", () => {
    expect(taxName("ZZ", "en")).toBeUndefined();
    expect(taxName(undefined)).toBeUndefined();
  });
});

describe("tfcRefundReason — TR metinler birebir korunur", () => {
  it("olay bazlı, uçulmadı", () => {
    expect(tfcRefundReason("TR", false, true)).toBe("Kalkış gerçekleşmedi — harç doğmadı, iade edilir.");
  });
  it("uçuldu", () => {
    expect(tfcRefundReason("TR", true, true)).toBe("Kupon uçuldu — harç doğdu, iade edilmez.");
  });
  it("ödenen tutara bağlı — ücret iade edilebilir", () => {
    expect(tfcRefundReason("KDV", false, true)).toBe("Ödenen tutara bağlı; ücret iade edilebilir olduğu için iade edilir.");
  });
  it("ödenen tutara bağlı — ücret iade edilemez", () => {
    expect(tfcRefundReason("KDV", false, false)).toBe("Ödenen tutara bağlı; ücret iade edilemediği için iade edilmez.");
  });
  it("her hâlde iade (US AY)", () => {
    expect(tfcRefundReason("AY", true, false)).toBe("Kullanılmasa da iade edilir (yasal düzenleme).");
  });
  it("dil parametresi verilmeyince TR — eski çağrı yerleri aynen çalışır", () => {
    expect(tfcRefundReason("XF", false, false)).toBe(tfcRefundReason("XF", false, false, "tr"));
  });
});

describe("tfcRefundReason — EN", () => {
  it("her dal için İngilizce karşılık üretir", () => {
    expect(tfcRefundReason("TR", false, true, "en")).toBe(
      "Departure did not take place — no charge was incurred, so it is refunded.",
    );
    expect(tfcRefundReason("TR", true, true, "en")).toBe(
      "Coupon flown — the charge was incurred, so it is not refunded.",
    );
    expect(tfcRefundReason("AY", true, false, "en")).toBe("Refunded even when unused (statutory requirement).");
  });

  it("gerekçe kimliği dilden bağımsızdır", () => {
    expect(tfcRefundReasonKey("XF", false, false)).toBe("followsFareForfeited");
    expect(tfcRefundReasonKey("XF", false, true)).toBe("followsFareRefunded");
  });
});

describe("translateTfcReason", () => {
  const cases: Array<[string, boolean, boolean]> = [
    ["TR", false, true],
    ["TR", true, true],
    ["KDV", false, true],
    ["KDV", false, false],
    ["AY", true, false],
    ["ZZ", false, false],
  ];

  it("hesaplanmış TR metni EN karşılığına çevirir", () => {
    for (const [code, flown, refundable] of cases) {
      expect(translateTfcReason(tfcRefundReason(code, flown, refundable), "en")).toBe(
        tfcRefundReason(code, flown, refundable, "en"),
      );
    }
  });

  it("TR istenince metne dokunmaz", () => {
    expect(translateTfcReason("Bu kupon iade edilmiyor.")).toBe("Bu kupon iade edilmiyor.");
  });

  it("tanınmayan metin olduğu gibi döner — cümle kaybolmaz", () => {
    expect(translateTfcReason("Kuruma özel serbest not.", "en")).toBe("Kuruma özel serbest not.");
  });
});

describe("hesap değişmedi", () => {
  it("iade edilebilirlik kararı dil eklendikten sonra da aynı", () => {
    expect(isTfcRefundable("TR", false, false)).toBe(true);
    expect(isTfcRefundable("TR", true, true)).toBe(false);
    expect(isTfcRefundable("KDV", false, false)).toBe(false);
    expect(isTfcRefundable("XF", false, true)).toBe(true);
    expect(isTfcRefundable("AY", true, false)).toBe(true);
    expect(isTfcRefundable("ZZ", false, false)).toBe(true);
  });
});
