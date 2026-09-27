import { describe, it, expect } from "vitest";
import { classifyScheduleChange, skchgEndorsement, upcomingFlights } from "./scheduleChange";
import {
  acknowledgeScheduleChange, applyScheduleChange, getTicket, issueTicket, newIdempotencyKey, type IssueTicketInput,
} from "./api";
import { buildQueueItems } from "./queues";

describe("tarife değişikliği sınıfı", () => {
  it("<15 dk küçük; iç hatta ≥3 sa, dış hatta ≥6 sa önemli; arası zorunlu", () => {
    expect(classifyScheduleChange(10, false)).toBe("minor");
    expect(classifyScheduleChange(-14, true)).toBe("minor");
    expect(classifyScheduleChange(20, false)).toBe("involuntary");
    expect(classifyScheduleChange(200, false)).toBe("significant");
    expect(classifyScheduleChange(200, true)).toBe("involuntary");
    expect(classifyScheduleChange(-400, true)).toBe("significant");
  });

  it("ciro metni orijinal sefer ve günü taşır", () => {
    expect(skchgEndorsement("TK2410", "2030-06-20T06:00:00Z")).toBe("INVOL SKCHG TK2410/20JUN");
  });
});

describe("toplu uygulama", () => {
  const dep = "2030-06-20T06:00:00Z";
  function input(surname: string): IssueTicketInput {
    return {
      passenger: { surname, givenName: "TEST" }, validatingCarrier: "TK",
      segments: [{ origin: "IST", destination: "AYT", marketingCarrier: "TK", flightNumber: "TK2410", rbd: "Y",
        departure: dep, arrival: "2030-06-20T07:15:00Z", fareBasis: "YFLEX", reservationStatus: "HK" }],
      fare: { baseFare: { amount: 1000, currency: "TRY" }, totalTfc: { amount: 0, currency: "TRY" }, total: { amount: 1000, currency: "TRY" }, tfcs: [] },
      formOfPayment: { type: "cash" }, idempotencyKey: newIdempotencyKey(),
    };
  }

  it("etkilenen tüm biletler kayar, TK olur, ciro alır; tekrar ikinci kez kaydırmaz; bildirilince HK ve kuyruktan düşer", async () => {
    const a = await issueTicket(input("ALFA"));
    const b = await issueTicket(input("BETA"));
    const flights = upcomingFlights([a, b], Date.parse("2030-01-01T00:00:00Z"));
    expect(flights[0]).toMatchObject({ flightNumber: "TK2410", date: "2030-06-20", tickets: 2 });

    const key = newIdempotencyKey();
    const r = await applyScheduleChange({ flightNumber: "TK2410", date: "2030-06-20", newDeparture: "2030-06-20T09:20:00Z", idempotencyKey: key });
    expect(r.minutes).toBe(200);
    expect(r.applied.map((x) => x.severity)).toEqual(expect.arrayContaining(["significant"]));
    const ta = (await getTicket(a.ticketNumber))!;
    expect(ta.coupons[0].segment.departure).toBe("2030-06-20T09:20:00.000Z");
    expect(ta.coupons[0].segment.arrival).toBe("2030-06-20T10:35:00.000Z");
    expect(ta.coupons[0].segment.reservationStatus).toBe("TK");
    expect(ta.endorsement).toContain("INVOL SKCHG TK2410/20JUN");
    expect(ta.history.at(-1)?.type).toBe("ScheduleChanged");

    // Aynı anahtarla tekrar: uygulanmış bilet ikinci kez kaymaz.
    await applyScheduleChange({ flightNumber: "TK2410", date: "2030-06-20", newDeparture: "2030-06-20T09:20:00Z", idempotencyKey: key });
    expect((await getTicket(a.ticketNumber))!.coupons[0].segment.departure).toBe("2030-06-20T09:20:00.000Z");

    const q = () => buildQueueItems({ tickets: [ta], pnrs: [], messages: [], alerts: [] }, Date.parse("2030-06-19T12:00:00Z"));
    expect(q().some((i) => i.id === `skchg:${a.ticketNumber}`)).toBe(true);
    await acknowledgeScheduleChange({ ticketNumber: a.ticketNumber, couponSeq: 1, idempotencyKey: newIdempotencyKey() });
    expect(ta.coupons[0].segment.reservationStatus).toBe("HK");
    expect(q().some((i) => i.id === `skchg:${a.ticketNumber}`)).toBe(false);
    void b;
  }, 20_000);

  it("kontrolü partnerde olan bilet atlanır ve gerekçesi raporlanır", async () => {
    const c = await issueTicket({ ...input("GAMA"), segments: [{ ...input("GAMA").segments[0], flightNumber: "TK2412" }] });
    const live = (await getTicket(c.ticketNumber))!;
    live.control = { holder: "LH", isValidatingCarrier: false };
    const r = await applyScheduleChange({ flightNumber: "TK2412", date: "2030-06-20", newDeparture: "2030-06-20T06:30:00Z", idempotencyKey: newIdempotencyKey() });
    expect(r.applied).toHaveLength(0);
    expect(r.skipped[0].reason).toMatch(/LH/);
  }, 20_000);
});
