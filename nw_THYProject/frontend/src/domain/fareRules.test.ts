import { describe, it, expect } from "vitest";
import { computePenalty, fareRuleFor, isFareChangeable, isFareRefundable, ruleSummary, waives } from "./fareRules";
import { quoteRefund } from "./refundRules";
import type { CouponStatus, Segment, Ticket } from "./types";

// Ceza katmanı — ATPCO Cat 16/31/33 karşılığı.
// Handbook ceza TANIMLAMAZ; bu kurallar tarifeden gelir.

const seg = (o: string, d: string, rbd = "Y", fareBasis = "YFLEX", dep = "2030-09-01T08:00:00Z"): Segment => ({
  origin: o, destination: d, marketingCarrier: "TK", flightNumber: "1", rbd,
  departure: dep, arrival: dep, fareBasis, reservationStatus: "HK",
});

function ticket(opts: {
  statuses: CouponStatus[]; route: [string, string][]; rbd?: string; fareBasis?: string;
  base?: number; tfcs?: { code: string; amount: number }[]; dep?: string; noShow?: number[];
}): Ticket {
  const base = opts.base ?? 10000;
  const tfcs = opts.tfcs ?? [{ code: "TR", amount: 1500 }, { code: "YQ", amount: 500 }];
  const totalTfc = tfcs.reduce((s, t) => s + t.amount, 0);
  return {
    ticketNumber: "2351234567890",
    passenger: { surname: "TEST", givenName: "USER" },
    validatingCarrier: "TK",
    coupons: opts.statuses.map((s, i) => ({
      seq: i + 1, status: s,
      segment: seg(opts.route[i][0], opts.route[i][1], opts.rbd ?? "Y", opts.fareBasis ?? "YFLEX", opts.dep),
      ...(opts.noShow?.includes(i + 1) ? { noShow: true } : {}),
    })),
    fare: {
      baseFare: { amount: base, currency: "TRY" },
      totalTfc: { amount: totalTfc, currency: "TRY" },
      total: { amount: base + totalTfc, currency: "TRY" },
      tfcs: tfcs.map((t) => ({ code: t.code, amount: { amount: t.amount, currency: "TRY" } })),
    },
    formOfPayment: { type: "cash" },
    control: { holder: "TK", isValidatingCarrier: true },
    issuedAt: "2026-08-01T10:00:00Z",
    history: [],
  };
}

describe("ceza hesabı — Cat 16/31/33 mekaniği", () => {
  it("kural yoksa işlem ücretsiz ve serbesttir ('veri yok = yasak' değildir)", () => {
    const flex = fareRuleFor("eco-flex");
    expect(isFareRefundable(flex)).toBe(true);
    expect(isFareChangeable(flex)).toBe(true);
    expect(computePenalty(flex?.refund?.beforeDeparture, 10000)).toBeNull();
    expect(ruleSummary(fareRuleFor("bilinmeyen"))[0]).toMatch(/ücretsiz/);
  });

  it("sabit ve yüzde birlikteyse H → yüksek olanı uygulanır, ASLA toplanmaz", () => {
    const r = { amount: 2000, percent: 0.15, hiLo: "H" as const, currency: "TRY", base: "perTicket" as const };
    expect(computePenalty(r, 20000)!.amount).toBe(3000); // %15 = 3000 > 2000
    expect(computePenalty(r, 5000)!.amount).toBe(2000); // %15 = 750 < 2000
  });

  it("L göstergesinde düşük olanı uygulanır", () => {
    const r = { amount: 2000, percent: 0.15, hiLo: "L" as const, currency: "TRY", base: "perTicket" as const };
    expect(computePenalty(r, 20000)!.amount).toBe(2000);
  });

  it("yüzde ÇIPLAK ÜCRET üzerinden hesaplanır (bilet toplamı değil)", () => {
    const r = { percent: 0.1, currency: "TRY", base: "perTicket" as const };
    expect(computePenalty(r, 10000)!.amount).toBe(1000);
  });

  it("minimum eşiği hesaplanan cezanın altına inmeyi engeller", () => {
    const r = { percent: 0.05, minimum: 1500, currency: "TRY", base: "perTicket" as const };
    expect(computePenalty(r, 10000)!.amount).toBe(1500); // %5 = 500 → minimum
  });

  it("uygulama tabanı kupon başına ise kupon sayısıyla çarpılır", () => {
    const r = { amount: 500, currency: "TRY", base: "perCoupon" as const };
    expect(computePenalty(r, 10000, 3)!.amount).toBe(1500);
  });

  it("kısıt kodu: X iade, N değişiklik, B ikisini de kapatır", () => {
    expect(isFareRefundable({ fareTypeId: "x", restriction: "X" })).toBe(false);
    expect(isFareChangeable({ fareTypeId: "x", restriction: "X" })).toBe(true);
    expect(isFareChangeable({ fareTypeId: "n", restriction: "N" })).toBe(false);
    expect(isFareRefundable({ fareTypeId: "b", restriction: "B" })).toBe(false);
    expect(isFareChangeable({ fareTypeId: "b", restriction: "B" })).toBe(false);
  });

  it("muafiyet listesi kuralda tanımlı hâlleri kapsar", () => {
    expect(waives(fareRuleFor("eco-classic"), "death")).toBe(true);
    expect(waives(fareRuleFor("eco-promo"), "schedule_change")).toBe(false);
  });
});

