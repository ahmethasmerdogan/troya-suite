import { describe, it, expect } from "vitest";
import { LocalizedError, errorText } from "./errors";
import { issueTicket, refundTicket, voidTicket, newIdempotencyKey, DomainError, type IssueTicketInput } from "./api";
import { applyTransition, InvalidTransitionError } from "./couponStatusMachine";
import { MemoError } from "./memos";
import { cancelPnr } from "./reservation";

function input(): IssueTicketInput {
  return {
    passenger: { surname: "HATA", givenName: "DIL" },
    validatingCarrier: "TK",
    segments: [
      { origin: "IST", destination: "AMS", marketingCarrier: "TK", flightNumber: "TK1951", rbd: "Y", departure: "2026-07-01T08:00:00Z", arrival: "2026-07-01T10:30:00Z", fareBasis: "YRT", reservationStatus: "HK" },
      { origin: "AMS", destination: "IST", marketingCarrier: "TK", flightNumber: "TK1954", rbd: "Y", departure: "2026-07-10T12:00:00Z", arrival: "2026-07-10T16:00:00Z", fareBasis: "YRT", reservationStatus: "HK" },
    ],
    fare: {
      baseFare: { amount: 10000, currency: "TRY" },
      totalTfc: { amount: 2000, currency: "TRY" },
      total: { amount: 12000, currency: "TRY" },
      tfcs: [{ code: "YQ", amount: { amount: 2000, currency: "TRY" } }],
    },
    formOfPayment: { type: "cash" },
    idempotencyKey: newIdempotencyKey(),
  };
}

/** Komutun fırlattığı hatayı yakala (reddetmezse test düşer). */
async function caught(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error("komut reddedilmedi");
}

/** Türkçe karakter içermeyen, boş olmayan bir İngilizce metin mi? */
const looksEnglish = (s: string | undefined) => !!s && s.trim().length > 0 && !/[çğıöşüÇĞİÖŞÜ]/.test(s);

describe("errorText — hata metni arayüz dilinde", () => {
  it("İngilizce arayüzde İngilizce karşılığı, Türkçede asıl mesajı verir", () => {
    const e = new LocalizedError("Bilet bulunamadı.", "Ticket not found.");
    expect(errorText(e, "en")).toBe("Ticket not found.");
    expect(errorText(e, "tr")).toBe("Bilet bulunamadı.");
    expect(e.message).toBe("Bilet bulunamadı."); // loglar/testler Türkçeyi okumaya devam eder
  });

  it("İngilizce karşılık yoksa Türkçeye düşer; düz Error ve Error olmayan değer de metne çevrilir", () => {
    expect(errorText(new LocalizedError("Yalnız Türkçe"), "en")).toBe("Yalnız Türkçe");
    expect(errorText(new Error("plain"), "en")).toBe("plain");
    expect(errorText("dize", "en")).toBe("dize");
    expect(errorText(42, "tr")).toBe("42");
  });

  it("alan hataları ortak tabandan türer", () => {
    expect(new DomainError("x", "y")).toBeInstanceOf(LocalizedError);
    expect(new MemoError("x", "y")).toBeInstanceOf(LocalizedError);
    expect(new InvalidTransitionError("F", "O")).toBeInstanceOf(LocalizedError);
  });
});

describe("komut hataları İngilizce karşılık taşır", () => {
  it("void — O olmayan kupon varken reddedilir, gerekçe iki dilde", async () => {
    const t = await issueTicket(input());
    await refundTicket({
      ticketNumber: t.ticketNumber, couponSeqs: [1],
      refundAmount: { amount: 5000, currency: "TRY" }, idempotencyKey: newIdempotencyKey(),
    });
    const e = await caught(voidTicket({ ticketNumber: t.ticketNumber, idempotencyKey: newIdempotencyKey() }));
    expect(e).toBeInstanceOf(DomainError);
    const err = e as DomainError;
    expect(err.message).toMatch(/Void için tüm kuponlar 'O' olmalı/);
    expect(looksEnglish(err.en)).toBe(true);
    expect(err.en).toMatch(/Void requires all coupons to be 'O'.*#1\(R\)/);
    expect(errorText(e, "en")).toBe(err.en);
  });

  it("refund — uygun olmayan kupon reddedilir, el kitabı atfı iki dilde de korunur", async () => {
    const t = await issueTicket(input());
    await refundTicket({
      ticketNumber: t.ticketNumber, couponSeqs: [1],
      refundAmount: { amount: 5000, currency: "TRY" }, idempotencyKey: newIdempotencyKey(),
    });
    const e = await caught(refundTicket({
      ticketNumber: t.ticketNumber, couponSeqs: [1],
      refundAmount: { amount: 1, currency: "TRY" }, idempotencyKey: newIdempotencyKey(),
    }));
    const err = e as DomainError;
    expect(err.message).toMatch(/iadeye uygun değil \(R\).*\(1\.3\.5\)/);
    expect(looksEnglish(err.en)).toBe(true);
    expect(err.en).toMatch(/not eligible for refund \(R\).*\(1\.3\.5\)/);
  });

  it("kupon FSM ihlali ve rezervasyon hatası da İngilizce karşılık taşır", async () => {
    let fsm: unknown;
    try {
      applyTransition("F", "O");
    } catch (e) {
      fsm = e;
    }
    expect(looksEnglish((fsm as InvalidTransitionError).en)).toBe(true);

    const pnr = await caught(cancelPnr("ZZZZZZ", "TEST"));
    expect(errorText(pnr, "tr")).toBe("PNR bulunamadı");
    expect(errorText(pnr, "en")).toBe("PNR not found");
  });
});
