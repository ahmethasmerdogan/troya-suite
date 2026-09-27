import { describe, it, expect } from "vitest";
import {
  issueTicket, suspendCoupons, scanRevenueAlerts, newIdempotencyKey, type IssueTicketInput,
} from "./api";
import { computeVat } from "./vat";

/**
 * Gelir koruma uyarıları CANLI üretilir (sabit sözlük anahtarı yok): metin
 * kupon numarası, güzergâh ve FOID gibi kayıt verisini taşır. Bu yüzden
 * çevirisi `RevenueAlert.detailEn` alanında, uyarıyla birlikte doğar.
 *
 * TR metin BİREBİR korunur — Yönetim > Gelir Koruma ve duyuru şeridi onu okur.
 */
function input(surname: string, foid: string): IssueTicketInput {
  return {
    passenger: { surname, givenName: "TEST", foid },
    validatingCarrier: "TK",
    segments: [
      { origin: "IST", destination: "ESB", marketingCarrier: "TK", flightNumber: "TK2101", rbd: "Y", departure: "2030-09-01T08:00:00Z", arrival: "2030-09-01T09:10:00Z", fareBasis: "YFLEX", reservationStatus: "HK" },
    ],
    fare: {
      baseFare: { amount: 10000, currency: "TRY" },
      totalTfc: { amount: 2000, currency: "TRY" },
      total: { amount: 12000, currency: "TRY" },
      tfcs: [{ code: "VQ", amount: { amount: 2000, currency: "TRY" } }],
      vat: computeVat(10000, true, new Date().toISOString()),
    },
    formOfPayment: { type: "cash" },
    idempotencyKey: newIdempotencyKey(),
  };
}

describe("gelir koruma uyarıları — İngilizce karşılık", () => {
  it("askıdaki kupon uyarısı hem TR hem EN metin taşır", async () => {
    const t = await issueTicket(input("ALARM", `PP-EN-${Date.now()}`));
    await suspendCoupons({
      ticketNumber: t.ticketNumber, couponSeqs: [1],
      reason: "Şüpheli ödeme", idempotencyKey: newIdempotencyKey(),
    });

    const alert = scanRevenueAlerts().find((a) => a.ticketNumber === t.ticketNumber && a.kind === "status_mismatch");
    expect(alert).toBeDefined();
    expect(alert!.detail).toBe("Kupon #1 askıda (S) — inceleme kapanana kadar kullanılamaz.");
    expect(alert!.detailEn).toBe("Coupon #1 is suspended (S) — not usable until the review is closed.");
  });

  it("mükerrer kesim uyarısında sayı ve FOID iki dilde de korunur", async () => {
    const foid = `PP-DUP-${Date.now()}`;
    const first = await issueTicket(input("MUKERRER", foid));
    const second = await issueTicket(input("MUKERRER", foid));

    // Bayrak çiftin ikinci belgesine düşer; store sırası testin varsayımı değil.
    const pair = [first.ticketNumber, second.ticketNumber];
    const alert = scanRevenueAlerts().find((a) => a.kind === "duplicate" && pair.includes(a.ticketNumber));
    expect(alert).toBeDefined();
    expect(alert!.detail).toContain(foid);
    expect(alert!.detailEn).toContain(foid);
    expect(alert!.detailEn).toContain("possible duplicate issue");
    expect(alert!.detailEn).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/);
  });
});
