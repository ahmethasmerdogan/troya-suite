import { describe, it, expect } from "vitest";
import { issueGroup, issueTicket, listGroupTickets, getTicket, newIdempotencyKey, GROUP_MAX } from "./api";
import { computeFareOffers, fareForPtc, CHILD_DISCOUNT } from "./pricing";
import { createPnr, getPnr } from "./reservation";

const legs = [{ origin: "IST", destination: "FRA" }];
const offer = computeFareOffers(legs).find((o) => o.id === "eco-classic")!;
const seg = {
  origin: "IST", destination: "FRA", marketingCarrier: "TK", flightNumber: "1591", rbd: offer.rbd,
  departure: new Date(Date.now() + 20 * 86400000).toISOString(), arrival: new Date(Date.now() + 20 * 86400000 + 3 * 3600000).toISOString(),
  fareBasis: offer.fareBasis, reservationStatus: "HK" as const,
};
const fareOf = (ptc: "ADT" | "CHD") => ({ ...fareForPtc(offer, ptc) });
const base = { validatingCarrier: "TK", segments: [seg], formOfPayment: { type: "cash" as const }, baggageAllowanceKg: offer.baggageKg };

describe("çocuk ücreti (Cat 19)", () => {
  it("çıplak ücret indirimli, havalimanı harcı aynı, toplam tutarlı", () => {
    const adt = fareForPtc(offer, "ADT");
    const chd = fareForPtc(offer, "CHD");
    expect(chd.baseFare.amount).toBeCloseTo(Math.round(adt.baseFare.amount * (1 - CHILD_DISCOUNT) / 10) * 10, 0);
    const airport = (f: typeof adt) => f.tfcs.find((t) => t.code !== "YQ")!.amount.amount;
    expect(airport(chd)).toBe(airport(adt));
    expect(chd.baseFare.amount + chd.totalTfc.amount).toBe(chd.total.amount);
    expect(chd.total.amount).toBeLessThan(adt.total.amount);
  });
});

describe("grup kesimi — tek işlem, her yolcuya ayrı ET", () => {
  it("üç yolcuya üç bilet; ortak grup referansı, PTC ve tutarlar kayıtta", async () => {
    const r = await issueGroup({
      ...base,
      passengers: [
        { passenger: { surname: "AILE", givenName: "ANNE", title: "MRS" }, ptc: "ADT", fare: fareOf("ADT") },
        { passenger: { surname: "AILE", givenName: "BABA", title: "MR" }, ptc: "ADT", fare: fareOf("ADT") },
        { passenger: { surname: "AILE", givenName: "COCUK", title: "CHD" }, ptc: "CHD", fare: fareOf("CHD") },
      ],
      idempotencyKey: newIdempotencyKey(),
    });
    expect(r.tickets).toHaveLength(3);
    expect(new Set(r.tickets.map((t) => t.ticketNumber)).size).toBe(3);
    expect(r.tickets.every((t) => t.groupRef === r.groupRef)).toBe(true);
    expect(r.tickets[2].ptc).toBe("CHD");
    expect(r.tickets[2].fare.total.amount).toBeLessThan(r.tickets[0].fare.total.amount);
    expect((await listGroupTickets(r.groupRef)).length).toBe(3);
  }, 20_000);

  it("aynı anahtarla tekrar = aynı sonuç, ikinci kez bilet kesilmez", async () => {
    const key = newIdempotencyKey();
    const input = {
      ...base,
      passengers: [
        { passenger: { surname: "TEKRAR", givenName: "BIR" }, ptc: "ADT" as const, fare: fareOf("ADT") },
        { passenger: { surname: "TEKRAR", givenName: "IKI" }, ptc: "ADT" as const, fare: fareOf("ADT") },
      ],
      idempotencyKey: key,
    };
    const a = await issueGroup(input);
    const b = await issueGroup(input);
    expect(b.groupRef).toBe(a.groupRef);
    expect(b.tickets.map((t) => t.ticketNumber)).toEqual(a.tickets.map((t) => t.ticketNumber));
  }, 20_000);

  it("kural dışı tek yolcu tüm işlemi durdurur — hiçbir bilet kesilmez (hepsi ya da hiçbiri)", async () => {
    const pnr = await createPnr({
      passengers: [{ surname: "GRUP", givenName: "ALI" }, { surname: "GRUP", givenName: "VELI" }],
      segments: [{ origin: "IST", destination: "FRA", carrier: "TK", flightNumber: "TK1591", rbd: "M", departure: seg.departure, arrival: seg.arrival, status: "HK" }],
    });
    // İkinci yolcu PNR'da yok → işlem reddedilir; birinci için de bilet yazılmaz.
    await expect(issueGroup({
      ...base, pnr: pnr.recordLocator,
      passengers: [
        { passenger: { surname: "GRUP", givenName: "ALI" }, ptc: "ADT", fare: fareOf("ADT") },
        { passenger: { surname: "GRUP", givenName: "YABANCI" }, ptc: "ADT", fare: fareOf("ADT") },
      ],
      idempotencyKey: newIdempotencyKey(),
    })).rejects.toThrow(/rezervasyonunda yok/);
    const after = await getPnr(pnr.recordLocator);
    expect(after!.ticketNumbers).toHaveLength(0);
    expect(after!.status).toBe("active");

    // Doğru adlarla tüm PNR tek işlemde biletlenir ve PNR "ticketed" olur.
    const ok = await issueGroup({
      ...base, pnr: pnr.recordLocator,
      passengers: [
        { passenger: { surname: "GRUP", givenName: "ALI" }, ptc: "ADT", fare: fareOf("ADT") },
        { passenger: { surname: "GRUP", givenName: "VELI" }, ptc: "ADT", fare: fareOf("ADT") },
      ],
      idempotencyKey: newIdempotencyKey(),
    });
    const done = await getPnr(pnr.recordLocator);
    expect(done!.status).toBe("ticketed");
    expect(done!.ticketNumbers).toEqual(expect.arrayContaining(ok.tickets.map((t) => t.ticketNumber)));
    expect(await getTicket(ok.tickets[0].ticketNumber)).toBeTruthy();
  }, 30_000);

  it("aynı ad iki kez, yetişkinsiz grup, tek yolcu ve sınır aşımı reddedilir", async () => {
    const one = (g: string, ptc: "ADT" | "CHD" = "ADT") => ({ passenger: { surname: "RED", givenName: g }, ptc, fare: fareOf(ptc) });
    await expect(issueGroup({ ...base, passengers: [one("A"), one("A")], idempotencyKey: newIdempotencyKey() })).rejects.toThrow(/iki kez/);
    await expect(issueGroup({ ...base, passengers: [one("A", "CHD"), one("B", "CHD")], idempotencyKey: newIdempotencyKey() })).rejects.toThrow(/yetişkin/);
    await expect(issueGroup({ ...base, passengers: [one("A")], idempotencyKey: newIdempotencyKey() })).rejects.toThrow(/en az iki/);
    const many = Array.from({ length: GROUP_MAX + 1 }, (_, i) => one(`P${i}`));
    await expect(issueGroup({ ...base, passengers: many, idempotencyKey: newIdempotencyKey() })).rejects.toThrow(/en çok/);
  }, 20_000);

  it("tek yolcu kesimi eskisi gibi çalışır (grup referansı yok)", async () => {
    const t = await issueTicket({ ...base, passenger: { surname: "TEK", givenName: "YOLCU" }, fare: fareOf("ADT"), idempotencyKey: newIdempotencyKey() });
    expect(t.groupRef).toBeUndefined();
  }, 20_000);
});
