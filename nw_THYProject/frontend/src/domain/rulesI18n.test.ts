import { describe, it, expect } from "vitest";
import { quoteRefund, INVOLUNTARY_REASON_LABEL, INVOLUNTARY_REASON_LABEL_EN } from "./refundRules";
import { quoteReissue } from "./reissueRules";
import type { CouponStatus, Segment, TaxFeeCharge, Ticket } from "./types";

// İade / reissue gerekçelerinin İNGİLİZCE karşılıkları.
//
// Bu dosya YALNIZ metin katmanını kilitler: her TR açıklamanın aynı sırada bir
// EN karşılığı olmalı ve EN metin Türkçe harf İÇERMEMELİ. Sayısal sonuçlar
// refundRules/reissueRules/fareRules testlerinde kilitlidir; burada birkaç
// tutar, "EN eklenmesi hesabı oynatmadı" kanıtı olarak tekrar doğrulanır.

const TURKISH = /[çğıöşüÇĞİÖŞÜ]/;

const seg = (o: string, d: string, rbd = "Y", fareBasis = "YFLEX", dep = "2030-09-01T08:00:00Z"): Segment => ({
  origin: o, destination: d, marketingCarrier: "TK", flightNumber: "1", rbd,
  departure: dep, arrival: dep, fareBasis, reservationStatus: "HK",
});

const tfc = (code: string, amount: number): TaxFeeCharge => ({ code, amount: { amount, currency: "TRY" } });

function ticket(opts: {
  statuses: CouponStatus[]; route: [string, string][]; base?: number;
  tfcs?: TaxFeeCharge[]; rbd?: string; fareBasis?: string; noShow?: number[];
}): Ticket {
  const base = opts.base ?? 10000;
  const tfcs = opts.tfcs ?? [tfc("TR", 1500), tfc("YQ", 500)];
  const totalTfc = tfcs.reduce((s, t) => s + t.amount.amount, 0);
  return {
    ticketNumber: "2351234567890",
    passenger: { surname: "TEST", givenName: "USER" },
    validatingCarrier: "TK",
    coupons: opts.statuses.map((s, i) => ({
      seq: i + 1, status: s,
      segment: seg(opts.route[i][0], opts.route[i][1], opts.rbd ?? "Y", opts.fareBasis ?? "YFLEX"),
      ...(opts.noShow?.includes(i + 1) ? { noShow: true } : {}),
    })),
    fare: {
      baseFare: { amount: base, currency: "TRY" },
      totalTfc: { amount: totalTfc, currency: "TRY" },
      total: { amount: base + totalTfc, currency: "TRY" },
      tfcs,
    },
    formOfPayment: { type: "cash" },
    control: { holder: "TK", isValidatingCarrier: true },
    issuedAt: "2026-08-01T10:00:00Z",
    history: [],
  };
}

const RT = (): [string, string][] => [["IST", "JFK"], ["JFK", "IST"]];

