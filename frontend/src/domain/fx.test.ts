import { describe, it, expect } from "vitest";
import { convert, fxLines, FX_TO_TRY } from "./fx";

describe("fx — döviz çevirisi (ekranda ≈ gösterimi)", () => {
  it("USD → TRY kur tablosuyla tutarlı çevirir", () => {
    const v = convert(100, "USD", "TRY");
    expect(v).toBeCloseTo(100 * FX_TO_TRY.USD, 5);
  });

  it("aynı para biriminde değer korunur", () => {
    expect(convert(250, "TRY", "TRY")).toBe(250);
  });

  it("bilinmeyen para biriminde null döner (patlamaz)", () => {
    expect(convert(100, "XYZ", "TRY")).toBeNull();
  });

  it("fxLines girilen birimi atlar, diğerlerini ≈ ile verir", () => {
    const lines = fxLines(100, "USD"); // hedef TRY, USD (USD atlanır)
    expect(lines.length).toBe(1);
    expect(lines[0]).toMatch(/≈ .* TRY/);
  });
});
