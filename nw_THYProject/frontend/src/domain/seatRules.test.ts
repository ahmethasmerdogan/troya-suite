import { describe, it, expect } from "vitest";
import { seatDenial, paxSeatNotes } from "./seatRules";
import { seatFromId, checkInPassenger, listPassengers, listFlights, type CheckinPassenger, type Seat } from "./checkin";
import { layoutFor, seatCount, configString, seatPosition, AIRCRAFT_LAYOUTS } from "./aircraftLayout";

/*
 * Koltuk uygunluk kuralları (DCS) — her koltuk her yolcuya verilmez.
 *
 * Kabin, çıkış ve bulkhead sıraları artık SABİT değil, uçağın düzeninden
 * gelir. Testler bu yüzden bir uçuş üzerinden çalışır:
 *   TK198-D → Boeing 777-300ER: Business 1-8, Economy 9-52, exit 9/30/31,
 *   bulkhead 1/9, düzen 3-4-3 (A B C | D E F G | H J K).
 */
const FLIGHT = "TK198-D"; // B777-300ER
const base: CheckinPassenger = {
  id: "t1", surname: "TEST", givenName: "USER", pnr: "AAAAAA",
  cabin: "Economy", status: "not_checked", bags: 0,
};
const seat = (id: string): Seat => {
  const s = seatFromId(id, FLIGHT);
  if (!s) throw new Error("geçersiz koltuk: " + id);
  return s;
};

describe("aircraftLayout — kapasite düzenden türer", () => {
  it("her tip için koltuk sayısı, yapılandırma metni ve kabin sınırları tutarlı", () => {
    for (const l of AIRCRAFT_LAYOUTS) {
      const n = seatCount(l);
      expect(n).toBeGreaterThan(100);
      // Yapılandırma metnindeki sayıların toplamı koltuk sayısına eşit olmalı.
      const sum = [...configString(l).matchAll(/\d+/g)].reduce((a, m) => a + Number(m[0]), 0);
      expect(sum).toBe(n);
      // Bölgeler boşluksuz ve çakışmasız ilerlemeli.
      const sorted = [...l.zones].sort((a, b) => a.fromRow - b.fromRow);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].fromRow).toBe(sorted[i - 1].toRow + 1);
      }
    }
  });

  it("uçuş kapasitesi haritadaki koltuk sayısıyla aynı — üç ayrı sayı yok", async () => {
    for (const f of await listFlights()) {
      expect(f.capacity).toBe(seatCount(layoutFor(f.aircraft.type)));
      expect(f.checkedIn).toBeLessThanOrEqual(f.capacity);
    }
  });

  it("pencere/koridor/orta konumu düzenden okunur", () => {
    const wide = ["A", "B", "C", null, "D", "E", "F", "G", null, "H", "J", "K"];
    expect(seatPosition(wide, "A")).toBe("window");
    expect(seatPosition(wide, "K")).toBe("window");
    expect(seatPosition(wide, "C")).toBe("aisle");
    expect(seatPosition(wide, "D")).toBe("aisle");
    expect(seatPosition(wide, "B")).toBe("middle");
    expect(seatPosition(wide, "E")).toBe("middle");
  });

  it("uçak tipi değişince aynı koltuk numarası farklı kabine düşer", () => {
    // 5A: 777'de Business (1-8), 737-800'de Economy (4-30).
    expect(seatFromId("5A", "TK198-D")?.cabin).toBe("Business");
    expect(seatFromId("5A", "TK2410-D")?.cabin).toBe("Economy");
  });

  it("uçakta olmayan koltuk reddedilir", () => {
    // 737-800 dar gövde: K sütunu yok.
    expect(seatFromId("20K", "TK2410-D")).toBeNull();
    // 777'de 60. sıra yok.
    expect(seatFromId("60A", "TK198-D")).toBeNull();
  });
});

describe("seatRules — kabin eşleşmesi", () => {
  it("Business koltuk Economy yolcuya verilmez", () => {
    expect(seatDenial(base, seat("3A"))?.code).toBe("CABIN");
  });
  it("Business yolcuya alt kabin verilmez (downgrade ayrı işlem)", () => {
    expect(seatDenial({ ...base, cabin: "Business" }, seat("20A"))?.code).toBe("CABIN");
    expect(seatDenial({ ...base, cabin: "Business" }, seat("3A"))).toBeNull();
  });
  it("Premium bölge Economy yolcuya açıktır (ekstra diz mesafesi)", () => {
    // A350'de Premium 9-12.
    const s = seatFromId("10A", "TK6-D");
    expect(s?.cabin).toBe("Premium");
    expect(seatDenial(base, s!)).toBeNull();
  });
});

