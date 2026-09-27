import { describe, it, expect } from "vitest";
import { buildQueueItems, type QueueSources } from "./queues";
import { applyWork } from "@/store/queueWork";
import type { CouponStatus, Ticket } from "./types";

const NOW = Date.parse("2026-06-18T12:00:00Z");
const H = 3_600_000;

function ticket(tn: string, statuses: CouponStatus[], opts: Partial<Ticket> & { dep?: string } = {}): Ticket {
  return {
    ticketNumber: tn, passenger: { surname: "TEST", givenName: "USER" }, validatingCarrier: "TK",
    issuedAt: opts.issuedAt ?? "2026-06-01T09:00:00Z", formOfPayment: { type: "cash" },
    control: opts.control ?? { holder: "TK", isValidatingCarrier: true },
    coupons: statuses.map((status, i) => ({
      seq: i + 1, status,
      segment: { origin: "IST", destination: "LHR", marketingCarrier: "TK", flightNumber: "TK1", rbd: "Y",
        departure: opts.dep ?? "2026-07-01T08:00:00Z", arrival: opts.dep ?? "2026-07-01T08:00:00Z", fareBasis: "YFLEX", reservationStatus: "HK" },
    })),
    fare: { baseFare: { amount: 1, currency: "TRY" }, totalTfc: { amount: 0, currency: "TRY" }, total: { amount: 1, currency: "TRY" }, tfcs: [] },
    history: [],
  };
}

const empty: QueueSources = { tickets: [], pnrs: [], messages: [], alerts: [] };
const pnr = (rl: string, ttlOffsetH: number) => ({
  recordLocator: rl, passengerName: "DEMIR/CAN", route: "IST → AYT", createdAt: "2026-06-10T10:00:00Z",
  status: "active" as const, segmentCount: 1, ttl: new Date(NOW + ttlOffsetH * H).toISOString(), paxCount: 1, ticketedCount: 0,
});

describe("kuyruklar kayıttan türer", () => {
  it("Q8: süresi dolan ve 48 saat içindeki TTL kuyruğa düşer, uzak olan düşmez", () => {
    const items = buildQueueItems({ ...empty, pnrs: [pnr("AAAAAA", -5), pnr("BBBBBB", 6), pnr("CCCCCC", 100)] }, NOW);
    expect(items.map((i) => i.ref)).toEqual(["AAAAAA", "BBBBBB"]);
    expect(items.every((i) => i.priority === "high")).toBe(true);
  });

  it("IRROP kupon, kontrolü dolmuş partner kuponu ve kalkışı geçmiş açık kupon ayrı kuyruklara düşer", () => {
    const items = buildQueueItems({
      ...empty,
      tickets: [
        ticket("1", ["I"]),
        ticket("2", ["O"], { control: { holder: "LH", isValidatingCarrier: false, deadlineAt: new Date(NOW - H).toISOString() } }),
        ticket("3", ["O"], { dep: "2026-06-10T08:00:00Z" }),
        ticket("4", ["O"]), // gelecekte, sorunsuz
      ],
    }, NOW);
    expect(items.map((i) => `${i.queue}:${i.ref}`).sort()).toEqual(["control:2", "irrop:1", "unused:3"]);
    expect(items.find((i) => i.queue === "control")?.priority).toBe("high");
  });

  it("süresi dolmuş biletin kullanılmamış kuponu 'geçerlilik' kuyruğuna düşer, ayrıca 'kullanılmamış'a düşmez", () => {
    const items = buildQueueItems({ ...empty, tickets: [ticket("5", ["O"], { issuedAt: "2025-05-01T09:00:00Z", dep: "2025-05-10T08:00:00Z" })] }, NOW);
    expect(items).toHaveLength(1);
    expect(items[0].queue).toBe("validity");
    expect(items[0].detail).toMatch(/yalnız iade/);
  });

  it("kayıt düzelince iş kendiliğinden düşer (ayrı bir 'kapat' gerekmez)", () => {
    const t = ticket("6", ["I"]);
    expect(buildQueueItems({ ...empty, tickets: [t] }, NOW)).toHaveLength(1);
    t.coupons[0].status = "E"; // reissue edildi
    expect(buildQueueItems({ ...empty, tickets: [t] }, NOW)).toHaveLength(0);
  });

  it("interline: düşmüş mesaj yüksek, gelen mesaj orta öncelik; iletilmiş olanlar iş değil", () => {
    const m = (id: string, status: "sent" | "acked" | "received" | "failed") => ({
      id, standard: "EDIFACT" as const, messageType: "TKTREQ", direction: "inbound" as const, partnerCarrier: "LH",
      occurredAt: "2026-06-17T10:00:00Z", status, summary: "x", payloadPreview: "",
    });
    const items = buildQueueItems({ ...empty, messages: [m("a", "failed"), m("b", "received"), m("c", "acked")] }, NOW);
    expect(items.map((i) => [i.ref, i.priority])).toEqual([["a", "high"], ["b", "medium"]]);
  });

  it("sıralama: önce öncelik, sonra en yakın son tarih", () => {
    const items = buildQueueItems({ ...empty, pnrs: [pnr("LATERR", 30), pnr("SOONER", 3)] }, NOW);
    expect(items.map((i) => i.ref)).toEqual(["SOONER", "LATERR"]);
  });
});

describe("çalışma durumu", () => {
  it("bitti denen iş çıkar, ertelenen iş süresi boyunca sona gider", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const out = applyWork(items, { done: { a: NOW }, delayed: { b: NOW + H } }, NOW);
    expect(out.map((i) => i.id)).toEqual(["c", "b"]);
    expect(out[1].delayedUntil).toBe(NOW + H);
    // Erteleme süresi dolunca normal sırasına döner.
    expect(applyWork(items, { done: {}, delayed: { b: NOW - 1 } }, NOW).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});
