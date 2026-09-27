import { describe, it, expect } from "vitest";
import { ttlState } from "./reservation";

// TTL (Ticketing Time Limit / SSR ADTK) — süresinde biletlenmeyen PNR uyarı → iptal.
describe("ttlState", () => {
  const now = Date.parse("2026-07-06T12:00:00Z");
  it("ticketed/cancelled ya da TTL'siz PNR'da kısıt yok", () => {
    expect(ttlState({ status: "ticketed", ttl: "2026-07-07T12:00:00Z" }, now).kind).toBe("none");
    expect(ttlState({ status: "active" }, now).kind).toBe("none");
  });
  it("24 saatten fazla → ok; 24 saat ve altı → warning; geçmiş → expired", () => {
    expect(ttlState({ status: "active", ttl: "2026-07-09T12:00:00Z" }, now)).toMatchObject({ kind: "ok", hoursLeft: 72 });
    expect(ttlState({ status: "active", ttl: "2026-07-06T18:00:00Z" }, now)).toMatchObject({ kind: "warning", hoursLeft: 6 });
    expect(ttlState({ status: "active", ttl: "2026-07-06T09:00:00Z" }, now)).toMatchObject({ kind: "expired", hoursLeft: 0 });
  });
});
