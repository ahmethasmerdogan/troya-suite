import { describe, it, expect } from "vitest";
import {
  addRemark, cancelPnr, cancelSegment, createPnr, extendTtl, getAvailability, getPnr, TTL_EXTEND_HOURS,
} from "./reservation";
import { searchFlights } from "./flights";

/** Gişenin PNR komutları — iptal, segment iptali, kesim süresi uzatma, not, geçmiş. */
async function fresh(segments = 2) {
  const dep = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
  return createPnr({
    passengers: [{ surname: "TEST", givenName: "YOLCU", title: "MR" }],
    segments: Array.from({ length: segments }, (_, i) => ({
      origin: i === 0 ? "IST" : "LHR", destination: i === 0 ? "LHR" : "IST", carrier: "TK",
      flightNumber: `TK${1980 + i}`, rbd: "Y", departure: dep(200 + i * 72), arrival: dep(204 + i * 72), status: "HK" as const,
    })),
    by: "Test",
  });
}

describe("PNR komutları", () => {
  it("oluşturma geçmişe yazılır", async () => {
    const p = await fresh();
    expect(p.history?.[0].action).toBe("created");
    expect(p.history?.[0].by).toBe("Test");
  });

  it("segment iptali segmenti XX yapar; son segment iptal edilemez", async () => {
    const p = await fresh(2);
    await cancelSegment(p.recordLocator, 0, "Test");
    const after = await getPnr(p.recordLocator);
    expect(after!.segments[0].status).toBe("XX");
    await expect(cancelSegment(p.recordLocator, 1, "Test")).rejects.toThrow(/Son segment/);
    expect(after!.history!.some((h) => h.action === "segment_cancelled")).toBe(true);
  });

  it("kesim süresi 24 saat uzar, ilk kalkıştan 2 saat öncesini geçemez", async () => {
    const p = await fresh(1);
    const before = Date.parse(p.ttl!);
    const ext = await extendTtl(p.recordLocator, "Test");
    expect(Date.parse(ext.ttl!) - before).toBe(TTL_EXTEND_HOURS * 3_600_000);
    // Kalkışa 3 saat kalan rezervasyon: uzatma kalkış−2 saati aşamaz; sonra hiç uzatılamaz.
    const near = await createPnr({
      passengers: [{ surname: "YAKIN", givenName: "UCUS" }],
      segments: [{ origin: "IST", destination: "ESB", carrier: "TK", flightNumber: "TK2128", rbd: "Y", departure: new Date(Date.now() + 3 * 3_600_000).toISOString(), arrival: new Date(Date.now() + 4 * 3_600_000).toISOString(), status: "HK" }],
    });
    near.ttl = new Date(Date.now() + 30 * 60_000).toISOString();
    const capped = await extendTtl(near.recordLocator, "Test");
    expect(Date.parse(capped.ttl!)).toBeLessThanOrEqual(Date.now() + 1 * 3_600_000 + 1000);
    await expect(extendTtl(near.recordLocator, "Test")).rejects.toThrow(/uzatılamaz/);
  });

  it("not boş olamaz; eklenen not ve geçmiş kaydı görünür", async () => {
    const p = await fresh(1);
    await expect(addRemark(p.recordLocator, "RM", " ", "Test")).rejects.toThrow();
    const r = await addRemark(p.recordLocator, "OSI", "VIP yolcu — karşılama", "Test");
    expect(r.remarks?.[0]).toMatchObject({ kind: "OSI", by: "Test" });
    expect(r.history!.at(-1)!.action).toBe("remark");
  });

  it("biletlenmiş PNR iptal edilemez; biletsiz PNR iptalinde tüm segmentler XX olur", async () => {
    await expect(cancelPnr("XQ7T2M", "Test")).rejects.toThrow(/bilet/);
    const p = await fresh(2);
    const c = await cancelPnr(p.recordLocator, "Test", "Yolcu vazgeçti");
    expect(c.status).toBe("cancelled");
    expect(c.segments.every((s) => s.status === "XX")).toBe(true);
    expect(c.ttl).toBeUndefined();
    await expect(cancelPnr(p.recordLocator, "Test")).rejects.toThrow(/zaten/);
  });
});

describe("uygunluk", () => {
  it("güzergâha özgü seferleri, Bilet Kes'in sefer programıyla aynı numaralarla döndürür", async () => {
    const av = await getAvailability("IST", "LHR", "2026-10-05");
    const sched = searchFlights("IST", "LHR", "2026-10-05", 1);
    expect(av.map((f) => f.flightNumber)).toEqual(sched.map((f) => f.flightNumber));
    expect(av.every((f) => f.origin === "IST" && f.destination === "LHR")).toBe(true);
  });

  it("her sınıfta 0–9 koltuk; fiyatlar pozitif ve kabine göre gruplanabilir", async () => {
    const av = await getAvailability("IST", "FRA", "2026-10-05");
    for (const f of av) {
      for (const c of f.classes) {
        expect(c.available).toBeGreaterThanOrEqual(0);
        expect(c.available).toBeLessThanOrEqual(9);
        expect(c.fareFrom.amount).toBeGreaterThan(0);
      }
      expect(f.classes.some((c) => c.cabin === "Business")).toBe(true);
    }
  });
});
