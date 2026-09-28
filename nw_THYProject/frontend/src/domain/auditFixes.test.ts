import { describe, it, expect } from "vitest";
import {
  issueTicket, issueGroup, refundTicket, refundCancel, voidTicket, exchangeTicket, addEmd, getTicket,
  listEmdsForTicket, takeAirportControl, applyScheduleChange, queryTransactions, newIdempotencyKey,
  DomainError, type IssueTicketInput,
} from "./api";
import { quoteRefund } from "./refundRules";
import { quoteReissue } from "./reissueRules";
import { computeFareOffers, fareForPtc } from "./pricing";
import { convert } from "./fx";
import { computeVat } from "./vat";
import { financialReport } from "./reports";
import { ticketValidity } from "./validity";
import { demoNow } from "./demoClock";
import { cancelPnr, cancelSegment, createPnr, getPnr } from "./reservation";
import { checkinWindow, FLIGHTS } from "./checkin";
import { memoAnchorDate } from "./memos";
import { assessRights } from "./passengerRights";
import { buildQueueItems } from "./queues";
import { checkTravelDocs } from "./travelDocs";
import { cabinOfRbd } from "./co2";
import { fold, foldIncludes } from "./text";
import type { Segment, Ticket } from "./types";

/**
 * Gece denetiminin (2026-09-28) bulduğu hataların gerileme testleri.
 * Her blok bir bulguyu yeniden üretir; düzeltme geri alınırsa kırmızı olur.
 */

const seg = (o: string, d: string, dep: string, rbd = "Y", fareBasis = "YFLEX", fn = "TK1"): Segment => ({
  origin: o, destination: d, marketingCarrier: "TK", flightNumber: fn, rbd, fareBasis,
  departure: dep, arrival: dep, reservationStatus: "HK",
});

function input(opts: {
  key?: string; currency?: string; base?: number; tfc?: number; rbd?: string; fareBasis?: string;
  segments?: Segment[]; pnr?: string; surname?: string; givenName?: string; vat?: boolean;
} = {}): IssueTicketInput {
  const cur = opts.currency ?? "TRY";
  const base = opts.base ?? 10000;
  const tfc = opts.tfc ?? 2000;
  return {
    passenger: { surname: opts.surname ?? "DENETIM", givenName: opts.givenName ?? "TEST" },
    validatingCarrier: "TK",
    pnr: opts.pnr,
    segments: opts.segments ?? [
      seg("IST", "ESB", "2030-07-01T08:00:00Z", opts.rbd, opts.fareBasis, "TK2101"),
      seg("ESB", "IST", "2030-07-10T12:00:00Z", opts.rbd, opts.fareBasis, "TK2102"),
    ],
    fare: {
      baseFare: { amount: base, currency: cur },
      totalTfc: { amount: tfc, currency: cur },
      total: { amount: base + tfc, currency: cur },
      tfcs: [
        { code: "VQ", amount: { amount: tfc * 0.6, currency: cur } },
        { code: "YQ", amount: { amount: tfc * 0.4, currency: cur } },
      ],
      ...(opts.vat === false ? {} : { vat: computeVat(base + tfc * 0.4, true, new Date().toISOString()) }),
    },
    formOfPayment: { type: "cash" },
    idempotencyKey: opts.key ?? newIdempotencyKey(),
  };
}

