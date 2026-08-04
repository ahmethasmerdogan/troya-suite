import { describe, it, expect } from "vitest";
import { flightCode } from "./utils";

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
