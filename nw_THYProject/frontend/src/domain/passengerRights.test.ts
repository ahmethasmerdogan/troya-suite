import { describe, it, expect } from "vitest";
import { greatCircleKm } from "./geo";
import { assessRights, bandOf, payableRegime, type DisruptionInput } from "./passengerRights";

const base = (o: Partial<DisruptionInput>): DisruptionInput => ({
  origin: "IST", destination: "FRA", operatingCarrier: "TK", kind: "cancellation",
  arrivalDelayMin: 0, noticeDays: 1, extraordinary: false, ...o,
});
const regime = (a: ReturnType<typeof assessRights>, r: string) => a.regimes.find((x) => x.regime === r)!;

describe("büyük daire mesafesi", () => {
  it("bilinen rotalar gerçek mesafeye yakın", () => {
    expect(greatCircleKm("IST", "FRA")).toBeGreaterThan(1800);
    expect(greatCircleKm("IST", "FRA")).toBeLessThan(1900);
    expect(greatCircleKm("IST", "JFK")).toBeGreaterThan(8000);
    expect(greatCircleKm("IST", "JFK")).toBeLessThan(8150);
    expect(greatCircleKm("IST", "AYT")).toBeLessThan(520);
    expect(greatCircleKm("IST", "XXX")).toBeUndefined();
  });

  it("bant: ≤1500 · 1500–3500 · >3500; AB içi >1500 hep 2. bant", () => {
    expect(bandOf(1500, false)).toBe(1);
    expect(bandOf(1501, false)).toBe(2);
    expect(bandOf(3501, false)).toBe(3);
    expect(bandOf(4000, true)).toBe(2);
  });
});

describe("kapsam", () => {
  it("IST→FRA (TK): SHY kapsar, EU261 kapsamaz — AB dışından varışta TK AB taşıyıcısı değil", () => {
    const a = assessRights(base({}));
    expect(regime(a, "SHY").applies).toBe(true);
    expect(regime(a, "SHY").amount).toBe(400);
    expect(regime(a, "EU261").applies).toBe(false);
    expect(regime(a, "EU261").reason).toMatch(/AB taşıyıcısı değil/);
  });

  it("FRA→IST (TK): AB'den kalkış EU261'e girer; aynı olay mükerrer ödenmez", () => {
    const a = assessRights(base({ origin: "FRA", destination: "IST" }));
    expect(regime(a, "EU261").applies).toBe(true);
    expect(regime(a, "SHY").applies).toBe(true);
    expect(a.regimes.filter((r) => r.applies)).toHaveLength(2);
    expect(payableRegime(a)?.amount).toBe(400);
  });

  it("LHR→IST (TK): UK261 kalkış kapsamı, £350", () => {
    const a = assessRights(base({ origin: "LHR", destination: "IST" }));
    expect(regime(a, "UK261").applies).toBe(true);
    expect(regime(a, "UK261").amount).toBe(350);
    expect(regime(a, "UK261").currency).toBe("GBP");
  });
});

describe("tutar ve muafiyetler", () => {
  it("iç hat SHY-YOLCU: tek tutar €100", () => {
    const a = assessRights(base({ destination: "AYT", kind: "delay", arrivalDelayMin: 200 }));
    expect(a.domesticTr).toBe(true);
    expect(regime(a, "SHY").amount).toBe(100);
  });

  it("rötar 3 saatin altındaysa tazminat yok", () => {
    const a = assessRights(base({ kind: "delay", arrivalDelayMin: 150 }));
    expect(regime(a, "SHY").applies).toBe(false);
  });

  it("uzun mesafede 3–4 saatlik rötar %50 indirimli (€600 → €300)", () => {
    const a = assessRights(base({ destination: "JFK", kind: "delay", arrivalDelayMin: 200 }));
    expect(regime(a, "SHY").amount).toBe(300);
    expect(regime(a, "SHY").reduced).toBe(true);
    const full = assessRights(base({ destination: "JFK", kind: "delay", arrivalDelayMin: 300 }));
    expect(regime(full, "SHY").amount).toBe(600);
  });

  it("olağanüstü hâlde tazminat yok, bakım hakkı sürer", () => {
    const a = assessRights(base({ kind: "delay", arrivalDelayMin: 300, extraordinary: true }));
    expect(a.regimes.every((r) => !r.applies)).toBe(true);
    expect(a.care.meals).toBe(true);
    expect(a.care.refundOption).toBe(true);
  });

  it("iptal ≥14 gün önce bildirildiyse tazminat yok", () => {
    expect(regime(assessRights(base({ noticeDays: 15 })), "SHY").applies).toBe(false);
  });

  it("7–13 gün bildirim + makul alternatif (≤2 sa erken, <4 sa geç) → muaf", () => {
    const a = assessRights(base({ noticeDays: 10, reroute: { departEarlierMin: 60, arriveLaterMin: 200 } }));
    expect(regime(a, "SHY").applies).toBe(false);
  });

  it("biniş reddinde alternatif varışı bant eşiğinde kalırsa %50 indirim", () => {
    const a = assessRights(base({ destination: "ATH", kind: "denied_boarding", reroute: { departEarlierMin: 0, arriveLaterMin: 90 } }));
    expect(regime(a, "SHY").amount).toBe(125);
    expect(regime(a, "SHY").reduced).toBe(true);
  });
});