describe("para: ceza ve tek yön ücret bilet para biriminde", () => {
  it("TRY dosyalanmış ceza EUR bilette kurla çevrilir (iade ve değişiklik)", async () => {
    const t = await issueTicket(input({ currency: "EUR", base: 2000, tfc: 100, rbd: "J", fareBasis: "JCLASSIC", vat: false }));
    const r = quoteRefund({ ticket: t, couponSeqs: [1, 2], refundType: "voluntary" });
    // Ceza tam birime yuvarlanır (computePenalty) — 1.500 TRY ≈ 42,61 EUR → 43.
    expect(Math.abs(r.penalty - convert(1500, "TRY", "EUR")!)).toBeLessThan(1);
    expect(r.penalty).toBeLessThan(100);
    const q = quoteReissue({ ticket: t, newBaseFare: 2000, newTfcs: t.fare.tfcs, newSegments: t.coupons.map((c) => c.segment) });
    expect(q.penalty).toBeLessThan(100);
  });

  it("gönülsüz kısmi iadede tek yön ücret çıplak ücrettir ve bilet para biriminde", async () => {
    const t = await issueTicket(input({ currency: "EUR", base: 600, tfc: 100, vat: false }));
    t.coupons[0].status = "F";
    const r = quoteRefund({ ticket: t, couponSeqs: [2], refundType: "involuntary", reason: "flight_cancellation" });
    expect(r.fareComponent).toBeLessThanOrEqual(600);
  });
});

describe("KDV: iç hat ülkeyle belirlenir", () => {
  it("İstanbul–Antalya–İstanbul gidiş-dönüş iç hattır: VQ ve %20 KDV", () => {
    const offers = computeFareOffers([{ origin: "IST", destination: "AYT" }, { origin: "AYT", destination: "IST" }]);
    expect(offers.every((o) => o.vat.regime === "taxable")).toBe(true);
    expect(offers[0].tfcs.some((x) => x.code === "VQ")).toBe(true);
  });
  it("uçlardan biri yurt dışındaysa istisna (md.14)", () => {
    const offers = computeFareOffers([{ origin: "IST", destination: "LHR" }]);
    expect(offers[0].vat.regime).toBe("exempt");
  });
});

describe("exchange: yalnız açık kupon payı taşınır, kısıtlar ve geçerlilik korunur", () => {
  it("kısmen uçulmuş biletin ad düzeltmesi/eşit reissue'su uçulan payı taşımaz", async () => {
    const t = await issueTicket(input({ base: 24000, tfc: 2000 }));
    t.coupons[0].status = "F";
    t.agent = { iata: "12345675", name: "ACENTE", city: "IST" };
    t.endorsement = "NON-REF";
    const { newTicket } = await exchangeTicket({
      oldTicketNumber: t.ticketNumber, newSegments: [t.coupons[1].segment],
      adc: { amount: 0, currency: "TRY" }, idempotencyKey: newIdempotencyKey(),
    });
    expect(newTicket.fare.baseFare.amount).toBe(12000);
    expect(newTicket.fare.vat?.amount).toBeCloseTo(t.fare.vat!.amount / 2, 1);
    expect(newTicket.agent?.iata).toBe("12345675");
    expect(newTicket.endorsement).toBe("NON-REF");
    // 12.4.1 — yeni bilet orijinalin geçerlilik bitişini taşır.
    expect(newTicket.validityLimit).toBe(ticketValidity(t, demoNow()).until);
  });

  it("değiştirilemez tarife (eco-saver) muafiyetsiz exchange edilemez", async () => {
    const t = await issueTicket(input({ rbd: "V", fareBasis: "VSAVER" }));
    await expect(exchangeTicket({
      oldTicketNumber: t.ticketNumber, newSegments: t.coupons.map((c) => c.segment),
      adc: { amount: 0, currency: "TRY" }, idempotencyKey: newIdempotencyKey(),
    })).rejects.toThrow(/değiştirilemez/);
  });
});

