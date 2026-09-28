import { describe, it, expect } from "vitest";
import { flightCode, parseAmount, toLocalInput } from "./utils";

// "TKTK198" hatası: veri kaynakları uçuş numarasını farklı tutuyor —
// check-in/rezervasyon "TK198", kesim sihirbazı "198". Render tarafında
// körlemesine birleştirmek taşıyıcıyı iki kez basıyordu.
describe("sefer tanıtıcısı", () => {
  it("uçuş numarası zaten taşıyıcı öneki taşıyorsa tekrar eklenmez", () => {
    expect(flightCode("TK", "TK198")).toBe("TK198");
    expect(flightCode("TK", "TK2410")).toBe("TK2410");
  });

  it("öneksiz numaraya taşıyıcı eklenir", () => {
    expect(flightCode("TK", "198")).toBe("TK198");
    expect(flightCode("LH", "1304")).toBe("LH1304");
  });

  it("küçük harf ve boşluk normalize edilir", () => {
    expect(flightCode("tk", " tk198 ")).toBe("TK198");
  });

  it("eksik girdilerde patlamaz", () => {
    expect(flightCode("TK", "")).toBe("TK");
    expect(flightCode("", "198")).toBe("198");
    expect(flightCode(undefined, undefined)).toBe("");
  });
});

describe("parseAmount — TR ve EN tutar yazımı", () => {
  it.each([
    ["1.250,50", 1250.5], ["1,250.50", 1250.5], ["1250,5", 1250.5], ["1250.5", 1250.5],
    ["1.250", 1250], ["1,250", 1250], ["1.234.567", 1234567], ["1.234.567,89", 1234567.89],
    ["150", 150], ["", 0], ["  42,00 ", 42],
  ])("%s → %d", (raw, n) => { expect(parseAmount(raw)).toBeCloseTo(n, 6); });
  it("anlamsız girdi NaN", () => {
    expect(Number.isNaN(parseAmount("abc"))).toBe(true);
    expect(Number.isNaN(parseAmount("12a"))).toBe(true);
  });
});

describe("toLocalInput", () => {
  it("yerel saati verir, geri okununca aynı ana döner", () => {
    const iso = "2026-06-20T08:30:00.000Z";
    const v = toLocalInput(iso);
    expect(v).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(new Date(v).toISOString()).toBe(iso);
  });
  it("geçersiz tarihte boş döner", () => {
    expect(toLocalInput("x")).toBe("");
  });
});
