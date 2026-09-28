import { describe, it, expect } from "vitest";
import { issueTicket, refundTicket, newIdempotencyKey, type IssueTicketInput } from "./api";

// Sunum öncesi buton buton QA turunda bulunan hataların regresyonları.

function input(surname: string, departure = "2026-07-01T07:20:00Z"): IssueTicketInput {
  return {
    passenger: { surname, givenName: "TEST" },
    validatingCarrier: "TK",
    segments: [
      { origin: "IST", destination: "FRA", marketingCarrier: "TK", flightNumber: "TK1591", rbd: "Y", departure, arrival: departure.replace("07:20", "10:05"), fareBasis: "YLXOWTR", reservationStatus: "HK" },
    ],
    fare: {
      baseFare: { amount: 5000, currency: "TRY" },
      totalTfc: { amount: 1000, currency: "TRY" },
      total: { amount: 6000, currency: "TRY" },
      tfcs: [{ code: "YQ", amount: { amount: 1000, currency: "TRY" } }],
    },
    formOfPayment: { type: "cash" },
    idempotencyKey: newIdempotencyKey(),
  };
}

describe("demo QA — satış ve iade kapıları", () => {
  it("iade tutarı biletin tahsil edilen tutarını aşamaz; kupon açık kalır", async () => {
    const t = await issueTicket(input("TAVAN"));
    await expect(refundTicket({
      ticketNumber: t.ticketNumber, couponSeqs: [1], refundAmount: { amount: 99_999_999, currency: "TRY" }, idempotencyKey: newIdempotencyKey(),
    })).rejects.toThrow(/aşıyor/);
    expect(t.coupons[0].status).toBe("O");
  });

  it("kalkışı geçmiş sefere bilet kesilemez", async () => {
    await expect(issueTicket(input("GECMIS", "2026-06-01T07:20:00Z"))).rejects.toThrow(/kalkışı geçti/);
  });
});
