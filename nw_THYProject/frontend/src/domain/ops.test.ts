import { describe, it, expect } from "vitest";
import { getOpsBoard, deriveOpsStatus } from "./ops";
import { boardPassenger } from "./checkin";

describe("ops — A-CDM durum eşikleri", () => {
  it("STD'ye kalan dakikadan doğru ops durumu türetir", () => {
    expect(deriveOpsStatus(200, "scheduled")).toBe("scheduled");
    expect(deriveOpsStatus(100, "checkin_open")).toBe("checkin_open");
    expect(deriveOpsStatus(55, "checkin_open")).toBe("checkin_closed");
    expect(deriveOpsStatus(25, "boarding")).toBe("boarding");
    expect(deriveOpsStatus(18, "boarding")).toBe("final_call");
    expect(deriveOpsStatus(10, "boarding")).toBe("gate_closed");
    expect(deriveOpsStatus(-5, "scheduled")).toBe("departed");
    expect(deriveOpsStatus(60, "departed")).toBe("departed"); // base override
  });
});

describe("ops — board metrikleri tutarlı", () => {
  it("boarded ≤ accepted, paxList = accepted, KPI'lar toplanır", async () => {
    const b = await getOpsBoard();
    expect(b.flights.length).toBeGreaterThan(0);
    for (const f of b.flights) {
      expect(f.boarded).toBeLessThanOrEqual(f.accepted);
      expect(f.paxList.length).toBe(f.accepted);
      expect(f.boarded).toBe(f.paxList.filter((p) => p.boarded).length);
      expect(f.loadFactor).toBeGreaterThanOrEqual(0);
    }
    expect(b.kpis.accepted).toBeGreaterThanOrEqual(b.kpis.boarded);
    // alert'ler şiddet sırasında (critical önce)
    const sevRank = { critical: 0, warning: 1, info: 2 } as const;
    for (let i = 1; i < b.alerts.length; i++) {
      expect(sevRank[b.alerts[i - 1].severity]).toBeLessThanOrEqual(sevRank[b.alerts[i].severity]);
    }
  });

  it("canlı senkron: QuickCheck-in boarding → HUB boarded artar", async () => {
    const before = (await getOpsBoard()).flights.find((f) => f.flightId === "TK198-D")!.boarded;
    await boardPassenger("TK198-D", "p2"); // p2 checked_in → boarded
    const after = (await getOpsBoard()).flights.find((f) => f.flightId === "TK198-D")!.boarded;
    expect(after).toBe(before + 1);
  });
});
