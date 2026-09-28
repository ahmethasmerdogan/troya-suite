import { describe, it, expect } from "vitest";
import { addYears, beyondValidity, changeBlockedByValidity, illnessExtension, ticketValidity } from "./validity";
import {
  exchangeTicket, extendValidity, getTicket, issueTicket, newIdempotencyKey, refundTicket, revalidateCoupon,
  type IssueTicketInput,
} from "./api";
import type { CouponStatus, Ticket } from "./types";

/**
 * Bilet geçerlilik süresi — Handbook 2.8 / 12.4.1 / 12.9.1 / 13.10.
 * Tarihler sabit: testler takvim ilerledikçe kendiliğinden kırılmasın.
 */
const NOW = Date.parse("2026-06-18T12:00:00Z");

function ticket(statuses: CouponStatus[], opts: { issued?: string; deps?: string[]; nva?: string[] } = {}): Ticket {
  const deps = opts.deps ?? statuses.map((_, i) => `2026-0${6 + i}-10T08:00:00Z`);
  return {
    ticketNumber: "2350000000000",
    passenger: { surname: "TEST", givenName: "USER" },
    validatingCarrier: "TK",
    issuedAt: opts.issued ?? "2026-05-01T09:00:00Z",
    formOfPayment: { type: "cash" },
    control: { holder: "TK", isValidatingCarrier: true },
    coupons: statuses.map((status, i) => ({
      seq: i + 1, status,
      segment: {
        origin: "IST", destination: "LHR", marketingCarrier: "TK", flightNumber: "TK1", rbd: "Y",
        departure: deps[i], arrival: deps[i], fareBasis: "YFLEX", reservationStatus: "HK",
        ...(opts.nva?.[i] ? { notValidAfter: opts.nva[i] } : {}),
      },
    })),
    fare: {
      baseFare: { amount: 1000, currency: "TRY" }, totalTfc: { amount: 0, currency: "TRY" },
      total: { amount: 1000, currency: "TRY" }, tfcs: [],
    },
    history: [],
  };
}

describe("geçerlilik süresi", () => {
  it("tamamen kullanılmamış bilet kesimden itibaren 1 yıl geçerlidir", () => {
    const v = ticketValidity(ticket(["O", "O"]), NOW);
    expect(v.basis).toBe("issue");
    expect(v.until.slice(0, 10)).toBe("2027-05-01");
    expect(v.state).toBe("valid");
  });

  it("kısmen kullanılmış bilet ilk uçuştan itibaren 1 yıl geçerlidir", () => {
    const v = ticketValidity(ticket(["F", "O"], { deps: ["2026-06-01T08:00:00Z", "2026-07-01T08:00:00Z"] }), NOW);
    expect(v.basis).toBe("travel");
    expect(v.until.slice(0, 10)).toBe("2027-06-01");
  });

  it("29 Şubat'tan bir yıl sonrası 28 Şubat'tır", () => {
    expect(new Date(addYears("2028-02-29T10:00:00Z", 1)).toISOString().slice(0, 10)).toBe("2029-02-28");
  });

  it("süre bitmeden 30 gün kala 'dolmak üzere', sonra 'doldu' ve yalnız iade", () => {
    const t = ticket(["O"], { issued: "2025-07-01T09:00:00Z" });
    expect(ticketValidity(t, NOW).state).toBe("expiring");
    const late = Date.parse("2026-07-02T00:00:01Z");
    const v = ticketValidity(t, late);
    expect(v.state).toBe("expired");
    expect(v.refundOnly).toBe(true);
    expect(changeBlockedByValidity(t, late)).toMatch(/12\.9\.1/);
  });

  it("ücret kuralının NVA'sı bilet geçerliliğinden kısaysa kuponu o sınırlar", () => {
    const v = ticketValidity(ticket(["O"], { nva: ["2026-08-01"] }), NOW);
    expect(v.coupons[0].fareLimited).toBe(true);
    expect(v.coupons[0].until.slice(0, 10)).toBe("2026-08-01");
    expect(ticketValidity(ticket(["O"], { nva: ["2026-08-01"] }), Date.parse("2026-08-02T01:00:00Z")).coupons[0].expired).toBe(true);
  });

  it("yolculuk başladıysa yeni uçuş orijinal geçerlilik sonunu aşamaz (12.4.1)", () => {
    const t = ticket(["F", "O"], { deps: ["2026-06-01T08:00:00Z", "2026-07-01T08:00:00Z"] });
    expect(beyondValidity(t, "2027-05-30T08:00:00Z", NOW)).toBeUndefined();
    expect(beyondValidity(t, "2027-06-02T08:00:00Z", NOW)).toMatch(/12\.4\.1/);
  });
});

