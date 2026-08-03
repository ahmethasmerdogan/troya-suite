import { describe, it, expect } from "vitest";
import {
  issueTicket, refundTicket, refundCancel, voidTicket, exchangeTicket,
  queryTransactions, newIdempotencyKey, DomainError, type IssueTicketInput,
} from "./api";
import { closingByCurrency, financialReport } from "./reports";
import { computeVat } from "./vat";

/**
 * Para akışının UÇTAN UCA doğrulaması.
 *
 * Birim testler saf fonksiyonları ölçer; burada GERÇEK komut zinciri koşar
 * (issue → refund → refund-cancel → void → exchange) ve rapor motorunun
 * çıktısı ölçülür. Bağımsız denetimin bulduğu para hatalarının hepsi bu
 * yolla üretilebiliyordu — bu dosya onların geri gelmesini engeller.
 */

function input(key: string, opts: { base?: number; tfc?: number; domestic?: boolean } = {}): IssueTicketInput {
  const base = opts.base ?? 10000;
  const tfc = opts.tfc ?? 2000;
  const domestic = opts.domestic ?? true;
  return {
    passenger: { surname: "AKIS", givenName: "TEST" },
    validatingCarrier: "TK",
    segments: [
      { origin: "IST", destination: "ESB", marketingCarrier: "TK", flightNumber: "TK2101", rbd: "Y", departure: "2030-07-01T08:00:00Z", arrival: "2030-07-01T09:10:00Z", fareBasis: "YFLEX", reservationStatus: "HK" },
      { origin: "ESB", destination: "IST", marketingCarrier: "TK", flightNumber: "TK2102", rbd: "Y", departure: "2030-07-10T12:00:00Z", arrival: "2030-07-10T13:10:00Z", fareBasis: "YFLEX", reservationStatus: "HK" },
    ],
    fare: {
      baseFare: { amount: base, currency: "TRY" },
      totalTfc: { amount: tfc, currency: "TRY" },
      total: { amount: base + tfc, currency: "TRY" },
      tfcs: [
        { code: "VQ", amount: { amount: tfc * 0.6, currency: "TRY" } },
        { code: "YQ", amount: { amount: tfc * 0.4, currency: "TRY" } },
      ],
      vat: computeVat(base + tfc * 0.4, domestic, new Date().toISOString()),
    },
    formOfPayment: { type: "cash" },
    idempotencyKey: key,
  };
}

/** Belirli bir bilete ait rapor satırları. */
async function rowsOf(ticketNumber: string) {
  const all = await queryTransactions({});
  return all.filter((r) => r.ticketNumber === ticketNumber);
}

describe("uçtan uca — kısmi iade değeri iki kez vermez", () => {
  it("iki kuponlu biletin bir kuponu iade edilince ücretin TAMAMI ödenmez", async () => {
    const t = await issueTicket(input(newIdempotencyKey()));
    const after = await refundTicket({
      ticketNumber: t.ticketNumber, couponSeqs: [1],
      refundAmount: { amount: 0, currency: "TRY" }, // tutarı sistem yazacak
      refundType: "voluntary", idempotencyKey: newIdempotencyKey(),
    });
    const rec = after.refunds![0];
    expect(after.coupons[0].status).toBe("R");
    expect(after.coupons[1].status).toBe("O");
    // Sistemin hesabı olaya yazıldı ve tam ücretin ALTINDA.
    const ev = after.history.find((h) => h.type === "CouponRefunded" && h.money);
    expect(ev?.money?.quotedGross).toBeGreaterThan(0);
    expect(ev?.money?.quotedGross).toBeLessThan(10000);
    expect(rec.couponSeqs).toEqual([1]);
  });

  it("kalan kupon da iade edilince toplam iade ödenen ücreti AŞMAZ", async () => {
    const t = await issueTicket(input(newIdempotencyKey()));
    await refundTicket({
      ticketNumber: t.ticketNumber, couponSeqs: [1],
      refundAmount: { amount: 0, currency: "TRY" }, refundType: "voluntary",
      idempotencyKey: newIdempotencyKey(),
    });
    const after = await refundTicket({
      ticketNumber: t.ticketNumber, couponSeqs: [2],
      refundAmount: { amount: 0, currency: "TRY" }, refundType: "voluntary",
      idempotencyKey: newIdempotencyKey(),
    });
    const quoted = after.history
      .filter((h) => h.type === "CouponRefunded" && h.money?.quotedGross != null)
      .reduce((sum, h) => sum + (h.money!.quotedGross ?? 0), 0);
    // İki kısmi iadenin toplamı biletin toplamını aşamaz.
    expect(quoted).toBeLessThanOrEqual(t.fare.total.amount);
  });
});

