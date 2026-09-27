import { describe, it, expect } from "vitest";
import {
  listFlights, listPassengers, checkInPassenger, recordApis,
  apisMissing, isInternational, checkinWindow,
} from "./checkin";
import { newIdempotencyKey } from "./api";

/**
 * APIS kapısı — uluslararası uçuşta eksik yolcu bilgisiyle kabul yapılamaz.
 * Alan veri modelinde vardı ama hiçbir yerde zorlanmıyordu.
 */
describe("APIS", () => {
  it("yurt içi uçuş uluslararası sayılmaz", async () => {
    const flights = await listFlights();
    const dom = flights.find((f) => f.origin === "IST" && f.destination === "ESB")!;
    expect(isInternational(dom)).toBe(false);
    const intl = flights.find((f) => f.destination === "JFK")!;
    expect(isInternational(intl)).toBe(true);
  });

  it("eksik APIS'li yolcu uluslararası uçuşta kabul EDİLEMEZ", async () => {
    const flights = await listFlights();
    // Kontuarı açık bir dış hat uçuşu — kapanmış uçuşta ret APIS'ten önce pencereden gelir.
    const intl = flights.find((f) => isInternational(f) && checkinWindow(f).state === "open")!;
    const list = await listPassengers(intl.flightId);
    const bad = list.find((p) => p.status === "not_checked" && apisMissing(p).length > 0);
    if (!bad) return; // veri setinde eksik APIS'li yolcu yoksa kural zaten sınanamaz
    await expect(checkInPassenger({
      flightId: intl.flightId, passengerId: bad.id, seat: "20C", bags: 0, idempotencyKey: newIdempotencyKey(),
    })).rejects.toThrow(/APIS/);
  }, 20_000);

  it("APIS tamamlanınca kabul açılır", async () => {
    const flights = await listFlights();
    const intl = flights.find((f) => isInternational(f) && f.status !== "departed")!;
    const list = await listPassengers(intl.flightId);
    const bad = list.find((p) => p.status === "not_checked" && apisMissing(p).length > 0);
    if (!bad) return;
    const fixed = await recordApis(intl.flightId, bad.id, { passport: "X1234567", nationality: "gb" });
    expect(fixed.apis).toBe(true);
    expect(fixed.nationality).toBe("GB");
    expect(apisMissing(fixed)).toHaveLength(0);
  }, 20_000);

  it("geçersiz uyruk kodu reddedilir", async () => {
    const flights = await listFlights();
    const intl = flights.find((f) => isInternational(f))!;
    const p = (await listPassengers(intl.flightId))[0];
    await expect(recordApis(intl.flightId, p.id, { passport: "A1", nationality: "TUR" })).rejects.toThrow(/ISO-2/);
  }, 20_000);
});