describe("seatRules — exit sırası (able-bodied kuralı)", () => {
  it.each([
    [{ ...base, infant: true }, "kucak bebeği"],
    [{ ...base, child: true }, "çocuk"],
    [{ ...base, ssr: ["WCHR"] }, "WCHR"],
    [{ ...base, ssr: ["UMNR"] }, "UMNR"],
    [{ ...base, ssr: ["BLND"] }, "BLND"],
    [{ ...base, ssr: ["PETC"] }, "PETC"],
  ] as [CheckinPassenger, string][])("exit koltuk kısıtlı yolcuya verilmez (%#)", (pax) => {
    expect(seatDenial(pax, seat("30A"))?.code).toBe("EXIT");
    expect(seatDenial(pax, seat("31D"))?.code).toBe("EXIT");
  });

  it("kısıtsız yetişkin exit sırasına oturabilir", () => {
    expect(seatDenial(base, seat("30B"))).toBeNull();
  });
});

describe("seatRules — özel konum kuralları", () => {
  it("WCHC yalnız pencere kenarına oturur — kenar sütun uçağa göre değişir", () => {
    const pax = { ...base, ssr: ["WCHC"] };
    expect(seatDenial(pax, seat("20C"))?.code).toBe("WINDOW_ONLY"); // koridor
    expect(seatDenial(pax, seat("20E"))?.code).toBe("WINDOW_ONLY"); // orta
    expect(seatDenial(pax, seat("20A"))).toBeNull(); // pencere
    expect(seatDenial(pax, seat("20K"))).toBeNull(); // 777'de diğer pencere K
  });
  it("PETC bulkhead'e (kabin ilk sırası) oturamaz", () => {
    const pax = { ...base, ssr: ["PETC"] };
    // 777'de 9. sıra hem bulkhead hem exit — exit kuralı önce döner.
    expect(seatDenial(pax, seat("9A"))?.code).toBe("EXIT");
    // A350'de 13 exit+bulkhead, 9 yalnız bulkhead (Premium bölme başı).
    const bulk = seatFromId("9A", "TK6-D")!;
    expect(bulk.bulkhead).toBe(true);
    expect(seatDenial({ ...pax, cabin: "Economy" }, bulk)).toEqual(expect.objectContaining({ code: "BULKHEAD" }));
    expect(seatDenial(pax, seat("20A"))).toBeNull();
  });
  it("kısıtsız yolcu için özet not yok; kısıtlı için insan-okur özet üretilir", () => {
    expect(paxSeatNotes(base)).toEqual([]);
    expect(paxSeatNotes({ ...base, infant: true, ssr: ["WCHC"] }).length).toBe(2);
  });
});

describe("seatRules — mock sunucu zorlaması (backend otorite)", () => {
  it("checkInPassenger kural ihlalinde reddeder (UI atlatılsa bile)", async () => {
    // TK198'de WANG/LEI kucak bebeğiyle seyahat ediyor → exit sırası (30A) reddedilir.
    const pax = (await listPassengers(FLIGHT)).find((p) => p.surname === "WANG");
    expect(pax?.infant).toBe(true);
    await expect(
      checkInPassenger({ flightId: FLIGHT, passengerId: pax!.id, seat: "30A", bags: 1, idempotencyKey: "test-seat-rule-1" }),
    ).rejects.toThrow(/verilemez/);
    // uygun koltuk (Economy, exit değil) kabul edilir
    const ok = await checkInPassenger({ flightId: FLIGHT, passengerId: pax!.id, seat: "20B", bags: 1, idempotencyKey: "test-seat-rule-2" });
    expect(ok.seat).toBe("20B");
  });

  it("dolu koltuk ikinci yolcuya verilmez (sunucu tarafında da)", async () => {
    const list = await listPassengers(FLIGHT);
    const a = list.find((p) => p.seat && p.status === "checked_in");
    const b = list.find((p) => p.id !== a?.id && p.status === "not_checked" && !p.ssr?.length && !p.infant && !p.child && p.cabin === "Economy");
    if (!a || !b) return;
    await expect(
      checkInPassenger({ flightId: FLIGHT, passengerId: b.id, seat: a.seat!, bags: 0, idempotencyKey: "test-seat-dup" }),
    ).rejects.toThrow(/dolu/);
  });

  it("koltuk değiştirmek kabul sayacını şişirmez", async () => {
    const flight = (await listFlights()).find((f) => f.flightId === FLIGHT)!;
    const pax = (await listPassengers(FLIGHT)).find((p) => p.surname === "WANG")!;
    const before = flight.checkedIn;
    await checkInPassenger({ flightId: FLIGHT, passengerId: pax.id, seat: "21B", bags: 1, idempotencyKey: "test-seat-move" });
    expect(flight.checkedIn).toBe(before); // zaten kabul edilmişti
  });
});
