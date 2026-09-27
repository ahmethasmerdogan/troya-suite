import { describe, it, expect } from "vitest";
import { issueTicket, newIdempotencyKey, type IssueTicketInput } from "./api";
import { getPnr, ttlState } from "./reservation";
import { computeVat } from "./vat";

/**
 * QuickRes ↔ Troya bağı.
 *
 * Rezervasyondan kesilen bilet, PNR'ı GÜNCELLEMEK zorundadır: doküman numarası
 * PNR'a yazılır, statü "ticketed" olur ve kesim süre limiti (ADTK) düşer.
 * Bu olmadan PNR süresiz "bilet bekliyor" görünüyordu.
 */
function input(pnr: string): IssueTicketInput {
  return {
    passenger: { surname: "DEMIR", givenName: "CAN" },
    validatingCarrier: "TK",
    pnr,
    segments: [{
      origin: "IST", destination: "AYT", marketingCarrier: "TK", flightNumber: "TK2410",
      rbd: "Y", departure: "2030-06-20T06:00:00Z", arrival: "2030-06-20T07:15:00Z",
      fareBasis: "YFLEX", reservationStatus: "HK",
    }],
    fare: {
      baseFare: { amount: 5000, currency: "TRY" },
      totalTfc: { amount: 1000, currency: "TRY" },
      total: { amount: 6000, currency: "TRY" },
      tfcs: [{ code: "VQ", amount: { amount: 1000, currency: "TRY" } }],
      vat: computeVat(5000, true, new Date().toISOString()),
    },
    formOfPayment: { type: "cash" },
    idempotencyKey: newIdempotencyKey(),
  };
}

describe("PNR → bilet linkage", () => {
  it("her yolcu ayrı bilet alır; PNR ancak TÜM yolcular biletlenince 'ticketed' olur ve TTL düşer", async () => {
    const before = await getPnr("TR8N1P");
    expect(before!.status).toBe("active");
    expect(before!.passengers).toHaveLength(2);
    expect(before!.ticketNumbers).toHaveLength(0);
    expect(ttlState(before!).kind).not.toBe("none");

    // 1. yolcu — PNR kısmen biletlendi: numara yazılır, TTL ikinci yolcu için sürer.
    const t1 = await issueTicket(input("TR8N1P"));
    const mid = await getPnr("TR8N1P");
    expect(mid!.ticketNumbers).toContain(t1.ticketNumber);
    expect(mid!.status).toBe("active");
    expect(ttlState(mid!).kind).not.toBe("none");

    // 2. yolcu — rezervasyon tamamen biletlendi.
    const t2 = await issueTicket({ ...input("TR8N1P"), passenger: { surname: "DEMIR", givenName: "AYSE" } });
    const after = await getPnr("TR8N1P");
    expect(after!.status).toBe("ticketed");
    expect(after!.ticketNumbers).toEqual(expect.arrayContaining([t1.ticketNumber, t2.ticketNumber]));
    expect(ttlState(after!).kind).toBe("none"); // biletlendi → süre limiti anlamsız
  }, 20_000);

  it("aynı yolcuya aynı PNR'dan ikinci bilet kesilemez (mükerrer kesim)", async () => {
    await expect(issueTicket(input("TR8N1P"))).rejects.toThrow(/zaten kesilmiş/);
  }, 20_000);

  it("PNR'da olmayan adla kesim reddedilir — ad PNR'dakiyle birebir aynı olmalı (2.3)", async () => {
    const i = { ...input("KQ5B7X"), passenger: { surname: "BASKA", givenName: "BIRI" } };
    await expect(issueTicket(i)).rejects.toThrow(/rezervasyonunda yok/);
    const untouched = await getPnr("KQ5B7X");
    expect(untouched!.ticketNumbers).toHaveLength(0);
  }, 20_000);

  it("PNR'sız kesim rezervasyon tarafına dokunmaz", async () => {
    const i = input("");
    delete i.pnr;
    const t = await issueTicket(i);
    expect(t.pnr).toBeUndefined();
    const untouched = await getPnr("KQ5B7X");
    expect(untouched!.ticketNumbers).toHaveLength(0);
  }, 20_000);

  it("olmayan PNR ile kesim hata vermez, bilet yine kesilir", async () => {
    const t = await issueTicket(input("ZZZZZZ"));
    expect(t.ticketNumber).toHaveLength(13);
  }, 20_000);
});
