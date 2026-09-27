import { describe, it, expect } from "vitest";
import {
  raiseMemo, disputeMemo, resolveDispute, billMemo, withdrawMemo, listMemos, billingBlock,
  billingPeriodOf, memoTotals, REVIEW_DAYS, type MemoAmounts,
} from "./memos";
import { MOCK_TICKETS } from "./mockData";
import { newIdempotencyKey } from "./api";

const DAY = 86_400_000;
const agentTicket = (skip = 0) => MOCK_TICKETS.filter((t) => t.agent)[skip + 6];
const directTicket = () => MOCK_TICKETS.find((t) => !t.agent)!;
const amt = (p: Partial<MemoAmounts>): MemoAmounts => ({ fare: 0, tax: 0, commission: 0, adminFee: 0, ...p });
/** Kesim anı: biletin kesiminden kısa süre sonra — 9 ay sınırının içinde. */
const soon = (iso: string, days = 5) => new Date(Date.parse(iso) + days * DAY).toISOString();

describe("ADM/ACM — kesim kuralları", () => {
  it("yalnız acente satışına kesilir", async () => {
    const t = directTicket();
    await expect(raiseMemo({ type: "ADM", ticketNumber: t.ticketNumber, reason: "FARE", amounts: amt({ fare: 100 }), by: "T", idempotencyKey: newIdempotencyKey() }))
      .rejects.toThrow(/acente satışına/);
  });

  it("ADM tutarı kalemlerin toplamı; inceleme süresi 15 gün; aynı gerekçeyle ikinci açık ADM kesilmez", async () => {
    const t = agentTicket(0);
    const at = soon(t.issuedAt);
    const m = await raiseMemo({ type: "ADM", ticketNumber: t.ticketNumber, reason: "FARE", amounts: amt({ fare: 1000, tax: 50, adminFee: 150 }), by: "T", idempotencyKey: newIdempotencyKey(), at });
    expect(m.total.amount).toBe(1200);
    expect(m.total.currency).toBe(t.fare.total.currency);
    expect(Date.parse(m.reviewUntil!) - Date.parse(at)).toBe(REVIEW_DAYS * DAY);
    expect(m.agent.iata).toBe(t.agent!.iata);
    await expect(raiseMemo({ type: "ADM", ticketNumber: t.ticketNumber, reason: "FARE", amounts: amt({ fare: 10 }), by: "T", idempotencyKey: newIdempotencyKey(), at }))
      .rejects.toThrow(/mükerrer/);
  });

  it("aynı anahtarla tekrar = aynı dekont", async () => {
    const t = agentTicket(1);
    const key = newIdempotencyKey();
    const a = await raiseMemo({ type: "ADM", ticketNumber: t.ticketNumber, reason: "TAX", amounts: amt({ tax: 80 }), by: "T", idempotencyKey: key, at: soon(t.issuedAt) });
    const b = await raiseMemo({ type: "ADM", ticketNumber: t.ticketNumber, reason: "TAX", amounts: amt({ tax: 80 }), by: "T", idempotencyKey: key, at: soon(t.issuedAt) });
    expect(b.number).toBe(a.number);
  });

  it("son uçuştan 9 ay sonra ADM kesilmez", async () => {
    const t = agentTicket(2);
    const lastDep = t.coupons.map((c) => c.segment.departure).sort().at(-1)!;
    const late = new Date(Date.parse(lastDep) + 280 * DAY).toISOString();
    await expect(raiseMemo({ type: "ADM", ticketNumber: t.ticketNumber, reason: "COMM", amounts: amt({ commission: 90 }), by: "T", idempotencyKey: newIdempotencyKey(), at: late }))
      .rejects.toThrow(/9 ay/);
  });

  it("ACM'de işlem ücreti olmaz; sıfır tutar ve 'Diğer' açıklamasız reddedilir", async () => {
    const t = agentTicket(3);
    const base = { ticketNumber: t.ticketNumber, by: "T", at: soon(t.issuedAt) };
    await expect(raiseMemo({ ...base, type: "ACM", reason: "COMM_ADJ", amounts: amt({ commission: 50, adminFee: 10 }), idempotencyKey: newIdempotencyKey() })).rejects.toThrow(/işlem ücreti/);
    await expect(raiseMemo({ ...base, type: "ADM", reason: "TTL", amounts: amt({}), idempotencyKey: newIdempotencyKey() })).rejects.toThrow(/sıfırdan büyük/);
    await expect(raiseMemo({ ...base, type: "ADM", reason: "OTHER", amounts: amt({ fare: 5 }), idempotencyKey: newIdempotencyKey() })).rejects.toThrow(/açıklama/);
  });
});

