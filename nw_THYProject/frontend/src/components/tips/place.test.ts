import { describe, it, expect } from "vitest";
import { placeCard } from "./place";

const VP = { width: 1000, height: 800 };
const CARD = { width: 300, height: 160 };

describe("yüzen kartın yeri", () => {
  it("sığıyorsa hedefin altına, soluna hizalı", () => {
    const r = placeCard({ top: 100, left: 200, width: 80, height: 30 }, CARD, VP);
    expect(r).toEqual({ top: 142, left: 200, side: "bottom" });
  });

  it("altta yer yoksa üstüne çıkar", () => {
    const r = placeCard({ top: 700, left: 200, width: 80, height: 40 }, CARD, VP);
    expect(r.side).toBe("top");
    expect(r.top).toBe(700 - 12 - 160);
  });

  it("sağ kenardan taşmaz, ekranın içinde kalır", () => {
    const r = placeCard({ top: 100, left: 950, width: 30, height: 30 }, CARD, VP);
    expect(r.left).toBe(1000 - 300 - 12);
  });

  it("ekrandan büyük hedefte kart görünür alanda kalır", () => {
    const r = placeCard({ top: -50, left: 0, width: 1000, height: 1200 }, CARD, VP);
    expect(r.top).toBeGreaterThanOrEqual(12);
    expect(r.top + CARD.height).toBeLessThanOrEqual(VP.height - 12);
  });
});
