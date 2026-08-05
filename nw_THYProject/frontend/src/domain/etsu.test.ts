import { describe, it, expect } from "vitest";
import {
  issueTicket, refundTicket, exchangeTicket, voidTicket, grantControl, listMessages,
  newIdempotencyKey, type IssueTicketInput,
} from "./api";
import { computeVat } from "./vat";

/**
 * ETSU — Electronic Ticket Status Update (1.1.4.3 / 1.1.4.4).
 *
 * "Her taşıyıcının veritabanı kupon statüsü bakımından senkron tutulur."
 * Daha önce yalnız kontrol talebi mesaj üretiyordu; statü değiştiren komutlar
 * partnere hiçbir şey bildirmiyordu. Bu testler zarfın gerçekten atıldığını
 * doğrular — partner LH (interline segment) üzerinden.
 */
function input(): IssueTicketInput {
  return {
    passenger: { surname: "ETSU", givenName: "TEST" },
    validatingCarrier: "TK",
    segments: [
      { origin: "IST", destination: "FRA", marketingCarrier: "LH", flightNumber: "LH1301", rbd: "Y", departure: "2030-08-01T08:00:00Z", arrival: "2030-08-01T10:10:00Z", fareBasis: "YFLEX", reservationStatus: "HK" },
      { origin: "FRA", destination: "IST", marketingCarrier: "LH", flightNumber: "LH1302", rbd: "Y", departure: "2030-08-10T12:00:00Z", arrival: "2030-08-10T16:10:00Z", fareBasis: "YFLEX", reservationStatus: "HK" },
    ],
    fare: {
      baseFare: { amount: 10000, currency: "TRY" },
      totalTfc: { amount: 2000, currency: "TRY" },
      total: { amount: 12000, currency: "TRY" },
      tfcs: [{ code: "YQ", amount: { amount: 2000, currency: "TRY" } }],
      vat: computeVat(10000, false, new Date().toISOString()),
    },
    formOfPayment: { type: "cash" },
    idempotencyKey: newIdempotencyKey(),
  };
}

async function etsuFor(ticketNumber: string) {
  return (await listMessages()).filter((m) => m.ticketNumber === ticketNumber && m.messageType === "ETSU");
}

describe("statü güncelleme yayını", () => {
  it("iade partnere R bildirir", async () => {
    const t = await issueTicket(input());
    await refundTicket({
      ticketNumber: t.ticketNumber, couponSeqs: [1],
      refundAmount: { amount: 3000, currency: "TRY" }, refundType: "voluntary",
      idempotencyKey: newIdempotencyKey(),
    });
    const msgs = await etsuFor(t.ticketNumber);
    expect(msgs.some((m) => m.summary.includes("→ R") && m.partnerCarrier === "LH")).toBe(true);
  }, 20_000);

  it("exchange partnere E bildirir", async () => {
    const t = await issueTicket(input());
    await exchangeTicket({
      oldTicketNumber: t.ticketNumber,
      newSegments: t.coupons.map((c) => ({ ...c.segment, departure: "2030-09-01T08:00:00Z" })),
      adc: { amount: 0, currency: "TRY" },
      newBaseFare: 10000,
      newTfcs: t.fare.tfcs,
      idempotencyKey: newIdempotencyKey(),
    });
    const msgs = await etsuFor(t.ticketNumber);
    expect(msgs.some((m) => m.summary.includes("→ E"))).toBe(true);
  }, 20_000);

  it("void partnere V bildirir", async () => {
    const t = await issueTicket(input());
    await voidTicket({ ticketNumber: t.ticketNumber, idempotencyKey: newIdempotencyKey() });
    const msgs = await etsuFor(t.ticketNumber);
    expect(msgs.some((m) => m.summary.includes("→ V"))).toBe(true);
  }, 20_000);

  it("kendi taşıyıcımıza mesaj atılmaz", async () => {
    const own = { ...input(), segments: input().segments.map((s) => ({ ...s, marketingCarrier: "TK" })) };
    const t = await issueTicket({ ...own, idempotencyKey: newIdempotencyKey() });
    await voidTicket({ ticketNumber: t.ticketNumber, idempotencyKey: newIdempotencyKey() });
    expect(await etsuFor(t.ticketNumber)).toHaveLength(0);
  }, 20_000);

  it("kontrol devri sonrası bildirim yeni kontrol sahibine gider", async () => {
    const t = await issueTicket(input());
    await grantControl({ ticketNumber: t.ticketNumber, toCarrier: "LH", couponSeqs: [1], idempotencyKey: newIdempotencyKey() });
    const msgs = await etsuFor(t.ticketNumber);
    expect(msgs.every((m) => m.partnerCarrier === "LH")).toBe(true);
  }, 20_000);
});