describe("uçtan uca — KDV", () => {
  it("void edilen satışın KDV'si net KDV'yi sıfırlar", async () => {
    const t = await issueTicket(input(newIdempotencyKey()));
    expect(t.fare.vat?.regime).toBe("taxable");
    await voidTicket({ ticketNumber: t.ticketNumber, idempotencyKey: newIdempotencyKey() });

    const fin = financialReport(await rowsOf(t.ticketNumber));
    const tot = fin.byCurrency.find((x) => x.currency === "TRY")!;
    expect(tot.vatCollected).toBe(0);
    expect(tot.vatBase).toBe(0);
  });

  it("kısmi iadede KDV, iade edilen ücretle orantılıdır — tahsil edileni aşmaz", async () => {
    const t = await issueTicket(input(newIdempotencyKey()));
    await refundTicket({
      ticketNumber: t.ticketNumber, couponSeqs: [1],
      refundAmount: { amount: 0, currency: "TRY" }, refundType: "voluntary",
      idempotencyKey: newIdempotencyKey(),
    });
    const fin = financialReport(await rowsOf(t.ticketNumber));
    const tot = fin.byCurrency.find((x) => x.currency === "TRY")!;
    expect(tot.vatRefunded).toBeGreaterThan(0);
    expect(tot.vatRefunded).toBeLessThan(tot.vatCollected);
  });
});

describe("uçtan uca — Refund-Cancel ters kaydı", () => {
  it("geri alınan iade dönem netini eski hâline döndürür", async () => {
    const t = await issueTicket(input(newIdempotencyKey()));
    const refunded = await refundTicket({
      ticketNumber: t.ticketNumber, couponSeqs: [1],
      refundAmount: { amount: 4000, currency: "TRY" }, refundType: "voluntary",
      idempotencyKey: newIdempotencyKey(),
    });
    const beforeCancel = closingByCurrency(await rowsOf(t.ticketNumber));
    expect(beforeCancel[0].refund).toBe(4000);

    await refundCancel({
      ticketNumber: t.ticketNumber, refundId: refunded.refunds![0].id,
      idempotencyKey: newIdempotencyKey(),
    });
    const afterCancel = closingByCurrency(await rowsOf(t.ticketNumber));
    // Ters kayıt iadeyi sıfırlar; net yeniden satış tutarına döner.
    expect(afterCancel[0].refund).toBe(0);
    expect(afterCancel[0].net).toBe(t.fare.total.amount);
  });
});

describe("uçtan uca — void ve dönem kuralları", () => {
  it("void, satış gününde yapılabilir ve net satışı sıfırlar", async () => {
    const t = await issueTicket(input(newIdempotencyKey()));
    await voidTicket({ ticketNumber: t.ticketNumber, idempotencyKey: newIdempotencyKey() });
    const closing = closingByCurrency(await rowsOf(t.ticketNumber));
    expect(closing[0].net).toBe(0);
  });

  it("geçmiş dönemde kesilmiş bilet void edilemez (satış günü kuralı)", async () => {
    // Mock bilet 2351234567890 geçmişte kesilmiş.
    await expect(
      voidTicket({ ticketNumber: "2351234567890", idempotencyKey: newIdempotencyKey() }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe("uçtan uca — exchange nakit değeri", () => {
  it("brüte yeni biletin tamamı değil, tahsil edilen ADC girer", async () => {
    const t = await issueTicket(input(newIdempotencyKey()));
    const { newTicket } = await exchangeTicket({
      oldTicketNumber: t.ticketNumber,
      newSegments: t.coupons.map((c) => ({ ...c.segment, destination: "AYT" })),
      adc: { amount: 0, currency: "TRY" },
      newBaseFare: 12000, // eski 10000 → 2000 fark
      newTfcs: t.fare.tfcs,
      idempotencyKey: newIdempotencyKey(),
    });
    const rows = (await queryTransactions({})).filter((r) => r.ticketNumber === newTicket.ticketNumber);
    const ex = rows.find((r) => r.category === "exchange" && r.money?.adc != null);
    expect(ex?.money?.adc).toBe(2000);
    const closing = closingByCurrency(rows);
    // Yeni biletin toplamı (14.000+) değil, yalnız ADC brüte girer.
    expect(closing[0].gross).toBe(2000);
  });
});