describe("ADM/ACM — yaşam döngüsü", () => {
  it("inceleme süresi dolmadan ADM faturalanmaz; itiraz açıkken de faturalanmaz; ret sonrası faturalanır", async () => {
    const t = agentTicket(4);
    const at = soon(t.issuedAt);
    const m = await raiseMemo({ type: "ADM", ticketNumber: t.ticketNumber, reason: "ABUSE", amounts: amt({ adminFee: 500 }), by: "T", idempotencyKey: newIdempotencyKey(), at });
    const inReview = Date.parse(at) + 3 * DAY;
    expect(billingBlock(m, inReview)).toMatch(/inceleme süresi/);
    await expect(billMemo(m.id, "T", inReview)).rejects.toThrow(/inceleme/);

    await disputeMemo(m.id, "Rezervasyon müşteri talebiyle değişti", inReview);
    await expect(billMemo(m.id, "T", inReview + 20 * DAY)).rejects.toThrow(/İtiraz açık/);
    await expect(disputeMemo(m.id, "ikinci itiraz", inReview)).rejects.toThrow();

    const r = await resolveDispute(m.id, false, "T", "Kayıtlar suistimali gösteriyor");
    expect(r.status).toBe("issued");
    const billed = await billMemo(m.id, "T", inReview + 1 * DAY);
    expect(billed.status).toBe("billed");
    expect(billed.billingPeriod).toBe(billingPeriodOf(new Date(inReview + DAY).toISOString()));
    await expect(withdrawMemo(m.id, "T", "vazgeçildi")).rejects.toThrow(/ACM/);
  });

  it("itiraz kabul edilince ADM geri çekilir; süre dolduktan sonra itiraz alınmaz", async () => {
    const t = agentTicket(5);
    const at = soon(t.issuedAt);
    const a = await raiseMemo({ type: "ADM", ticketNumber: t.ticketNumber, reason: "REFUND", amounts: amt({ fare: 70 }), by: "T", idempotencyKey: newIdempotencyKey(), at });
    await disputeMemo(a.id, "İade doğru hesaplandı", Date.parse(at) + DAY);
    expect((await resolveDispute(a.id, true, "T")).status).toBe("withdrawn");

    const b = await raiseMemo({ type: "ADM", ticketNumber: t.ticketNumber, reason: "TAX", amounts: amt({ tax: 30 }), by: "T", idempotencyKey: newIdempotencyKey(), at });
    await expect(disputeMemo(b.id, "geç itiraz", Date.parse(at) + (REVIEW_DAYS + 1) * DAY)).rejects.toThrow(/süresi doldu/);
  });

  it("ACM'ye itiraz yok; beklemeden faturalanır; toplamlarda net = ADM − ACM", async () => {
    const t = agentTicket(6);
    const c = await raiseMemo({ type: "ACM", ticketNumber: t.ticketNumber, reason: "REFUND_ADJ", amounts: amt({ fare: 200 }), by: "T", idempotencyKey: newIdempotencyKey(), at: soon(t.issuedAt) });
    await expect(disputeMemo(c.id, "neden?")).rejects.toThrow(/ACM/);
    expect((await billMemo(c.id, "T")).status).toBe("billed");
    const totals = memoTotals(await listMemos());
    for (const row of totals) expect(row.net).toBeCloseTo(row.admBilled - row.acmBilled, 2);
  }, 20_000);

  it("BSP dönemi ayı dörde böler", () => {
    expect(billingPeriodOf("2026-10-03T10:00:00Z")).toBe("2026-10 P1");
    expect(billingPeriodOf("2026-10-15T10:00:00Z")).toBe("2026-10 P2");
    expect(billingPeriodOf("2026-10-16T10:00:00Z")).toBe("2026-10 P3");
    expect(billingPeriodOf("2026-10-31T10:00:00Z")).toBe("2026-10 P4");
  });
});
