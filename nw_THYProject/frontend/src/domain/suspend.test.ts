import { describe, it, expect } from "vitest";
import {
  issueTicket, suspendCoupons, releaseCoupons, refundTicket, voidTicket,
  scanRevenueAlerts, newIdempotencyKey, DomainError, type IssueTicketInput,
} from "./api";
import type { Ticket } from "./types";
import { computeVat } from "./vat";

/**
 * "S" (Suspended, 1.1.4) — tanımlıydı ama yazılamıyordu.
 *
 * Askıya alınan kupon KULLANILAMAZ (iade/void hariç yol kapalı) ama belge
 * iptal edilmez: inceleme bitince O'ya döner.
 */
function input(): IssueTicketInput {
  return {
    passenger: { surname: "ASKI", givenName: "TEST", foid: "PP-A1" },
    validatingCarrier: "TK",
    segments: [
      { origin: "IST", destination: "ESB", marketingCarrier: "TK", flightNumber: "TK2101", rbd: "Y", departure: "2030-07-01T08:00:00Z", arrival: "2030-07-01T09:10:00Z", fareBasis: "YFLEX", reservationStatus: "HK" },
      { origin: "ESB", destination: "IST", marketingCarrier: "TK", flightNumber: "TK2102", rbd: "Y", departure: "2030-07-10T12:00:00Z", arrival: "2030-07-10T13:10:00Z", fareBasis: "YFLEX", reservationStatus: "HK" },
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
const seqStatus = (t: Ticket, seq: number) => t.coupons.find((c) => c.seq === seq)!.status;

describe("askıya alma (S)", () => {
  it("O kuponu askıya alır, gerekçeyi denetim kaydına yazar", async () => {
    const t = await issueTicket(input());
    const after = await suspendCoupons({
      ticketNumber: t.ticketNumber, couponSeqs: [1],
      reason: "Chargeback itirazı", idempotencyKey: newIdempotencyKey(),
    });
    expect(seqStatus(after, 1)).toBe("S");
    expect(seqStatus(after, 2)).toBe("O");
    expect(after.history.some((h) => h.type === "CouponSuspended" && h.detail?.includes("Chargeback"))).toBe(true);
  });

  it("gerekçesiz askıya alınamaz", async () => {
    const t = await issueTicket(input());
    await expect(suspendCoupons({
      ticketNumber: t.ticketNumber, couponSeqs: [1], reason: "  ", idempotencyKey: newIdempotencyKey(),
    })).rejects.toBeInstanceOf(DomainError);
  });

  it("askıdaki kupon iade EDİLEMEZ (FSM S→R yok)", async () => {
    const t = await issueTicket(input());
    await suspendCoupons({ ticketNumber: t.ticketNumber, couponSeqs: [1], reason: "inceleme", idempotencyKey: newIdempotencyKey() });
    await expect(refundTicket({
      ticketNumber: t.ticketNumber, couponSeqs: [1],
      refundAmount: { amount: 0, currency: "TRY" }, refundType: "voluntary",
      idempotencyKey: newIdempotencyKey(),
    })).rejects.toBeInstanceOf(DomainError);
  });

  it("askıdan çıkınca kupon O'ya döner ve yeniden işlem görebilir", async () => {
    const t = await issueTicket(input());
    await suspendCoupons({ ticketNumber: t.ticketNumber, couponSeqs: [1], reason: "inceleme", idempotencyKey: newIdempotencyKey() });
    const back = await releaseCoupons({ ticketNumber: t.ticketNumber, couponSeqs: [1], reason: "kapandı", idempotencyKey: newIdempotencyKey() });
    expect(seqStatus(back, 1)).toBe("O");
    // Artık void edilebilir (satış günü).
    const voided = await voidTicket({ ticketNumber: t.ticketNumber, idempotencyKey: newIdempotencyKey() });
    expect(seqStatus(voided, 1)).toBe("V");
  });

  it("aynı anahtarla tekrar çağrı yeni event üretmez (idempotent)", async () => {
    const t = await issueTicket(input());
    const key = newIdempotencyKey();
    await suspendCoupons({ ticketNumber: t.ticketNumber, couponSeqs: [1], reason: "inceleme", idempotencyKey: key });
    const again = await suspendCoupons({ ticketNumber: t.ticketNumber, couponSeqs: [1], reason: "inceleme", idempotencyKey: key });
    expect(again.history.filter((h) => h.type === "CouponSuspended").length).toBe(1);
  });

  it("askıda olmayan kupon serbest bırakılamaz", async () => {
    const t = await issueTicket(input());
    await expect(releaseCoupons({
      ticketNumber: t.ticketNumber, couponSeqs: [1], reason: "", idempotencyKey: newIdempotencyKey(),
    })).rejects.toBeInstanceOf(DomainError);
  });
});

describe("gelir koruma taraması canlı", () => {
  it("askıya alınan kupon uyarı listesine düşer", async () => {
    const t = await issueTicket(input());
    await suspendCoupons({ ticketNumber: t.ticketNumber, couponSeqs: [1], reason: "sahtecilik incelemesi", idempotencyKey: newIdempotencyKey() });
    const alerts = scanRevenueAlerts();
    expect(alerts.some((a) => a.ticketNumber === t.ticketNumber && a.detail.includes("askıda"))).toBe(true);
  });

  it("aynı FOID + güzergâhla ikinci canlı bilet mükerrer bayrağı üretir", async () => {
    const a = await issueTicket(input());
    const b = await issueTicket(input());
    const alerts = scanRevenueAlerts();
    const dup = alerts.filter((x) => x.kind === "duplicate" && [a.ticketNumber, b.ticketNumber].includes(x.ticketNumber));
    expect(dup.length).toBeGreaterThan(0);
  });

  it("temiz bir bilet hiçbir bayrak üretmez", async () => {
    const t = await issueTicket({ ...input(), passenger: { surname: "TEMIZ", givenName: "X", foid: "PP-UNIQ-" + crypto.randomUUID() } });
    expect(scanRevenueAlerts([t])).toHaveLength(0);
  });
});
