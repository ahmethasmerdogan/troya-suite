import { describe, it, expect } from "vitest";
import { DEMO_NOW, DEMO_SHIFT_MS, shiftFixture, shiftIso } from "./demoClock";
import { generateTickets } from "./genTickets";

const DAY = 86_400_000;

describe("demo saati", () => {
  it("testte kayma yoktur — sabit tarihli testler her gün aynı sonucu verir", () => {
    expect(DEMO_SHIFT_MS).toBe(0);
  });

  it("tam ve yalnız-gün ISO tarihleri biçimi korunarak kayar", () => {
    expect(shiftIso("2026-06-05T01:55:00Z", 3 * DAY)).toBe("2026-06-08T01:55:00Z");
    expect(shiftIso("2026-12-30", 3 * DAY)).toBe("2027-01-02");
    expect(shiftIso("ORD-2026-0001A", 3 * DAY)).toBe("ORD-2026-0001A");
    expect(shiftIso("TK198", 3 * DAY)).toBe("TK198");
  });

  it("fixture ağacı yerinde kayar, 'ttl' gibi şimdiye göre yazılmış alanlara dokunmaz", () => {
    const ttl = new Date().toISOString();
    const f = [{ createdAt: "2026-06-01T10:00:00Z", ttl, segs: [{ departure: "2026-06-02T08:00:00Z" }] }];
    shiftFixture(f, ["ttl"], DAY);
    expect(f[0].createdAt).toBe("2026-06-02T10:00:00Z");
    expect(f[0].segs[0].departure).toBe("2026-06-03T08:00:00Z");
    expect(f[0].ttl).toBe(ttl);
  });
});

describe("üretilen biletler tarihle tutarlı", () => {
  const tickets = generateTickets(30);

  it("hiçbir bilet ileri tarihte kesilmiş görünmez", () => {
    for (const t of tickets) expect(Date.parse(t.issuedAt)).toBeLessThanOrEqual(DEMO_NOW);
  });

  it("uçulmuş / iptal / iade / değişmiş / düzensiz ve no-show kuponlar geçmişte", () => {
    for (const t of tickets) {
      for (const c of t.coupons) {
        if (c.status !== "O" || c.noShow) expect(Date.parse(c.segment.departure)).toBeLessThan(DEMO_NOW);
      }
    }
  });

  it("açık (kullanılmamış) kuponlar gelecekte", () => {
    for (const t of tickets) {
      for (const c of t.coupons) {
        if (c.status === "O" && !c.noShow) expect(Date.parse(c.segment.departure)).toBeGreaterThan(DEMO_NOW);
      }
    }
  });

  it("olaylar kesimden sonra, bugünden önce", () => {
    for (const t of tickets) {
      for (const e of t.history) {
        expect(Date.parse(e.occurredAt)).toBeGreaterThanOrEqual(Date.parse(t.issuedAt));
        expect(Date.parse(e.occurredAt)).toBeLessThanOrEqual(DEMO_NOW);
      }
    }
  });
});