describe("iade gerekçeleri — TR/EN paritesi", () => {
  const scenarios = () => [
    {
      name: "involuntary, hiç kullanılmamış",
      q: quoteRefund({ ticket: ticket({ statuses: ["O", "O"], route: RT() }), couponSeqs: [1, 2], refundType: "involuntary", reason: "flight_cancellation" }),
    },
    {
      name: "involuntary, kısmen kullanılmış (iki hesap)",
      q: quoteRefund({ ticket: ticket({ statuses: ["F", "O"], route: RT() }), couponSeqs: [2], refundType: "involuntary", reason: "safety_legal" }),
    },
    {
      name: "voluntary, cezalı",
      q: quoteRefund({ ticket: ticket({ statuses: ["O", "O"], route: RT(), rbd: "J", fareBasis: "JCLASSIC", base: 20000, noShow: [1] }), couponSeqs: [1], refundType: "voluntary" }),
    },
    {
      name: "iade edilemez ürün",
      q: quoteRefund({ ticket: ticket({ statuses: ["O", "O"], route: RT(), rbd: "V", fareBasis: "VSAVER" }), couponSeqs: [1, 2], refundType: "voluntary" }),
    },
    {
      name: "yalnız vergi iadesi (Y)",
      q: quoteRefund({ ticket: ticket({ statuses: ["O"], route: [["IST", "JFK"]] }), couponSeqs: [1], refundType: "voluntary", taxOnly: true }),
    },
    {
      name: "muafiyetli iade",
      q: quoteRefund({ ticket: ticket({ statuses: ["O", "O"], route: RT(), rbd: "M", fareBasis: "MCLASSIC" }), couponSeqs: [1, 2], refundType: "voluntary", waiver: "death" }),
    },
  ];

  it("her TR açıklamanın aynı sırada bir EN karşılığı vardır", () => {
    for (const { name, q } of scenarios()) {
      expect(q.notes.length, name).toBeGreaterThan(0);
      expect(q.notesEn.length, name).toBe(q.notes.length);
      expect(q.notesEn.every((n) => n.trim().length > 0), name).toBe(true);
    }
  });

  it("EN açıklamalarda Türkçe metin kalmaz", () => {
    for (const { name, q } of scenarios()) {
      for (const n of q.notesEn) expect(TURKISH.test(n), `${name}: ${n}`).toBe(false);
      for (const l of q.tfcLines) expect(TURKISH.test(l.reasonEn), `${name}: ${l.reasonEn}`).toBe(false);
      for (const a of q.alternatives ?? []) expect(TURKISH.test(a.labelEn), `${name}: ${a.labelEn}`).toBe(false);
      if (q.penaltyExplainEn) expect(TURKISH.test(q.penaltyExplainEn), name).toBe(false);
    }
  });

  it("her vergi kaleminin gerekçesi iki dilde de doludur", () => {
    for (const { name, q } of scenarios()) {
      for (const l of q.tfcLines) {
        expect(l.reason.length, `${name}/${l.code}`).toBeGreaterThan(0);
        expect(l.reasonEn.length, `${name}/${l.code}`).toBeGreaterThan(0);
      }
    }
  });

  it("15.1.2(b) iki hesabın etiketi de çevrilir", () => {
    const q = quoteRefund({ ticket: ticket({ statuses: ["F", "O"], route: RT() }), couponSeqs: [2], refundType: "involuntary", reason: "schedule_change" });
    expect(q.alternatives).toHaveLength(2);
    expect(q.alternatives!.map((a) => a.labelEn)).toEqual([
      "One-way fare for the unused transportation (RT/CT → one half)",
      "Fare paid − fare for the transportation used",
    ]);
  });

  it("involuntary sebep sözlüğü iki dilde de aynı anahtarları taşır", () => {
    expect(Object.keys(INVOLUNTARY_REASON_LABEL_EN)).toEqual(Object.keys(INVOLUNTARY_REASON_LABEL));
  });

  it("ceza açıklaması EN'de de hangi hesabın seçildiğini söyler", () => {
    const t = ticket({ statuses: ["O", "O"], route: RT(), rbd: "J", fareBasis: "JCLASSIC", base: 20000 });
    const q = quoteRefund({ ticket: t, couponSeqs: [1, 2], refundType: "voluntary" });
    expect(q.penaltyExplain).toBeTruthy();
    expect(q.penaltyExplainEn).toMatch(/^Before departure refund penalty — /);
    // Hesap değişmedi: fareRules testinde kilitli olan tutarlar aynen duruyor.
    expect(q.penalty).toBe(1500);
    expect(q.amount.amount).toBe(20000 - 1500 + 2000);
  });
});

describe("reissue gerekçeleri — TR/EN paritesi", () => {
  const base = ticket({ statuses: ["O", "O"], route: RT(), base: 10000, tfcs: [tfc("TR", 1000), tfc("YQ", 500)] });

  it("notlar iki dilde aynı sırada üretilir", () => {
    const q = quoteReissue({
      ticket: base, newBaseFare: 14000,
      newTfcs: [tfc("TR", 1200), tfc("YQ", 500)],
      newSegments: [seg("IST", "JFK"), seg("JFK", "IST")],
    });
    expect(q.notesEn.length).toBe(q.notes.length);
    for (const n of q.notesEn) expect(TURKISH.test(n), n).toBe(false);
    // ADC = ücret farkı + ARTAN vergi (+ varsa ceza) — değişmedi.
    expect(q.fareDiff).toBe(4000);
    expect(q.tfcAdditional).toBe(200);
  });

  it("bakiye açıklaması İngilizce de üretilir", () => {
    const q = quoteReissue({
      ticket: base, newBaseFare: 6000,
      newTfcs: [tfc("TR", 1000), tfc("YQ", 500)],
      newSegments: [seg("IST", "JFK"), seg("JFK", "IST")],
    });
    expect(q.residual).toBeTruthy();
    expect(q.residual!.note.length).toBeGreaterThan(0);
    expect(TURKISH.test(q.residual!.noteEn)).toBe(false);
    expect(q.residual!.noteEn).toMatch(/residual/i);
  });

  it("değişiklik ücreti açıklaması iki dilde de vardır", () => {
    const biz = ticket({ statuses: ["O", "O"], route: RT(), base: 20000, tfcs: [tfc("TR", 1000)], rbd: "J", fareBasis: "JCLASSIC" });
    const q = quoteReissue({
      ticket: biz, newBaseFare: 22000,
      newTfcs: [tfc("TR", 1000)],
      newSegments: [seg("IST", "JFK"), seg("JFK", "IST")],
    });
    if (q.penalty > 0) {
      expect(q.penaltyExplain).toBeTruthy();
      expect(q.penaltyExplainEn).toMatch(/change fee/);
      expect(TURKISH.test(q.penaltyExplainEn!)).toBe(false);
    }
  });
});
