import { describe, it, expect } from "vitest";
import { quoteRefund, travelCommenced, isRoundOrCircleTrip, commencementCurrency } from "./refundRules";
import { classifyChange, pricingBasis } from "./changeRules";
import type { CouponStatus, Segment, Ticket } from "./types";

// Handbook 15.1 (iade) ve 12.1.1 (değişiklik türü) kurallarının saf katmanı.

const seg = (o: string, d: string, rbd = "Y", dep = "2026-09-01T08:00:00Z"): Segment => ({
  origin: o, destination: d, marketingCarrier: "TK", flightNumber: "1", rbd,
  departure: dep, arrival: dep, fareBasis: "YFLEX", reservationStatus: "HK",
});

function ticket(statuses: CouponStatus[], route: [string, string][], base = 10000, tfc = 2000): Ticket {
  return {
    ticketNumber: "2351234567890",
    passenger: { surname: "ERDOGAN", givenName: "AHMET" },
    validatingCarrier: "TK",
    coupons: statuses.map((s, i) => ({ seq: i + 1, status: s, segment: seg(route[i][0], route[i][1]) })),
    fare: {
      baseFare: { amount: base, currency: "TRY" },
      totalTfc: { amount: tfc, currency: "TRY" },
      total: { amount: base + tfc, currency: "TRY" },
      tfcs: [],
    },
    formOfPayment: { type: "cash" },
    control: { holder: "TK", isValidatingCarrier: true },
    issuedAt: "2026-08-01T10:00:00Z",
    history: [],
  };
}

describe("15.1.1 — iade türü ve kullanım durumu", () => {
  it("herhangi bir kupon F/L/C ise taşıma başlamıştır", () => {
    expect(travelCommenced(ticket(["O", "O"], [["IST", "JFK"], ["JFK", "IST"]]))).toBe(false);
    expect(travelCommenced(ticket(["F", "O"], [["IST", "JFK"], ["JFK", "IST"]]))).toBe(true);
    expect(travelCommenced(ticket(["C", "O"], [["IST", "JFK"], ["JFK", "IST"]]))).toBe(true);
  });

  it("ilk kalkış = son varış ise gidiş-dönüş/circle trip", () => {
    expect(isRoundOrCircleTrip(ticket(["O", "O"], [["IST", "JFK"], ["JFK", "IST"]]))).toBe(true);
    expect(isRoundOrCircleTrip(ticket(["O", "O"], [["IST", "JFK"], ["JFK", "LAX"]]))).toBe(false);
  });

  it("değerleme para birimi taşımanın başladığı ülkeden gelir (15.1.6(a))", () => {
    expect(commencementCurrency(ticket(["O"], [["IST", "JFK"]]))).toBe("TRY");
    expect(commencementCurrency(ticket(["O"], [["JFK", "IST"]]))).toBe("USD");
  });
});

describe("15.1.2 — involuntary iade", () => {
  it("(a) hiç kullanılmamışsa ödenen ücretin tamamı iade edilir", () => {
    const t = ticket(["O", "O"], [["IST", "JFK"], ["JFK", "IST"]]);
    const q = quoteRefund({ ticket: t, couponSeqs: [1, 2], refundType: "involuntary", reason: "flight_cancellation" });
    expect(q.method).toBe("involuntary_unused");
    expect(q.fareComponent).toBe(10000);
    expect(q.tfcComponent).toBe(2000);
    expect(q.amount.amount).toBe(12000);
    expect(q.deductions).toBe(0); // involuntary'de ceza/service charge yok
  });

  it("(b) kısmen kullanılmışsa iki hesap yapılır ve YÜKSEK olan seçilir", () => {
    const t = ticket(["F", "O"], [["IST", "JFK"], ["JFK", "IST"]]);
    const q = quoteRefund({ ticket: t, couponSeqs: [2], refundType: "involuntary", reason: "schedule_change" });
    expect(q.method).toBe("involuntary_partial");
    expect(q.alternatives).toHaveLength(2);
    const chosen = q.alternatives!.find((a) => a.chosen)!;
    const other = q.alternatives!.find((a) => !a.chosen)!;
    expect(chosen.amount).toBeGreaterThanOrEqual(other.amount);
    expect(q.fareComponent).toBe(chosen.amount);
  });

  it("(c) güvenlik/hukuki sebep ve yolcu davranışında masraf reddi not edilir", () => {
    const t = ticket(["O", "O"], [["IST", "JFK"], ["JFK", "IST"]]);
    const q = quoteRefund({ ticket: t, couponSeqs: [1, 2], refundType: "involuntary", reason: "safety_legal" });
    expect(q.notes.join(" ")).toMatch(/masraf üstlenimi reddedilebilir/);
  });
});

