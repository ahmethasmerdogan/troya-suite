import { describe, it, expect } from "vitest";
import { FLIGHTS, listPassengers, searchPassengers } from "./checkin";

describe("checkin — yolcu arama (regresyon: 'check-in'de uçuş bulunamıyor')", () => {
  it("her uçuşta yolcu vardır (boş liste yok)", async () => {
    for (const f of FLIGHTS) {
      const pax = await listPassengers(f.flightId);
      expect(pax.length, `${f.flightId} yolcusuz olmamalı`).toBeGreaterThan(0);
    }
  });

  it("el yazımı PNR / pasaport / ad ile sonuç döner", async () => {
    expect((await searchPassengers("XQ7T2M")).length).toBeGreaterThan(0); // PNR
    expect((await searchPassengers("U07654321")).length).toBeGreaterThan(0); // pasaport
    expect((await searchPassengers("ERDOGAN")).length).toBeGreaterThan(0); // soyad
    expect((await searchPassengers("12345678901")).length).toBeGreaterThan(0); // TC kimlik
  });

  it("uçuş kodu ile o uçuştaki yolcuları bulur", async () => {
    const hits = await searchPassengers("TK6");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.flight.flightNumber === "TK6")).toBe(true);
  });

  it("eşleşmeyen sorguda boş döner (patlamaz)", async () => {
    expect(await searchPassengers("ZZZQQQ999")).toEqual([]);
  });
});