describe("iade — ceza ve vergi birlikte", () => {
  it("iade edilemez üründe ücret yanar ama olaya bağlı devlet harcı iade edilir", () => {
    const t = ticket({ statuses: ["O", "O"], route: [["IST", "JFK"], ["JFK", "IST"]], rbd: "V", fareBasis: "VSAVER" });
    const q = quoteRefund({ ticket: t, couponSeqs: [1, 2], refundType: "voluntary" });
    expect(q.fareRefundable).toBe(false);
    expect(q.method).toBe("non_refundable_taxes_only");
    expect(q.fareComponent).toBe(0);
    // TR (havalimanı harcı) iade edilir, YQ (taşıyıcı ek ücreti) edilmez.
    const tr = q.tfcLines.find((l) => l.code === "TR")!;
    const yq = q.tfcLines.find((l) => l.code === "YQ")!;
    expect(tr.refundable).toBe(true);
    expect(yq.refundable).toBe(false);
    expect(q.tfcComponent).toBe(1500);
  });

  it("uçulmuş kuponun vergisi iade edilmez", () => {
    const t = ticket({ statuses: ["F", "O"], route: [["IST", "JFK"], ["JFK", "IST"]] });
    const q = quoteRefund({ ticket: t, couponSeqs: [1], refundType: "voluntary" });
    expect(q.tfcLines.every((l) => !l.refundable)).toBe(true);
    expect(q.tfcComponent).toBe(0);
  });

  it("ceza yalnız ücrete uygulanır; vergiden kesilmez", () => {
    const t = ticket({
      statuses: ["O", "O"], route: [["IST", "JFK"], ["JFK", "IST"]],
      rbd: "M", fareBasis: "MCLASSIC", base: 10000,
    });
    // eco-classic: restriction X → ücret iade edilmez ama vergi iade edilir.
    const q = quoteRefund({ ticket: t, couponSeqs: [1, 2], refundType: "voluntary" });
    expect(q.fareComponent).toBe(0);
    expect(q.tfcComponent).toBe(1500); // TR iade, YQ ücret kuralını izlediği için hayır
  });

  it("iade edilebilir üründe kalkış öncesi ceza ücretten düşülür", () => {
    const t = ticket({
      statuses: ["O", "O"], route: [["IST", "JFK"], ["JFK", "IST"]],
      rbd: "J", fareBasis: "JCLASSIC", base: 20000,
    });
    const q = quoteRefund({ ticket: t, couponSeqs: [1, 2], refundType: "voluntary" });
    expect(q.fareRefundable).toBe(true);
    expect(q.penalty).toBe(1500); // biz-classic kalkıştan önce
    expect(q.amount.amount).toBe(20000 - 1500 + 2000); // ücret − ceza + iade edilebilir vergi
  });

  it("no-show ücreti iptal cezasından AYRI bir kalemdir ve eklenir", () => {
    const t = ticket({
      statuses: ["O", "O"], route: [["IST", "JFK"], ["JFK", "IST"]],
      rbd: "J", fareBasis: "JCLASSIC", base: 20000, noShow: [1],
    });
    const q = quoteRefund({ ticket: t, couponSeqs: [1], refundType: "voluntary" });
    expect(q.penalty).toBe(1500);
    expect(q.noShowFee).toBe(2000);
  });

  it("involuntary iadede ceza uygulanmaz", () => {
    const t = ticket({
      statuses: ["O", "O"], route: [["IST", "JFK"], ["JFK", "IST"]],
      rbd: "J", fareBasis: "JCLASSIC", base: 20000,
    });
    const q = quoteRefund({ ticket: t, couponSeqs: [1, 2], refundType: "involuntary", reason: "flight_cancellation" });
    expect(q.penalty).toBe(0);
    expect(q.noShowFee).toBe(0);
  });

  it("kesintiler iadeyi aşarsa net sıfırdır, negatif üretilmez", () => {
    const t = ticket({
      statuses: ["O"], route: [["IST", "JFK"]], rbd: "V", fareBasis: "VSAVER",
      tfcs: [{ code: "TR", amount: 200 }],
    });
    const q = quoteRefund({
      ticket: t, couponSeqs: [1], refundType: "voluntary",
      serviceCharge: 1000,
    });
    expect(q.amount.amount).toBe(0);
    expect(q.clampedToZero).toBe(true);
  });

  it("promosyon ücrette vergi göstergesi X ise vergiler de iade edilmez", () => {
    const t = ticket({ statuses: ["O"], route: [["IST", "JFK"]], rbd: "L", fareBasis: "LPROMO" });
    const q = quoteRefund({ ticket: t, couponSeqs: [1], refundType: "voluntary" });
    expect(q.tfcComponent).toBe(0);
    expect(q.tfcLines.every((l) => !l.refundable)).toBe(true);
  });

  it("yalnız vergi iadesinde biletin kalan değerinin yanacağı uyarısı verilir", () => {
    const t = ticket({ statuses: ["O", "O"], route: [["IST", "JFK"], ["JFK", "IST"]] });
    const q = quoteRefund({ ticket: t, couponSeqs: [1], refundType: "voluntary", taxOnly: true });
    expect(q.method).toBe("tax_only");
    expect(q.notes.join(" ")).toMatch(/kalan değeri kullanılamaz/);
  });
});