describe("para: EMD-A kademesi ve iade geri alma", () => {
  it("bilet void edilince bağlı EMD-A'nın değeri ters kayıt olarak yazılır", async () => {
    const t = await issueTicket(input());
    await addEmd({ ticketNumber: t.ticketNumber, couponSeq: 1, type: "A", rfisc: "0CC", description: "Bagaj", value: { amount: 500, currency: "TRY" }, idempotencyKey: newIdempotencyKey() });
    await voidTicket({ ticketNumber: t.ticketNumber, idempotencyKey: newIdempotencyKey() });
    const emd = (await listEmdsForTicket(t.ticketNumber)).find((e) => e.type === "A")!;
    expect(emd.coupons[0].status).toBe("V");
    const rows = (await queryTransactions({})).filter((r) => r.ticketNumber === t.ticketNumber && r.type === "EmdVoided");
    expect(rows[0]?.money?.gross).toBe(500);
  });

  it("iade geri alınınca ceza, iade edilen vergi ve KDV de ters çevrilir", async () => {
    const t = await issueTicket(input({ rbd: "J", fareBasis: "JCLASSIC" }));
    const after = await refundTicket({
      ticketNumber: t.ticketNumber, couponSeqs: [1, 2], refundAmount: { amount: 5000, currency: "TRY" },
      refundType: "voluntary", idempotencyKey: newIdempotencyKey(),
    });
    await refundCancel({ ticketNumber: t.ticketNumber, refundId: after.refunds![0].id, idempotencyKey: newIdempotencyKey() });
    const rows = (await queryTransactions({})).filter((r) => r.ticketNumber === t.ticketNumber);
    const fin = financialReport(rows).byCurrency.find((c) => c.currency === "TRY")!;
    expect(fin.penaltyIncome).toBeCloseTo(0, 2);
    expect(fin.taxRefunded).toBeCloseTo(0, 2);
    expect(fin.vatRefunded).toBeCloseTo(0, 2);
  });

  it("voucher iadesi geri alınınca voucher iptal edilir", async () => {
    const t = await issueTicket(input());
    const after = await refundTicket({
      ticketNumber: t.ticketNumber, couponSeqs: [1, 2], refundAmount: { amount: 5000, currency: "TRY" },
      refundType: "voluntary", method: "voucher", idempotencyKey: newIdempotencyKey(),
    });
    await refundCancel({ ticketNumber: t.ticketNumber, refundId: after.refunds![0].id, idempotencyKey: newIdempotencyKey() });
    const voucher = (await listEmdsForTicket(t.ticketNumber)).find((e) => e.coupons[0].rfisc === "99I")!;
    expect(voucher.coupons[0].status).toBe("V");
  });
});

