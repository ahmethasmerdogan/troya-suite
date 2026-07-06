import { describe, it, expect } from "vitest";
import { seatDenial, paxSeatNotes } from "./seatRules";
import { seatFromId, checkInPassenger, listPassengers, type CheckinPassenger, type Seat } from "./checkin";

// Koltuk uygunluk kuralları (DCS) — her koltuk her yolcuya verilmez.
// Düzen: Business 1-5 · Premium 6-14 · Economy 15-42 · exit sıraları 15/16/30/31.

const base: CheckinPassenger = {
  id: "t1", surname: "TEST", givenName: "USER", pnr: "AAAAAA",
  cabin: "Economy", status: "not_checked", bags: 0,
};
const seat = (id: string): Seat => {
  const s = seatFromId(id);
  if (!s) throw new Error("geçersiz koltuk: " + id);
  return s;
};

describe("seatRules — kabin eşleşmesi", () => {
  it("Business koltuk Economy yolcuya verilmez", () => {
    expect(seatDenial(base, seat("3A"))?.code).toBe("CABIN");
  });
  it("Business yolcuya alt kabin verilmez (downgrade ayrı işlem)", () => {
    expect(seatDenial({ ...base, cabin: "Business" }, seat("20A"))?.code).toBe("CABIN");
    expect(seatDenial({ ...base, cabin: "Business" }, seat("3A"))).toBeNull();
  });
  it("Premium bölge Economy yolcuya açıktır (ekstra diz mesafesi)", () => {
    expect(seatDenial(base, seat("8C"))).toBeNull();
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
    expect(seatDenial(pax, seat("15A"))?.code).toBe("EXIT");
    expect(seatDenial(pax, seat("30C"))?.code).toBe("EXIT");
  });

  it("kısıtsız yetişkin exit sırasına oturabilir", () => {
    expect(seatDenial(base, seat("16B"))).toBeNull();
  });
});

describe("seatRules — özel konum kuralları", () => {
  it("WCHC yalnız pencere kenarına (A/F) oturur", () => {
    const pax = { ...base, ssr: ["WCHC"] };
    expect(seatDenial(pax, seat("20C"))?.code).toBe("WINDOW_ONLY");
    expect(seatDenial(pax, seat("20A"))).toBeNull();
    expect(seatDenial(pax, seat("20F"))).toBeNull();
  });
  it("PETC bulkhead'e (kabin ilk sırası) oturamaz", () => {
    const pax = { ...base, ssr: ["PETC"] };
    expect(seatDenial(pax, seat("15A"))?.code).toBe("EXIT"); // 15 hem bulkhead hem exit — exit önce
    expect(seatDenial(pax, seat("6A"))).toEqual(expect.objectContaining({ code: "BULKHEAD" }));
    expect(seatDenial(pax, seat("20A"))).toBeNull();
  });
  it("kısıtsız yolcu için özet not yok; kısıtlı için insan-okur özet üretilir", () => {
    expect(paxSeatNotes(base)).toEqual([]);
    expect(paxSeatNotes({ ...base, infant: true, ssr: ["WCHC"] }).length).toBe(2);
  });
});

describe("seatRules — mock sunucu zorlaması (backend otorite)", () => {
  it("checkInPassenger kural ihlalinde reddeder (UI atlatılsa bile)", async () => {
    // TK198'de WANG/LEI kucak bebeğiyle seyahat ediyor (el yazımı veri) → exit 15A reddedilir.
    const pax = (await listPassengers("TK198-D")).find((p) => p.surname === "WANG");
    expect(pax?.infant).toBe(true);
    await expect(
      checkInPassenger({ flightId: "TK198-D", passengerId: pax!.id, seat: "15A", bags: 1, idempotencyKey: "test-seat-rule-1" }),
    ).rejects.toThrow(/verilemez/);
    // uygun koltuk (Economy, exit değil) kabul edilir
    const ok = await checkInPassenger({ flightId: "TK198-D", passengerId: pax!.id, seat: "20B", bags: 1, idempotencyKey: "test-seat-rule-2" });
    expect(ok.seat).toBe("20B");
  });
});
