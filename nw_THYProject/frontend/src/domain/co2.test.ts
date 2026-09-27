import { describe, it, expect } from "vitest";
import { co2PerPax, correctedKm, cabinOfRbd } from "./co2";

describe("yolcu başı CO₂ (IATA RP 1726 yöntemi)", () => {
  it("ICAO mesafe düzeltmesi", () => {
    expect(correctedKm(400)).toBe(450);
    expect(correctedKm(2500)).toBe(2600);
    expect(correctedKm(8000)).toBe(8125);
  });

  it("araştırmadaki akla yatkınlık kontrolleriyle uyumlu", () => {
    const lhr = co2PerPax("IST", "LHR", "Economy", "Airbus A321neo")!;
    expect(lhr).toBeGreaterThan(140);
    expect(lhr).toBeLessThan(180);
    const jfk = co2PerPax("IST", "JFK", "Economy", "Boeing 777-300ER")!;
    expect(jfk).toBeGreaterThan(420);
    expect(jfk).toBeLessThan(520);
  });

  it("geniş gövdede Business ekonominin 4 katı, dar gövdede 1,5 katı", () => {
    const y = co2PerPax("IST", "JFK", "Economy")!;
    expect(co2PerPax("IST", "JFK", "Business")).toBeCloseTo(y * 4, -1);
    const yn = co2PerPax("IST", "AYT", "Economy")!;
    expect(co2PerPax("IST", "AYT", "Business")).toBeCloseTo(yn * 1.5, -1);
  });

  it("uzun rota kısa rotadan fazla; bilinmeyen havalimanında tahmin yok", () => {
    expect(co2PerPax("IST", "JFK")!).toBeGreaterThan(co2PerPax("IST", "FRA")!);
    expect(co2PerPax("IST", "XXX")).toBeUndefined();
  });

  it("RBD → kabin", () => {
    expect(cabinOfRbd("C")).toBe("Business");
    expect(cabinOfRbd("W")).toBe("Premium");
    expect(cabinOfRbd("Y")).toBe("Economy");
  });
});