describe("kesim: ücret dökümü ve rezervasyon bağı sunucuda doğrulanır", () => {
  it("eksi ücretle bilet kesilmez", async () => {
    await expect(issueTicket(input({ base: -1200, tfc: 200 }))).rejects.toThrow(DomainError);
  });

  it("grupta çocuk yetişkin ücretiyle kesilmez; sunucunun türettiği ücret beklenir", async () => {
    const adult = input().fare;
    const base = input();
    const req = {
      validatingCarrier: "TK", segments: base.segments, formOfPayment: base.formOfPayment, idempotencyKey: newIdempotencyKey(),
      passengers: [
        { passenger: { surname: "AILE", givenName: "BABA" }, ptc: "ADT" as const, fare: adult },
        { passenger: { surname: "AILE", givenName: "COCUK" }, ptc: "CHD" as const, fare: adult },
      ],
    };
    await expect(issueGroup(req)).rejects.toThrow(/CHD/);
    const ok = await issueGroup({ ...req, idempotencyKey: newIdempotencyKey(), passengers: [req.passengers[0], { ...req.passengers[1], fare: fareForPtc(adult, "CHD") }] });
    expect(ok.tickets).toHaveLength(2);
  });

  it("iptal edilmiş rezervasyona bilet kesilmez", async () => {
    const p = await createPnr({ passengers: [{ surname: "IPTAL", givenName: "YOLCU" }], segments: [{ origin: "IST", destination: "ESB", carrier: "TK", flightNumber: "TK2101", rbd: "Y", departure: "2030-07-01T08:00:00Z", arrival: "2030-07-01T09:10:00Z", status: "HK" }] });
    await cancelPnr(p.recordLocator, "test");
    await expect(issueTicket(input({ pnr: p.recordLocator, surname: "IPTAL", givenName: "YOLCU" }))).rejects.toThrow(/iptal/);
  });

  it("void edilen bilet rezervasyondan düşer, yolcu yeniden biletlenebilir", async () => {
    const p = await createPnr({ passengers: [{ surname: "VOID", givenName: "YOLCU" }], segments: [{ origin: "IST", destination: "ESB", carrier: "TK", flightNumber: "TK2101", rbd: "Y", departure: "2030-07-01T08:00:00Z", arrival: "2030-07-01T09:10:00Z", status: "HK" }] });
    const t = await issueTicket(input({ pnr: p.recordLocator, surname: "VOID", givenName: "YOLCU" }));
    expect((await getPnr(p.recordLocator))!.status).toBe("ticketed");
    await voidTicket({ ticketNumber: t.ticketNumber, idempotencyKey: newIdempotencyKey() });
    const after = (await getPnr(p.recordLocator))!;
    expect(after.status).toBe("active");
    expect(after.ticketNumbers).not.toContain(t.ticketNumber);
    await expect(issueTicket(input({ pnr: p.recordLocator, surname: "VOID", givenName: "YOLCU" }))).resolves.toBeTruthy();
  });

  it("biletli yolcusu olan rezervasyonda segment iptal edilmez", async () => {
    const p = await createPnr({
      passengers: [{ surname: "IKI", givenName: "BIR" }, { surname: "IKI", givenName: "IKI" }],
      segments: [
        { origin: "IST", destination: "ESB", carrier: "TK", flightNumber: "TK2101", rbd: "Y", departure: "2030-07-01T08:00:00Z", arrival: "2030-07-01T09:10:00Z", status: "HK" },
        { origin: "ESB", destination: "IST", carrier: "TK", flightNumber: "TK2102", rbd: "Y", departure: "2030-07-10T12:00:00Z", arrival: "2030-07-10T13:10:00Z", status: "HK" },
      ],
    });
    await issueTicket(input({ pnr: p.recordLocator, surname: "IKI", givenName: "BIR" }));
    await expect(cancelSegment(p.recordLocator, 0, "test")).rejects.toThrow(/bileti kesilmiş/);
  });

  it("yakın uçuşta yeni PNR'ın kesim süresi kalkış − 2 saati geçmez", async () => {
    const dep = new Date(Date.now() + 10 * 3_600_000).toISOString();
    const p = await createPnr({ passengers: [{ surname: "YAKIN", givenName: "UCUS" }], segments: [{ origin: "IST", destination: "ESB", carrier: "TK", flightNumber: "TK2101", rbd: "Y", departure: dep, arrival: dep, status: "HK" }] });
    expect(Date.parse(p.ttl!)).toBeLessThanOrEqual(Date.parse(dep) - 2 * 3_600_000);
  });

  it("aynı kalkış ve varışla PNR oluşturulmaz", async () => {
    await expect(createPnr({ passengers: [{ surname: "HATA", givenName: "X" }], segments: [{ origin: "IST", destination: "IST", carrier: "TK", flightNumber: "ABC", rbd: "Y", departure: "2030-07-01T08:00:00Z", arrival: "2030-07-01T08:00:00Z", status: "HK" }] })).rejects.toThrow();
  });
});

