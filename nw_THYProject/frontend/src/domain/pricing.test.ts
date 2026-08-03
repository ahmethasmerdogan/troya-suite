import { describe, it, expect } from "vitest";
import { quoteFares } from "./pricing";
import { FARE_TYPES } from "./fareTypes";

describe("pricing / fare quote", () => {
  const route = { legs: [{ origin: "IST", destination: "LHR" }] };

  it("her bilet ailesi için bir teklif üretir", async () => {
    const offers = await quoteFares(route);
    expect(offers).toHaveLength(FARE_TYPES.length);
  });

  it("base + TFC == total (tutarlı; frontend O2 dersi)", async () => {
    const offers = await quoteFares(route);
    for (const o of offers) {
      expect(o.baseFare.amount + o.totalTfc.amount).toBe(o.total.amount);
      expect(o.baseFare.currency).toBe(o.total.currency);
    }
  });

  it("deterministik: aynı güzergâh → aynı fiyatlar", async () => {
    const a = await quoteFares(route);
    const b = await quoteFares(route);
    expect(a.map((o) => o.total.amount)).toEqual(b.map((o) => o.total.amount));
  });

  it("Business kabin Economy'den pahalı (kabin çarpanı)", async () => {
    const offers = await quoteFares(route);
    const biz = offers.find((o) => o.id === "biz-flex")!;
    const eco = offers.find((o) => o.id === "eco-flex")!;
    expect(biz.total.amount).toBeGreaterThan(eco.total.amount);
  });

  it("Flex > Saver (esnek ücret daha pahalı) + esnek koltuk hakkı ücretsiz", async () => {
    const offers = await quoteFares(route);
    const flex = offers.find((o) => o.id === "eco-flex")!;
    const saver = offers.find((o) => o.id === "eco-saver")!;
    expect(flex.total.amount).toBeGreaterThan(saver.total.amount);
    expect(flex.seatSelection).toBe("included");
    expect(saver.seatSelection).toBe("paid");
  });

  it("kabin içinde yüksek→düşük sıralı; boş güzergâh boş döner", async () => {
    const offers = await quoteFares(route);
    const eco = offers.filter((o) => o.cabin === "Economy").map((o) => o.total.amount);
    expect(eco).toEqual([...eco].sort((a, b) => b - a));
    expect(await quoteFares({ legs: [] })).toEqual([]);
  });
});
