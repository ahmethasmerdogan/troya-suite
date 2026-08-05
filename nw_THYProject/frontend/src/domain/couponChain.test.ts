import { describe, it, expect } from "vitest";
import {
  listFlights, listPassengers, checkInPassenger, boardPassenger,
  undoCheckIn, boardAll, closeOutFlight,
} from "./checkin";
import { advanceCouponStatus, takeAirportControl, getTicket, newIdempotencyKey } from "./api";

/**
 * Kupon zinciri UÇTAN UCA: O → A → C → L → F.
 *
 * Eksik olan buydu — check-in C, biniş L yazıyordu ama hiçbir ekran
 * havalimanı kontrolü (A) almıyor ve hiçbir ekran Flown (F) yazmıyordu.
 */
/**
 * Kısıtsız bir yolcu bul: Economy, SSR yok, bebek/çocuk yok, henüz kabul
 * edilmemiş. Testler modül durumunu paylaştığı için her test farklı uçuş
 * kullanır (`skip` ile ilerlenir); `needTicket` yalnız kupon zinciri
 * testlerinde gerekir (her yolcu gerçek bir ET'ye bağlı değildir).
 */
async function paxWithTicket(skip = 0, needTicket = true) {
  let seen = 0;
  for (const f of await listFlights()) {
    if (f.status === "departed" || f.status === "closed") continue;
    const list = await listPassengers(f.flightId);
    for (const p of list) {
      if (p.status !== "not_checked" || p.cabin !== "Economy") continue;
      if (p.ssr?.length || p.infant || p.child) continue;
      if (needTicket) {
        if (!p.ticketNumber || p.couponSeq == null) continue;
        if (!(await getTicket(p.ticketNumber))) continue;
      }
      if (seen++ < skip) break; // bu uçuşu atla, sonrakine geç
      return { flight: f, pax: p };
    }
  }
  throw new Error("uygun yolcu yok");
}

describe("kupon zinciri — O→A→C→L→F", () => {
  it("havalimanı kontrolü kuponu O'dan A'ya taşır", async () => {
    const { pax } = await paxWithTicket(0);
    await takeAirportControl(pax.ticketNumber!, pax.couponSeq!);
    const t = await getTicket(pax.ticketNumber!);
    expect(t!.coupons.find((c) => c.seq === pax.couponSeq)!.status).toBe("A");
  }, 20_000);

  it("kabul → biniş → uçuş kapanışı kuponu Flown'a getirir", async () => {
    const { flight, pax } = await paxWithTicket(1);
    await takeAirportControl(pax.ticketNumber!, pax.couponSeq!);
    await checkInPassenger({ flightId: flight.flightId, passengerId: pax.id, seat: "20C", bags: 1, idempotencyKey: newIdempotencyKey() });
    await advanceCouponStatus(pax.ticketNumber!, pax.couponSeq!, "C");
    await boardPassenger(flight.flightId, pax.id);
    await advanceCouponStatus(pax.ticketNumber!, pax.couponSeq!, "L");

    const res = await closeOutFlight(flight.flightId);
    expect(res.flight.status).toBe("departed");
    for (const b of res.boarded) {
      if (b.ticketNumber && b.couponSeq != null) await advanceCouponStatus(b.ticketNumber, b.couponSeq, "F");
    }
    const t = await getTicket(pax.ticketNumber!);
    expect(t!.coupons.find((c) => c.seq === pax.couponSeq)!.status).toBe("F");
    // F final statüsü SAC üretir (1.3.6).
    expect(t!.coupons.find((c) => c.seq === pax.couponSeq)!.sac).toBeTruthy();
  }, 30_000);

  it("kapatılmış uçuş ikinci kez kapatılamaz", async () => {
    const { flight, pax } = await paxWithTicket(2);
    await checkInPassenger({ flightId: flight.flightId, passengerId: pax.id, seat: "21C", bags: 0, idempotencyKey: newIdempotencyKey() });
    await closeOutFlight(flight.flightId);
    await expect(closeOutFlight(flight.flightId)).rejects.toThrow();
  }, 20_000);
});

describe("check-in geri alma", () => {
  it("kabul geri alınınca koltuk boşalır ve sayaç düşer", async () => {
    const { flight, pax } = await paxWithTicket(0, false);
    const before = flight.checkedIn;
    await checkInPassenger({ flightId: flight.flightId, passengerId: pax.id, seat: "22A", bags: 1, idempotencyKey: newIdempotencyKey() });
    const undone = await undoCheckIn(flight.flightId, pax.id);
    expect(undone.status).toBe("not_checked");
    expect(undone.seat).toBeUndefined();
    expect(flight.checkedIn).toBe(before);
  }, 20_000);

  it("uçağa binmiş yolcunun kabulü geri alınamaz", async () => {
    const { flight, pax } = await paxWithTicket(1, false);
    await checkInPassenger({ flightId: flight.flightId, passengerId: pax.id, seat: "23A", bags: 0, idempotencyKey: newIdempotencyKey() });
    await boardPassenger(flight.flightId, pax.id);
    await expect(undoCheckIn(flight.flightId, pax.id)).rejects.toThrow();
  }, 20_000);
});

describe("toplu biniş", () => {
  it("kabul edilmiş herkesi bindirir, kimse kalmazsa hata verir", async () => {
    const { flight, pax } = await paxWithTicket(2, false);
    await checkInPassenger({ flightId: flight.flightId, passengerId: pax.id, seat: "24A", bags: 0, idempotencyKey: newIdempotencyKey() });
    const boarded = await boardAll(flight.flightId);
    expect(boarded.length).toBeGreaterThan(0);
    expect(boarded.every((p) => p.status === "boarded")).toBe(true);
    await expect(boardAll(flight.flightId)).rejects.toThrow();
  }, 20_000);
});