describe("hastalık uzatması (13.10)", () => {
  const started = () => ticket(["F", "O"], { deps: ["2025-06-20T08:00:00Z", "2025-07-01T08:00:00Z"] });

  it("yolculuk başlamadan uzatma verilmez", () => {
    const r = illnessExtension(ticket(["O"]), { certificateDate: "2026-06-10", fitToTravelDate: "2026-07-10", fareKind: "normal" }, NOW);
    expect(r).toEqual({ error: expect.stringMatching(/13\.10/), errorEn: expect.stringMatching(/13\.10/) });
  });

  it("normal ücret: elverişlilik tarihine kadar, rapordan en çok 3 ay", () => {
    const near = illnessExtension(started(), { certificateDate: "2026-06-10", fitToTravelDate: "2026-07-20", fareKind: "normal" }, NOW);
    expect("until" in near && near.until.slice(0, 10)).toBe("2026-07-20");
    const far = illnessExtension(started(), { certificateDate: "2026-06-10", fitToTravelDate: "2026-12-01", fareKind: "normal" }, NOW);
    expect("until" in far && far.until.slice(0, 10)).toBe("2026-09-10");
  });

  it("özel (kısa süreli) ücret: elverişlilikten en çok 7 gün sonrası", () => {
    const r = illnessExtension(started(), { certificateDate: "2026-06-10", fitToTravelDate: "2026-07-01", fareKind: "special" }, NOW);
    expect("until" in r && r.until.slice(0, 10)).toBe("2026-07-08");
  });

  it("geçerliliği uzatmayan talep reddedilir (hak boşa gitmez) ve uzatma bir kez verilir", () => {
    const t = ticket(["F", "O"], { deps: ["2026-06-01T08:00:00Z", "2026-07-01T08:00:00Z"] });
    const r = illnessExtension(t, { certificateDate: "2026-06-10", fitToTravelDate: "2026-06-20", fareKind: "normal" }, NOW);
    expect(r).toEqual({ error: expect.stringMatching(/gerek yok/), errorEn: expect.stringMatching(/no extension needed/) });
    t.validityExtension = { reason: "illness", certificateDate: "2026-06-10", fitToTravelDate: "2026-06-20", fareKind: "normal", until: "2027-06-01T23:59:59.999Z", grantedAt: "" };
    expect(illnessExtension(t, { certificateDate: "2026-06-11", fitToTravelDate: "2026-06-21", fareKind: "normal" }, NOW)).toEqual({ error: expect.stringMatching(/bir kez/), errorEn: expect.stringMatching(/only once/) });
  });
});

describe("komutlar geçerliliği zorlar", () => {
  function input(departure: string): IssueTicketInput {
    return {
      passenger: { surname: "GECERLI", givenName: "TEST" }, validatingCarrier: "TK",
      segments: [{ origin: "IST", destination: "ESB", marketingCarrier: "TK", flightNumber: "TK2128", rbd: "Y",
        departure, arrival: departure, fareBasis: "YFLEX", reservationStatus: "HK" }],
      fare: { baseFare: { amount: 1000, currency: "TRY" }, totalTfc: { amount: 0, currency: "TRY" }, total: { amount: 1000, currency: "TRY" }, tfcs: [] },
      formOfPayment: { type: "cash" }, idempotencyKey: newIdempotencyKey(),
    };
  }

  it("süresi dolan bilet exchange ve revalidation reddedilir, iade serbest (12.9.1)", async () => {
    const t = await issueTicket(input("2030-01-10T08:00:00Z"));
    const live = (await getTicket(t.ticketNumber))!;
    live.issuedAt = "2024-01-01T09:00:00Z"; // iki yıl önce kesilmiş, hiç kullanılmamış
    await expect(revalidateCoupon({ ticketNumber: t.ticketNumber, couponSeq: 1, newFlightNumber: "TK2130", newDeparture: "2030-01-11T08:00:00Z", idempotencyKey: newIdempotencyKey() }))
      .rejects.toThrow(/yalnız iade/);
    await expect(exchangeTicket({ oldTicketNumber: t.ticketNumber, newSegments: live.coupons.map((c) => c.segment), adc: { amount: 0, currency: "TRY" }, idempotencyKey: newIdempotencyKey() }))
      .rejects.toThrow(/yalnız iade/);
    const r = await refundTicket({ ticketNumber: t.ticketNumber, couponSeqs: [1], refundAmount: { amount: 1000, currency: "TRY" }, idempotencyKey: newIdempotencyKey() });
    expect(r.coupons[0].status).toBe("R");
  }, 20_000);

  it("hastalık uzatması kayda ve yaşam döngüsüne yazılır, ikinci kez verilmez", async () => {
    const t = await issueTicket(input("2030-01-10T08:00:00Z"));
    const live = (await getTicket(t.ticketNumber))!;
    live.coupons.push({ ...live.coupons[0], seq: 2 });
    live.coupons[0].status = "F";
    live.coupons[0].segment = { ...live.coupons[0].segment, departure: "2026-01-10T08:00:00Z" };
    const key = newIdempotencyKey();
    const after = await extendValidity({ ticketNumber: t.ticketNumber, certificateDate: "2026-06-10", fitToTravelDate: "2027-01-20", fareKind: "special", idempotencyKey: key });
    expect(after.validityExtension?.until.slice(0, 10)).toBe("2027-01-27");
    expect(after.history.at(-1)?.type).toBe("ValidityExtended");
    // aynı anahtar → aynı sonuç, yan etki yok
    const again = await extendValidity({ ticketNumber: t.ticketNumber, certificateDate: "2026-06-10", fitToTravelDate: "2027-01-20", fareKind: "special", idempotencyKey: key });
    expect(again.history.filter((e) => e.type === "ValidityExtended")).toHaveLength(1);
    await expect(extendValidity({ ticketNumber: t.ticketNumber, certificateDate: "2026-06-11", fitToTravelDate: "2027-01-20", fareKind: "special", idempotencyKey: newIdempotencyKey() }))
      .rejects.toThrow(/bir kez/);
  }, 20_000);
});
