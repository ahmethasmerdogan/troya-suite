import { describe, it, expect } from "vitest";
import {
  FLIGHTS, checkinWindow, checkInPassenger, listPassengers, recordOkToBoard, recordTravelPermit,
  paxDocCheck, isInternational, apisMissing, getSeatMap, CHECKIN_CLOSE_MIN, GATE_CLOSE_MIN, type DepartureFlight,
} from "./checkin";
import { newIdempotencyKey } from "./api";

/** Kısıtsız boş Economy koltuk — testler koltuk kuralına takılmasın. */
async function freeSeat(flightId: string, skip = 0, cabin: "Economy" | "Business" = "Economy"): Promise<string> {
  const free = (await getSeatMap(flightId)).filter((s) => !s.occupied && s.cabin === cabin && !s.exit && !s.bulkhead);
  return free[skip].id;
}

const at = (f: DepartureFlight, minsBefore: number) => Date.parse(f.departure) - minsBefore * 60000;

describe("kabul penceresi", () => {
  const intl = FLIGHTS.find((f) => f.flightId === "TK21-D")!; // IST→LHR
  const dom = FLIGHTS.find((f) => f.flightId === "TK2128-D")!; // IST→ESB

  it("dış hatta kontuar 60 dk, iç hatta 45 dk önce kapanır", () => {
    expect(checkinWindow(intl, at(intl, 61)).state).toBe("open");
    expect(checkinWindow(intl, at(intl, 60)).state).toBe("late");
    expect(checkinWindow(dom, at(dom, 50)).state).toBe("open");
    expect(checkinWindow(dom, at(dom, CHECKIN_CLOSE_MIN.domestic)).state).toBe("late");
  });

  it("kapı kapanınca (15 dk) pencere tamamen kapanır", () => {
    expect(checkinWindow(intl, at(intl, GATE_CLOSE_MIN + 1)).state).toBe("late");
    expect(checkinWindow(intl, at(intl, GATE_CLOSE_MIN)).state).toBe("closed");
  });

  it("kalkmış uçuş kapalıdır", () => {
    expect(checkinWindow({ ...intl, status: "departed" }, at(intl, 120)).state).toBe("closed");
  });
});

describe("geç kabul — sunucu zorlaması", () => {
  // TK198: kalkışa 55 dk, dış hat → kontuar kapanmış, kapı açık (geç kabul penceresi).
  const flightId = "TK198-D";

  it("onaysız kabul reddedilir; \"Diğer\" açıklamasız reddedilir; onay ve gerekçeyle yapılır ve kayda geçer", async () => {
    const f = FLIGHTS.find((x) => x.flightId === flightId)!;
    expect(checkinWindow(f).state).toBe("late");
    // Kısıtsız, belgesi uygun, henüz kabul edilmemiş yolcu (TK198'de ERDOGAN/AHMET · Business).
    const p = (await listPassengers(flightId)).find((x) => x.status === "not_checked" && !x.ssr?.length && !x.infant && !x.child
      && apisMissing(x).length === 0 && paxDocCheck(x, f).verdict !== "not_ok")!;
    const seat = await freeSeat(flightId, 0, p.cabin);

    await expect(checkInPassenger({ flightId, passengerId: p.id, seat, bags: 0, idempotencyKey: newIdempotencyKey() }))
      .rejects.toThrow(/Kontuar kapandı/);
    await expect(checkInPassenger({
      flightId, passengerId: p.id, seat, bags: 0, idempotencyKey: newIdempotencyKey(),
      late: { reason: "OTHER", approvedBy: "Mert Kaya" },
    })).rejects.toThrow(/açıklama/);

    const done = await checkInPassenger({
      flightId, passengerId: p.id, seat, bags: 0, idempotencyKey: newIdempotencyKey(),
      late: { reason: "CONN", approvedBy: "Mert Kaya" },
    });
    expect(done.status).toBe("checked_in");
    expect(done.lateAcceptance?.reason).toBe("CONN");
    expect(done.lateAcceptance?.approvedBy).toBe("Mert Kaya");
  }, 20_000);

  it("kapısı kapanmış uçuşa geç kabul de yapılamaz", async () => {
    const closed = FLIGHTS.find((f) => checkinWindow(f).state === "closed" && f.status !== "departed")!;
    const p = (await listPassengers(closed.flightId)).find((x) => x.status === "not_checked");
    if (!p) return;
    await expect(checkInPassenger({
      flightId: closed.flightId, passengerId: p.id, seat: "30A", bags: 0, idempotencyKey: newIdempotencyKey(),
      late: { reason: "CONN", approvedBy: "Mert Kaya" },
    })).rejects.toThrow(/Kapı kapandı/);
  }, 20_000);
});

describe("seyahat belgesi — kabul kapısı", () => {
  it("belgesi NOT OK yolcu kabul edilmez; izin kaydı ya da OK TO BOARD sonrası kabul açılır", async () => {
    let target: { flightId: string; id: string; permit?: string } | undefined;
    for (const f of FLIGHTS.filter((x) => isInternational(x) && checkinWindow(x).state === "open")) {
      const p = (await listPassengers(f.flightId)).find((x) => x.status === "not_checked" && apisMissing(x).length === 0
        && !x.ssr?.length && !x.infant && !x.child && x.cabin === "Economy" && paxDocCheck(x, f).verdict === "not_ok"
        && paxDocCheck(x, f).lines.every((l) => l.code !== "VALIDITY" || l.ok));
      if (p) { target = { flightId: f.flightId, id: p.id, permit: paxDocCheck(p, f).permitType }; break; }
    }
    if (!target) return; // veri setinde izni eksik yolcu yoksa kapı sınanamaz
    await expect(checkInPassenger({ flightId: target.flightId, passengerId: target.id, seat: "20A", bags: 0, idempotencyKey: newIdempotencyKey() }))
      .rejects.toThrow(/Seyahat belgesi uygun değil/);

    if (target.permit) {
      await recordTravelPermit(target.flightId, target.id, { type: target.permit, number: "V1234567", validUntil: "2029-01-01" });
    } else {
      await recordOkToBoard(target.flightId, target.id, "OTB-7781", "Mert Kaya");
    }
    const done = await checkInPassenger({ flightId: target.flightId, passengerId: target.id, seat: await freeSeat(target.flightId, 3), bags: 0, idempotencyKey: newIdempotencyKey() });
    expect(done.status).toBe("checked_in");
  }, 30_000);

  it("OK TO BOARD makam referansı olmadan kaydedilmez", async () => {
    const f = FLIGHTS.find((x) => x.flightId === "TK21-D")!;
    const p = (await listPassengers(f.flightId))[0];
    await expect(recordOkToBoard(f.flightId, p.id, "", "Mert Kaya")).rejects.toThrow(/referans/);
  });
});