describe("kontrol, check-in penceresi, tarife değişikliği", () => {
  it("kontrol başka taşıyıcıdayken havalimanı kontrolü alınmaz", async () => {
    const t = await issueTicket(input());
    t.control = { holder: "LH", isValidatingCarrier: false };
    expect(await takeAirportControl(t.ticketNumber, 1)).toBe("foreign");
    expect((await getTicket(t.ticketNumber))!.coupons[0].status).toBe("O");
  });

  it("kalkışa 15.4 dk kala kapı henüz kapanmamıştır", () => {
    const f = FLIGHTS.find((x) => x.flightId === "TK21-D")!;
    expect(checkinWindow(f, Date.parse(f.departure) - 15.4 * 60000).state).toBe("late");
  });

  it("aynı anahtarla tekrarlanan tarife değişikliği ilk sonucu döner", async () => {
    const t = await issueTicket(input({ segments: [seg("IST", "ESB", "2030-08-01T08:00:00Z", "Y", "YFLEX", "TK9901")] }));
    const key = newIdempotencyKey();
    const req = { flightNumber: "TK9901", date: "2030-08-01", newDeparture: "2030-08-01T12:00:00Z", idempotencyKey: key };
    const first = await applyScheduleChange(req);
    const again = await applyScheduleChange(req);
    expect(again).toEqual(first);
    expect(first.applied.find((a) => a.ticketNumber === t.ticketNumber)?.severity).not.toBe("minor");
  });
});

describe("kural kenarları", () => {
  it("ADM süresi son uçuşa göre sayılır; geri alınmış iade çapa olmaz", () => {
    const t = {
      coupons: [{ segment: { departure: "2026-06-01T08:00:00Z" } }],
      refunds: [{ at: "2026-01-15T10:00:00Z", cancelledAt: "2026-01-15T11:00:00Z" }],
      history: [], issuedAt: "2025-12-01T00:00:00Z",
    } as unknown as Ticket;
    expect(memoAnchorDate(t)).toBe("2026-06-01T08:00:00Z");
  });

  it("iptalde yemek ve uçağa alınmamada iade seçeneği her zaman vardır", () => {
    const cancel = assessRights({ kind: "cancellation", origin: "IST", destination: "LHR", operatingCarrier: "TK", arrivalDelayMin: 60, noticeDays: 1, extraordinary: false });
    expect(cancel.care.meals).toBe(true);
    const db = assessRights({ kind: "denied_boarding", origin: "IST", destination: "LHR", operatingCarrier: "TK", arrivalDelayMin: 0, extraordinary: false });
    expect(db.care.refundOption).toBe(true);
  });

  it("geçerliliği biten bilet kontrol kuyruğundan da düşmez", () => {
    const now = Date.parse("2026-06-18T12:00:00Z");
    const t = {
      ticketNumber: "2350000000001", passenger: { surname: "Q", givenName: "Q" }, validatingCarrier: "TK",
      issuedAt: "2025-06-20T00:00:00Z", formOfPayment: { type: "cash" },
      control: { holder: "LH", isValidatingCarrier: false, deadlineAt: "2026-06-01T00:00:00Z" },
      coupons: [{ seq: 1, status: "O", segment: seg("IST", "LHR", "2026-06-10T08:00:00Z") }],
      fare: { baseFare: { amount: 1, currency: "TRY" }, totalTfc: { amount: 0, currency: "TRY" }, total: { amount: 1, currency: "TRY" }, tfcs: [] },
      history: [],
    } as unknown as Ticket;
    const items = buildQueueItems({ tickets: [t], pnrs: [], messages: [], alerts: [] }, now);
    expect(items.some((i) => i.queue === "validity")).toBe(true);
    expect(items.some((i) => i.queue === "control")).toBe(true);
  });

  it("ay sonu: 30 Kasım + 3 ay 28 Şubat'tır, 2 Mart değil", () => {
    const r = checkTravelDocs({ nationality: "US", passport: "P1", passportExpiry: "2027-03-01" }, "DE", "TR", "2026-11-30");
    expect(r.verdict).toBe("ok");
  });

  it("P sınıfı Premium kabindir (CO₂ ve satış aynı eşlemeyi kullanır)", () => {
    expect(cabinOfRbd("P")).toBe("Premium");
  });

  it("arama Türkçe harfe duyarsızdır", () => {
    expect(fold("KILIÇ")).toBe("KILIC");
    expect(foldIncludes("MÜLLER/HANS", "muller")).toBe(true);
    expect(foldIncludes("ŞAHİN", "sahin")).toBe(true);
  });
});
