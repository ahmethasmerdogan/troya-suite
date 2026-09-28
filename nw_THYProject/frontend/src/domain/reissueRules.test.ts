import { describe, it, expect } from "vitest";
import { quoteReissue } from "./reissueRules";
import { ticketValidity } from "./validity";
import { demoNow } from "./demoClock";
import type { CouponStatus, Segment, TaxFeeCharge, Ticket } from "./types";

// Handbook 12.5 / 12.7 / 12.11 — ADC, PD vergi matrisi, residual.
// ADC = ücret farkı + ARTAN vergi. Ceza handbook'ta yoktur; Cat 31'den gelir.

const seg = (o: string, d: string, rbd = "Y", fareBasis = "YFLEX", dep = "2030-09-01T08:00:00Z"): Segment => ({
  origin: o, destination: d, marketingCarrier: "TK", flightNumber: "1", rbd,
  departure: dep, arrival: dep, fareBasis, reservationStatus: "HK",
});

const tfc = (code: string, amount: number): TaxFeeCharge => ({ code, amount: { amount, currency: "TRY" } });

function ticket(opts: {
  statuses: CouponStatus[]; route: [string, string][]; base: number;
  tfcs: TaxFeeCharge[]; rbd?: string; fareBasis?: string;
}): Ticket {
  const totalTfc = opts.tfcs.reduce((s, t) => s + t.amount.amount, 0);
  return {
    ticketNumber: "2351234567890",
    passenger: { surname: "TEST", givenName: "USER" },
    validatingCarrier: "TK",
    coupons: opts.statuses.map((s, i) => ({
      seq: i + 1, status: s,
      segment: seg(opts.route[i][0], opts.route[i][1], opts.rbd ?? "Y", opts.fareBasis ?? "YFLEX"),
    })),
    fare: {
      baseFare: { amount: opts.base, currency: "TRY" },
      totalTfc: { amount: totalTfc, currency: "TRY" },
      total: { amount: opts.base + totalTfc, currency: "TRY" },
      tfcs: opts.tfcs,
    },
    formOfPayment: { type: "cash" },
    control: { holder: "TK", isValidatingCarrier: true },
    issuedAt: "2026-08-01T10:00:00Z",
    history: [],
  };
}

const RT = (): [string, string][] => [["IST", "JFK"], ["JFK", "IST"]];