// Bağımsız denetimin bulduğu iki para hatasının regresyonu (2026-08-03).
const RT = (): [string, string][] => [["IST", "JFK"], ["JFK", "IST"]];
describe("kısmi iade — değer iki kez iade edilemez", () => {
  it("hiç kullanılmamış bilette YALNIZ bir kupon iade edilirse tam ücret DEĞİL, payı iade edilir", () => {
    const t = ticket({ statuses: ["O", "O"], route: RT(), base: 10000, tfcs: [{ code: "TR", amount: 1000 }] });
    const q = quoteRefund({ ticket: t, couponSeqs: [1], refundType: "voluntary" });
    expect(q.method).toBe("voluntary_partial");
    expect(q.fareComponent).toBe(5000); // 10000 / 2 kupon
  });

  it("kalan biletin TAMAMI iade edilirse tam ücret iade edilir", () => {
    const t = ticket({ statuses: ["O", "O"], route: RT(), base: 10000, tfcs: [{ code: "TR", amount: 1000 }] });
    const q = quoteRefund({ ticket: t, couponSeqs: [1, 2], refundType: "voluntary" });
    expect(q.method).toBe("voluntary_unused");
    expect(q.fareComponent).toBe(10000);
  });

  it("bir kuponu ZATEN iade edilmiş bilet 'hiç kullanılmamış' sayılmaz — ücret ikinci kez iade edilmez", () => {
    // Kupon #1 daha önce iade edilmiş (R = final), #2 hâlâ açık.
    const t = ticket({ statuses: ["R", "O"], route: RT(), base: 10000, tfcs: [{ code: "TR", amount: 1000 }] });
    const q = quoteRefund({ ticket: t, couponSeqs: [2], refundType: "voluntary" });
    // Kalan tek değerli kupon iade ediliyor → tam ücret DEĞİL, o kuponun payı.
    expect(q.fareComponent).toBeLessThan(10000);
    expect(q.fareComponent).toBe(5000);
  });

  it("involuntary iadede de aynı sınır geçerlidir", () => {
    const t = ticket({ statuses: ["O", "O"], route: RT(), base: 10000, tfcs: [{ code: "TR", amount: 1000 }] });
    const q = quoteRefund({ ticket: t, couponSeqs: [1], refundType: "involuntary", reason: "flight_cancellation" });
    expect(q.fareComponent).toBeLessThan(10000);
  });
});

describe("KDV düzeltmesi — iade edilen ücretle orantılı", () => {
  const withVat = () => {
    const t = ticket({ statuses: ["O", "O"], route: [["IST", "ESB"], ["ESB", "IST"]], base: 10000, tfcs: [{ code: "VQ", amount: 240 }] });
    t.fare.vat = { regime: "taxable", rate: 0.2, base: 10000, amount: 2000, rateDate: "2026-08-01" };
    return t;
  };

  it("biletin yarısı iade edilirse KDV'nin de yarısı düzeltilir", () => {
    const q = quoteRefund({ ticket: withVat(), couponSeqs: [1], refundType: "voluntary" });
    expect(q.vatRefunded).toBe(1000);
  });

  it("tamamı iade edilirse KDV'nin tamamı düzeltilir", () => {
    const q = quoteRefund({ ticket: withVat(), couponSeqs: [1, 2], refundType: "voluntary" });
    expect(q.vatRefunded).toBe(2000);
  });

  it("yalnız vergi iadesinde KDV düzeltmesi YOKTUR (ücret iade edilmiyor)", () => {
    const q = quoteRefund({ ticket: withVat(), couponSeqs: [1], refundType: "voluntary", taxOnly: true });
    expect(q.fareComponent).toBe(0);
    expect(q.vatRefunded).toBe(0);
  });

  it("uluslararası (istisna) bilette KDV düzeltmesi yoktur", () => {
    const t = ticket({ statuses: ["O", "O"], route: RT(), base: 10000, tfcs: [{ code: "TR", amount: 1000 }] });
    t.fare.vat = { regime: "exempt", exemptionArticle: "KDV_14", rate: 0, base: 10000, amount: 0, rateDate: "2026-08-01" };
    const q = quoteRefund({ ticket: t, couponSeqs: [1, 2], refundType: "voluntary" });
    expect(q.vatRefunded).toBe(0);
  });
});