describe("15.1.3.1 — voluntary iade", () => {
  it("(a) hiç kullanılmamışsa tam ücret, service charge ve iletişim gideri düşülür", () => {
    const t = ticket(["O", "O"], [["IST", "JFK"], ["JFK", "IST"]]);
    const q = quoteRefund({
      ticket: t, couponSeqs: [1, 2], refundType: "voluntary",
      serviceCharge: 500, communicationExpenses: 100,
    });
    expect(q.method).toBe("voluntary_unused");
    expect(q.deductions).toBe(600);
    expect(q.amount.amount).toBe(12000 - 600);
  });

  it("(b) kısmen kullanılmışsa fark iade edilir", () => {
    const t = ticket(["F", "O"], [["IST", "JFK"], ["JFK", "IST"]]);
    const q = quoteRefund({ ticket: t, couponSeqs: [2], refundType: "voluntary" });
    expect(q.method).toBe("voluntary_partial");
    expect(q.fareComponent).toBe(5000); // 10000 − kullanılan kuponun payı
  });

  it("muafiyet (vefat/hastalık) kesintileri kaldırır", () => {
    const t = ticket(["O", "O"], [["IST", "JFK"], ["JFK", "IST"]]);
    const q = quoteRefund({
      ticket: t, couponSeqs: [1, 2], refundType: "voluntary",
      serviceCharge: 500, communicationExpenses: 100, waiver: "death",
    });
    expect(q.deductions).toBe(0);
    expect(q.amount.amount).toBe(12000);
  });

  it("yalnız vergi iadesinde (Y) çıplak ücret iade edilmez", () => {
    const t = ticket(["O", "O"], [["IST", "JFK"], ["JFK", "IST"]]);
    const q = quoteRefund({ ticket: t, couponSeqs: [1], refundType: "voluntary", taxOnly: true });
    expect(q.method).toBe("tax_only");
    expect(q.fareComponent).toBe(0);
    expect(q.tfcComponent).toBe(1000);
  });
});

describe("12.1.1 — değişiklik türü sınıflandırması", () => {
  const base = ticket(["O", "O"], [["IST", "JFK"], ["JFK", "IST"]]);

  it("yalnız tarih/uçuş değişikliği REBOOKING'dir ve reissue gerektirmez", () => {
    const a = classifyChange(base, [seg("IST", "JFK", "Y", "2026-09-05T08:00:00Z"), seg("JFK", "IST")]);
    expect(a.type).toBe("rebooking");
    expect(a.recommendedFlow).toBe("revalidate");
  });

  it("güzergâh değişikliği REROUTING'dir", () => {
    const a = classifyChange(base, [seg("IST", "LAX"), seg("LAX", "IST")]);
    expect(a.type).toBe("rerouting");
    expect(a.recommendedFlow).toBe("exchange");
  });

  it("daha yüksek kabine geçiş UPGRADING'dir", () => {
    const a = classifyChange(base, [seg("IST", "JFK", "C"), seg("JFK", "IST", "C")]);
    expect(a.type).toBe("upgrading");
  });

  it("kısmen kullanılmış bilette fiyatlama orijinal kesim tarihine göredir (REISSUE)", () => {
    const used = ticket(["F", "O"], [["IST", "JFK"], ["JFK", "IST"]]);
    const a = classifyChange(used, [seg("IST", "JFK"), seg("JFK", "LAX")]);
    expect(a.partiallyUsed).toBe(true);
    expect(pricingBasis(a)).toBe("original_issue_date");
  });

  it("hiç kullanılmamış bilette güncel tarife geçerlidir (EXCHANGE)", () => {
    const a = classifyChange(base, [seg("IST", "JFK"), seg("JFK", "IST")]);
    expect(pricingBasis(a)).toBe("current");
  });
});