describe("12.5(c) — PD vergi matrisi", () => {
  const base = ticket({ statuses: ["O", "O"], route: RT(), base: 10000, tfcs: [tfc("TR", 1000), tfc("YQ", 500)] });

  it("(i) vergi değişmediyse PD ile taşınır, yeniden tahsil edilmez", () => {
    const q = quoteReissue({
      ticket: base, newBaseFare: 10000,
      newTfcs: [tfc("TR", 1000), tfc("YQ", 500)],
      newSegments: [seg("IST", "JFK"), seg("JFK", "IST")],
    });
    const tr = q.tfcLines.find((l) => l.code === "TR")!;
    expect(tr.disposition).toBe("pd_carry_forward");
    expect(tr.ticketText).toBe("PD1000.00TR");
    expect(tr.delta).toBe(0);
    expect(q.tfcAdditional).toBe(0);
  });

  it("(iii) vergi arttıysa yalnız FARK tahsil edilir (tam tutar değil)", () => {
    const q = quoteReissue({
      ticket: base, newBaseFare: 10000,
      newTfcs: [tfc("TR", 1400), tfc("YQ", 500)],
      newSegments: [seg("IST", "LAX"), seg("LAX", "IST")],
    });
    const tr = q.tfcLines.find((l) => l.code === "TR")!;
    expect(tr.disposition).toBe("collect_additional");
    expect(tr.delta).toBe(400);
    expect(q.tfcAdditional).toBe(400);
    expect(q.adc).toBe(400);
  });

  it("(ii) vergi azaldıysa ve iade edilebilirse fark iade edilir", () => {
    const q = quoteReissue({
      ticket: base, newBaseFare: 10000,
      newTfcs: [tfc("TR", 600), tfc("YQ", 500)],
      newSegments: [seg("IST", "AMS"), seg("AMS", "IST")],
    });
    const tr = q.tfcLines.find((l) => l.code === "TR")!;
    expect(tr.disposition).toBe("pd_new_amount");
    expect(tr.ticketText).toBe("PD600.00TR");
    expect(q.tfcRefunded).toBe(400);
  });

  it("(ii) vergi azaldı ama iade edilemezse ORİJİNAL tutar taşınır", () => {
    // eco-saver: iade edilemez → YQ ücret kuralını izler ve iade edilmez.
    const nonRef = ticket({
      statuses: ["O", "O"], route: RT(), base: 10000,
      tfcs: [tfc("YQ", 800)], rbd: "V", fareBasis: "VSAVER",
    });
    const q = quoteReissue({
      ticket: nonRef, newBaseFare: 10000,
      newTfcs: [tfc("YQ", 300)],
      newSegments: [seg("IST", "AMS", "V", "VSAVER"), seg("AMS", "IST", "V", "VSAVER")],
    });
    const yq = q.tfcLines.find((l) => l.code === "YQ")!;
    expect(yq.disposition).toBe("forfeit_difference");
    expect(yq.ticketText).toBe("PD800.00YQ"); // orijinal (yüksek) tutar
    expect(q.tfcRefunded).toBe(0);
    expect(q.tfcForfeited).toBe(500);
  });

  it("(iv) vergi artık uygulanmıyorsa kutu boşalır ve iade edilir", () => {
    const q = quoteReissue({
      ticket: base, newBaseFare: 10000,
      newTfcs: [tfc("YQ", 500)], // TR kalktı
      newSegments: [seg("IST", "ESB"), seg("ESB", "IST")],
    });
    const tr = q.tfcLines.find((l) => l.code === "TR")!;
    expect(tr.disposition).toBe("blank_no_longer_applicable");
    expect(tr.ticketText).toBe("");
    expect(q.tfcRefunded).toBe(1000);
  });
});

describe("12.5(d) — ADC ve Total kutusu", () => {
  const base = ticket({ statuses: ["O", "O"], route: RT(), base: 10000, tfcs: [tfc("TR", 1000)] });

  it("ücret ve vergi değişmediyse NO ADC", () => {
    const q = quoteReissue({
      ticket: base, newBaseFare: 10000, newTfcs: [tfc("TR", 1000)],
      newSegments: [seg("IST", "JFK"), seg("JFK", "IST")],
    });
    expect(q.noAdc).toBe(true);
    expect(q.totalBoxText).toBe("NO ADC");
  });

  it("ek tahsilat varsa tutarın sonuna 'A' gelir", () => {
    const q = quoteReissue({
      ticket: base, newBaseFare: 12000, newTfcs: [tfc("TR", 1000)],
      newSegments: [seg("IST", "LAX"), seg("LAX", "IST")],
    });
    expect(q.fareDiff).toBe(2000);
    expect(q.adc).toBe(2000);
    expect(q.totalBoxText).toMatch(/A$/);
  });

  it("ADC = ücret farkı + ARTAN vergi (ceza ayrı kalem olarak eklenir)", () => {
    const classic = ticket({
      statuses: ["O", "O"], route: RT(), base: 10000,
      tfcs: [tfc("TR", 1000)], rbd: "M", fareBasis: "MCLASSIC",
    });
    const q = quoteReissue({
      ticket: classic, newBaseFare: 11000, newTfcs: [tfc("TR", 1200)],
      newSegments: [seg("IST", "LAX", "M", "MCLASSIC"), seg("LAX", "IST", "M", "MCLASSIC")],
    });
    expect(q.fareDiff).toBe(1000);
    expect(q.tfcAdditional).toBe(200);
    expect(q.penalty).toBe(750); // eco-classic kalkıştan önce
    expect(q.adc).toBe(1000 + 200 + 750);
  });
});

