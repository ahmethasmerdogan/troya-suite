import { describe, it, expect } from "vitest";
import { searchFlights, fmtDuration } from "./flights";
import { cheapestTotal } from "./pricing";

describe("flights / availability", () => {
  const flights = searchFlights("IST", "LHR", "2026-07-15", 4);

  it("gün × slot kadar sefer üretir (4×4=16)", () => {
    expect(flights).toHaveLength(16);
  });

  it("hepsi TK ve geçerli sefer no", () => {
    expect(flights.every((f) => f.carrier === "TK" && /^TK\d+$/.test(f.flightNumber))).toBe(true);
  });

  it("deterministik: aynı sorgu → aynı liste", () => {
    const again = searchFlights("IST", "LHR", "2026-07-15", 4);
    expect(again.map((f) => f.id)).toEqual(flights.map((f) => f.id));
  });

  it("varış kalkıştan sonra; from-eco < from-biz", () => {
    for (const f of flights) {
      expect(new Date(f.arrival).getTime()).toBeGreaterThan(new Date(f.departure).getTime());
      expect(f.fromEconomy!.amount).toBeLessThan(f.fromBusiness!.amount);
    }
  });

  it("liste from-fiyatı ücret tarifesiyle tutarlı (aynı demandFactor)", () => {
    const f = flights[0];
    const eco = cheapestTotal([{ origin: "IST", destination: "LHR" }], "Economy", f.demandFactor);
    expect(eco?.amount).toBe(f.fromEconomy!.amount);
  });

  it("geçersiz güzergâh boş; fmtDuration okunur", () => {
    expect(searchFlights("IS", "LHR")).toHaveLength(0);
    expect(fmtDuration(135)).toBe("2s 15d");
  });
});
