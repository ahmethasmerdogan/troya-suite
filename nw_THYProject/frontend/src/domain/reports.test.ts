import { describe, it, expect } from "vitest";
import { closingByCurrency, financialReport, periodsFrom, summarizePeriod } from "./reports";
import type { TransactionRow } from "./api";

// Rapor motoru yalnız TOPLAR — hiçbir tutarı metinden ayrıştırmaz, hiçbirini
// yeniden hesaplamaz. Kaynak: komutların olaya yazdığı `money` dökümü.

const row = (p: Partial<TransactionRow> & { category: TransactionRow["category"] }): TransactionRow => ({
  id: Math.random().toString(36).slice(2),
  ticketNumber: "2351234567890",
  passengerName: "TEST/USER",
  type: "TicketIssued",
  occurredAt: "2026-08-03T10:00:00Z",
  actor: "TK / IST",
  carrier: "TK",
  periodId: "2026-08-03",
  ...p,
});

describe("satış kapanışı — para birimi bazında", () => {
  it("brüt − iade − void = net", () => {
    const rows = [
      row({ category: "issue", amount: { amount: 10000, currency: "TRY" } }),
      row({ category: "emd", amount: { amount: 1000, currency: "TRY" } }),
      row({ category: "refund", amount: { amount: 3000, currency: "TRY" } }),
      row({ category: "void", amount: { amount: 2000, currency: "TRY" } }),
    ];
    const [c] = closingByCurrency(rows);
    expect(c.gross).toBe(11000);
    expect(c.refund).toBe(3000);
    expect(c.voided).toBe(2000);
    expect(c.net).toBe(6000);
  });

  it("para birimleri ayrı satırlarda toplanır", () => {
    const rows = [
      row({ category: "issue", amount: { amount: 100, currency: "TRY" } }),
      row({ category: "issue", amount: { amount: 50, currency: "USD" } }),
    ];
    expect(closingByCurrency(rows)).toHaveLength(2);
  });
});

describe("mali rapor — ceza, vergi, KDV", () => {
  const rows = [
    row({
      category: "issue", amount: { amount: 12000, currency: "TRY" },
      money: { currency: "TRY", gross: 12000, vat: 2000, vatRate: 0.2 },
    }),
    row({
      category: "refund", amount: { amount: 6000, currency: "TRY" },
      money: {
        currency: "TRY", gross: 6000, penalty: 1500, noShowFee: 500, serviceCharge: 200,
        taxRefunded: 800, taxForfeited: 300, refundType: "voluntary", vat: 1000, vatRate: 0.2,
      },
    }),
    row({
      category: "refund", amount: { amount: 4000, currency: "TRY" },
      money: { currency: "TRY", gross: 4000, taxRefunded: 400, refundType: "involuntary" },
    }),
    row({
      category: "exchange", amount: { amount: 15000, currency: "TRY" },
      money: { currency: "TRY", gross: 15000, adc: 2500, penalty: 750, residual: 0 },
    }),
  ];

  it("ceza, no-show ve service charge ayrı kalemlerde toplanır", () => {
    const [t] = financialReport(rows).byCurrency;
    expect(t.penalty).toBe(2250); // 1500 + 750
    expect(t.noShowFee).toBe(500);
    expect(t.serviceCharge).toBe(200);
    expect(t.penaltyIncome).toBe(2950);
  });

  it("iade edilen ve yanan vergi ayrı raporlanır", () => {
    const [t] = financialReport(rows).byCurrency;
    expect(t.taxRefunded).toBe(1200); // 800 + 400
    expect(t.taxForfeited).toBe(300);
  });

  it("iade türü kırılımı korunur", () => {
    const [t] = financialReport(rows).byCurrency;
    expect(t.refundVoluntary).toBe(6000);
    expect(t.refundInvoluntary).toBe(4000);
  });

  it("KDV tahsil ve iade ayrı; net KDV ikisinin farkı", () => {
    const [t] = financialReport(rows).byCurrency;
    expect(t.vatCollected).toBe(2000); // yalnız kesim/EMD
    expect(t.vatRefunded).toBe(1000);
    expect(t.vatCollected - t.vatRefunded).toBe(1000);
  });

  it("KDV oran kırılımında matrah, KDV DAHİL tutardan ayrıştırılır", () => {
    const r = financialReport(rows);
    const v = r.vatByRate.find((x) => x.rate === 0.2)!;
    expect(v.amount).toBe(2000);
    expect(v.base).toBe(10000); // 12000 dahil tutar − 2000 KDV
    expect(v.count).toBe(1);
  });

  it("ADC ve bakiye toplanır", () => {
    const [t] = financialReport(rows).byCurrency;
    expect(t.adc).toBe(2500);
    expect(t.residual).toBe(0);
  });

  it("ceza ve yanan vergi satırları denetim izi olarak ayrılır", () => {
    const r = financialReport(rows);
    expect(r.penaltyRows).toHaveLength(2); // iade + exchange
    expect(r.forfeitRows).toHaveLength(1);
  });

  it("parasal dökümü olmayan satır rapora girmez", () => {
    const r = financialReport([row({ category: "checkin" })]);
    expect(r.byCurrency).toHaveLength(0);
  });
});

describe("dönem kapanışı", () => {
  const rows = [
    row({ category: "issue", periodId: "2026-08-03", amount: { amount: 10000, currency: "TRY" } }),
    row({ category: "refund", periodId: "2026-08-03", amount: { amount: 2000, currency: "TRY" } }),
    row({ category: "issue", periodId: "2026-08-02", amount: { amount: 5000, currency: "TRY" } }),
  ];

  it("dönemler olaylardan türetilir, en yeni başta", () => {
    const ps = periodsFrom(rows, []);
    expect(ps.map((p) => p.periodId)).toEqual(["2026-08-03", "2026-08-02"]);
    expect(ps[0].count).toBe(2);
  });

  it("dönem AÇIKKEN void ve iade geri alma hakkı vardır", () => {
    const p = summarizePeriod("2026-08-03", rows.filter((r) => r.periodId === "2026-08-03"), false);
    expect(p.closed).toBe(false);
    expect(p.reversible.voidable).toBe(1);
    expect(p.reversible.refundCancellable).toBe(1);
  });

  it("dönem KAPANINCA geri alma hakları düşer", () => {
    const p = summarizePeriod("2026-08-03", rows.filter((r) => r.periodId === "2026-08-03"), true);
    expect(p.closed).toBe(true);
    expect(p.reversible.voidable).toBe(0);
    expect(p.reversible.refundCancellable).toBe(0);
  });

  it("kapatılmış dönem listesi doğru işaretlenir", () => {
    const ps = periodsFrom(rows, ["2026-08-02"]);
    expect(ps.find((p) => p.periodId === "2026-08-02")!.closed).toBe(true);
    expect(ps.find((p) => p.periodId === "2026-08-03")!.closed).toBe(false);
  });
});