describe("12.11.2 — residual (bakiye)", () => {
  it("yeni ücret düşükse bakiye ADC ile NETLENMEZ, ayrı belge olur", () => {
    const t = ticket({ statuses: ["O", "O"], route: RT(), base: 12000, tfcs: [tfc("TR", 1000)] });
    const q = quoteReissue({
      ticket: t, newBaseFare: 9000, newTfcs: [tfc("TR", 1000)],
      newSegments: [seg("IST", "AMS"), seg("AMS", "IST")],
    });
    expect(q.residual?.amount).toBe(3000);
    expect(q.adc).toBe(0);
    expect(q.totalBoxText).toBe("NO ADC");
  });

  it("düşük ücret + yüksek vergi: bakiye ve ek tahsilat AYNI ANDA var olur", () => {
    const t = ticket({ statuses: ["O", "O"], route: RT(), base: 12000, tfcs: [tfc("TR", 1000)] });
    const q = quoteReissue({
      ticket: t, newBaseFare: 9000, newTfcs: [tfc("TR", 1500)],
      newSegments: [seg("IST", "AMS"), seg("AMS", "IST")],
    });
    expect(q.residual?.amount).toBe(3000);
    expect(q.adc).toBe(500); // yalnız artan vergi
    expect(q.totalBoxText).toMatch(/A$/);
  });

  it("iade edilemez bilette bakiye nakde çevrilmez, EMD-S olur", () => {
    const t = ticket({
      statuses: ["O", "O"], route: RT(), base: 12000,
      tfcs: [tfc("TR", 1000)], rbd: "V", fareBasis: "VSAVER",
    });
    const q = quoteReissue({
      ticket: t, newBaseFare: 9000, newTfcs: [tfc("TR", 1000)],
      newSegments: [seg("IST", "AMS", "V", "VSAVER"), seg("AMS", "IST", "V", "VSAVER")],
    });
    expect(q.residual?.refundable).toBe(false);
    expect(q.residual?.document).toBe("emd_s");
  });

  it("ceza bakiyeden DÜŞÜLÜR; bakiye yetmezse fark tahsil edilir", () => {
    const t = ticket({
      statuses: ["O", "O"], route: RT(), base: 12000,
      tfcs: [tfc("TR", 1000)], rbd: "M", fareBasis: "MCLASSIC",
    });
    // eco-classic değişiklik ücreti 750; bakiye 500 → 250 tahsil edilir.
    const q = quoteReissue({
      ticket: t, newBaseFare: 11500, newTfcs: [tfc("TR", 1000)],
      newSegments: [seg("IST", "AMS", "M", "MCLASSIC"), seg("AMS", "IST", "M", "MCLASSIC")],
    });
    expect(q.penalty).toBe(750);
    expect(q.residual).toBeUndefined();
    expect(q.adc).toBe(250);
  });
});

describe("12.1.1 / 12.4.1 — fiyatlama tabanı ve geçerlilik", () => {
  it("kısmen kullanılmış bilette taban orijinal kesim tarihidir ve taze yıl vermez", () => {
    const t = ticket({ statuses: ["F", "O"], route: RT(), base: 10000, tfcs: [tfc("TR", 1000)] });
    const q = quoteReissue({
      ticket: t, newBaseFare: 11000, newTfcs: [tfc("TR", 1000)],
      newSegments: [seg("IST", "JFK"), seg("JFK", "LAX")],
    });
    expect(q.basis).toBe("original_issue_date");
    // 12.4.1: yeni bilet, orijinal satış tarihinde kesilmiş olsaydı geçerli
    // olacak bitişle sınırlıdır — orijinal biletin kendi bitişi (yolculuk
    // başlangıcından bir yıl). Yeni kesim tarihinden taze bir yıl VERİLMEZ.
    expect(q.validUntil).toBe(ticketValidity(t, demoNow()).until);
    expect(q.notes.join(" ")).toMatch(/taze bir yıl kazandırmaz/);
  });

  it("hiç kullanılmamış bilette taban günceldir ve geçerlilik seyahatten itibaren bir yıldır", () => {
    const t = ticket({ statuses: ["O", "O"], route: RT(), base: 10000, tfcs: [tfc("TR", 1000)] });
    const q = quoteReissue({
      ticket: t, newBaseFare: 11000, newTfcs: [tfc("TR", 1000)],
      newSegments: [seg("IST", "LAX"), seg("LAX", "IST")],
    });
    expect(q.basis).toBe("current");
    expect(new Date(q.validUntil).getFullYear()).toBe(2031); // seyahat 2030 + 1
  });
});
