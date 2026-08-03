// Rapor motoru — event store'dan türeyen üç görünüm.
//
// Tek kaynak: her komut çalışırken olaya yazdığı `EventMoney` dökümü. Rapor
// hiçbir tutarı `detail` metninden ayrıştırmaz, hiçbirini yeniden hesaplamaz;
// yalnız toplar. Event sourcing'in raporlamadaki karşılığı budur.
//
//   1) Satış / işlem  — brüt − iade − iptal = net (para birimi bazında)
//   2) Mali rapor     — ceza, iade edilen/yanan vergi, KDV, ADC/bakiye
//   3) Dönem kapanışı — dönemdeki belgeler, hâlâ geri alınabilir kalemler,
//                       açık kontroller; kapanınca void/refund-cancel düşer.

import type { TransactionRow } from "./api";
import { vatRateAt } from "./vat";

/* -------------------------------------------------------------------- */
/* 1) Satış özeti — para birimi bazında kapanış                          */
/* -------------------------------------------------------------------- */

export interface CurrencyClosing {
  currency: string;
  gross: number;
  refund: number;
  voided: number;
  net: number;
  count: number;
}

export function closingByCurrency(rows: TransactionRow[]): CurrencyClosing[] {
  const m = new Map<string, CurrencyClosing>();
  const bucket = (cur: string) =>
    m.get(cur) ?? { currency: cur, gross: 0, refund: 0, voided: 0, net: 0, count: 0 };

  for (const r of rows) {
    const cur = r.money?.currency ?? r.amount?.currency;
    if (!cur) continue;
    const amt = r.amount?.amount ?? 0;

    if (r.category === "issue" || r.category === "emd") {
      const e = bucket(cur); e.gross += amt; e.count += 1; m.set(cur, e);
    } else if (r.category === "refund") {
      // Refund-Cancel ters kayıt olarak NEGATİF gross taşır → iade toplamı azalır.
      const e = bucket(cur); e.refund += amt; e.count += 1; m.set(cur, e);
    } else if (r.category === "void") {
      const e = bucket(cur); e.voided += amt; e.count += 1; m.set(cur, e);
    } else if (r.category === "exchange") {
      // Exchange'in NAKİT değeri yeni biletin toplamı değil, tahsil edilen ADC'dir.
      // Yeni biletin tamamını brüte yazmak eski biletle çift sayım olurdu.
      const adc = r.money?.adc ?? 0;
      if (adc > 0) { const e = bucket(cur); e.gross += adc; e.count += 1; m.set(cur, e); }
    }
  }
  return [...m.values()]
    .map((e) => ({ ...e, net: round2(e.gross - e.refund - e.voided) }))
    .sort((a, b) => b.gross - a.gross);
}

/* -------------------------------------------------------------------- */
/* 2) Mali rapor — ceza, vergi, KDV                                      */
/* -------------------------------------------------------------------- */

export interface FinancialTotals {
  currency: string;
  /** Tarife kuralı cezaları (iptal + değişiklik). */
  penalty: number;
  /** No-show ücreti — cezadan ayrı raporlanır. */
  noShowFee: number;
  /** 15.1.3.1 service charge + iletişim gideri. */
  serviceCharge: number;
  /** Yolcuya geri verilen vergi/harç. */
  taxRefunded: number;
  /** İade edilemediği için taşıyıcıda kalan vergi/harç. */
  taxForfeited: number;
  /** Reissue ek tahsilatı. */
  adc: number;
  /** Kesilen bakiye belgeleri (MCO / EMD-S). */
  residual: number;
  /** İade türüne göre iade tutarı. */
  refundInvoluntary: number;
  refundVoluntary: number;
  /** Toplamın içindeki KDV (md.20/4) ve matrahı. */
  vatCollected: number;
  vatRefunded: number;
  vatBase: number;
  /** Ceza geliri toplamı — KDV'siz (tazminat niteliğinde). */
  penaltyIncome: number;
}

export interface FinancialReport {
  byCurrency: FinancialTotals[];
  /** KDV oranı bazında kırılım — beyan mantığı. */
  vatByRate: { rate: number; base: number; amount: number; currency: string; count: number }[];
  /** Ceza doğuran işlemler — denetim izi. */
  penaltyRows: TransactionRow[];
  /** Vergisi yanan işlemler. */
  forfeitRows: TransactionRow[];
}

const empty = (currency: string): FinancialTotals => ({
  currency, penalty: 0, noShowFee: 0, serviceCharge: 0, taxRefunded: 0, taxForfeited: 0,
  adc: 0, residual: 0, refundInvoluntary: 0, refundVoluntary: 0,
  vatCollected: 0, vatRefunded: 0, vatBase: 0, penaltyIncome: 0,
});

export function financialReport(rows: TransactionRow[]): FinancialReport {
  const m = new Map<string, FinancialTotals>();
  const vatMap = new Map<string, { rate: number; base: number; amount: number; currency: string; count: number }>();
  const penaltyRows: TransactionRow[] = [];
  const forfeitRows: TransactionRow[] = [];

  for (const r of rows) {
    const mo = r.money;
    if (!mo) continue;
    const e = m.get(mo.currency) ?? empty(mo.currency);

    e.penalty += mo.penalty ?? 0;
    e.noShowFee += mo.noShowFee ?? 0;
    e.serviceCharge += mo.serviceCharge ?? 0;
    e.taxRefunded += mo.taxRefunded ?? 0;
    e.taxForfeited += mo.taxForfeited ?? 0;
    e.adc += mo.adc ?? 0;
    e.residual += mo.residual ?? 0;

    if (r.category === "refund") {
      if (mo.refundType === "involuntary") e.refundInvoluntary += mo.gross ?? 0;
      else e.refundVoluntary += mo.gross ?? 0;
      e.vatRefunded += mo.vat ?? 0;
    } else if (r.category === "issue" || r.category === "emd") {
      e.vatCollected += mo.vat ?? 0;
      e.vatBase += round2((mo.gross ?? 0) - (mo.vat ?? 0));
    } else if (r.category === "void") {
      // İptal edilen satışın KDV'si hiç doğmamıştır — tahsilattan ve matrahtan düşer.
      e.vatCollected -= mo.vat ?? 0;
      e.vatBase -= round2((mo.gross ?? 0) - (mo.vat ?? 0));
    }

    // Ceza taşıyıcı geliridir ve tazminat niteliğinde olduğu için KDV'siz.
    e.penaltyIncome += (mo.penalty ?? 0) + (mo.noShowFee ?? 0) + (mo.serviceCharge ?? 0);

    if (mo.vat != null && mo.vatRate != null &&
        (r.category === "issue" || r.category === "emd" || r.category === "void")) {
      const sign = r.category === "void" ? -1 : 1; // iptal beyanı geri alır
      const key = `${mo.currency}|${mo.vatRate}`;
      const v = vatMap.get(key) ?? { rate: mo.vatRate, base: 0, amount: 0, currency: mo.currency, count: 0 };
      // Matrah = KDV dahil tutardan verginin çıkarılmışı (iç yüzde).
      v.amount += sign * mo.vat;
      v.base += sign * round2((mo.gross ?? 0) - mo.vat);
      v.count += 1;
      vatMap.set(key, v);
    }

    if ((mo.penalty ?? 0) > 0 || (mo.noShowFee ?? 0) > 0) penaltyRows.push(r);
    if ((mo.taxForfeited ?? 0) > 0) forfeitRows.push(r);

    m.set(mo.currency, e);
  }

  const byCurrency = [...m.values()].map(roundTotals)
    .sort((a, b) => (b.penaltyIncome + b.adc) - (a.penaltyIncome + a.adc));

  return {
    byCurrency,
    vatByRate: [...vatMap.values()]
      .map((v) => ({ ...v, base: round2(v.base), amount: round2(v.amount) }))
      .sort((a, b) => b.amount - a.amount),
    penaltyRows,
    forfeitRows,
  };
}

function roundTotals(t: FinancialTotals): FinancialTotals {
  const out = { ...t };
  for (const k of Object.keys(out) as (keyof FinancialTotals)[]) {
    if (typeof out[k] === "number") (out[k] as number) = round2(out[k] as number);
  }
  return out;
}

/* -------------------------------------------------------------------- */
/* 3) Dönem kapanışı                                                     */
/* -------------------------------------------------------------------- */

export interface PeriodSummary {
  periodId: string;
  closed: boolean;
  count: number;
  /** Muhasebeye giren hareket sayısı (kesim + iade + void + değişim).
   *  Yalnız kupon olayı taşıyan gün kapanışa konu değildir. */
  accountable: number;
  /** Kesim / iade / void sayıları. */
  issues: number;
  refunds: number;
  voids: number;
  exchanges: number;
  /** Para birimi bazında net. */
  closing: CurrencyClosing[];
  /** SAC üretmiş (settlement'a gidecek) işlem sayısı. */
  settlementItems: number;
  /** Dönem açıkken hâlâ geri alınabilir kalemler. */
  reversible: { voidable: number; refundCancellable: number };
}

/** Dönemleri (gün) olaylardan türet; en yeni başta. */
export function periodsFrom(rows: TransactionRow[], closedIds: string[]): PeriodSummary[] {
  const closed = new Set(closedIds);
  const m = new Map<string, TransactionRow[]>();
  for (const r of rows) {
    const list = m.get(r.periodId) ?? [];
    list.push(r);
    m.set(r.periodId, list);
  }
  return [...m.entries()]
    .map(([periodId, list]) => summarizePeriod(periodId, list, closed.has(periodId)))
    .sort((a, b) => b.periodId.localeCompare(a.periodId));
}

/**
 * Gerçekten geri alınabilir kalemler.
 *
 * Kategori satırını saymak yanıltıcıydı: zaten void/iade edilmiş bir satış
 * "void edilebilir" görünüyordu. Burada belge bazında bakılır — dönemde
 * kesilmiş ve aynı dönemde void/iade/değişim görmemiş belgeler void
 * edilebilir; geri alınmamış iadeler ise refund-cancel'a açıktır.
 */
function countReversible(rows: TransactionRow[]): { voidable: number; refundCancellable: number } {
  const consumed = new Set(
    rows.filter((r) => r.category === "void" || r.category === "refund" || r.category === "exchange")
      .map((r) => r.ticketNumber),
  );
  const voidable = new Set(
    rows.filter((r) => r.category === "issue" && !consumed.has(r.ticketNumber)).map((r) => r.ticketNumber),
  ).size;
  // Ters kayıt (negatif gross) zaten geri alınmış iadeyi işaretler.
  const refunds = rows.filter((r) => r.category === "refund" && (r.amount?.amount ?? 0) > 0).length;
  const reversed = rows.filter((r) => r.category === "refund" && (r.amount?.amount ?? 0) < 0).length;
  return { voidable, refundCancellable: Math.max(0, refunds - reversed) };
}

export function summarizePeriod(periodId: string, rows: TransactionRow[], closed: boolean): PeriodSummary {
  const issues = rows.filter((r) => r.category === "issue").length;
  const refunds = rows.filter((r) => r.category === "refund").length;
  const voids = rows.filter((r) => r.category === "void").length;
  const exchanges = rows.filter((r) => r.category === "exchange").length;
  // SAC yalnız final statü doğuran işlemlerde üretilir (1.3.6): E, F, P, V, X
  // ve Refund-Cancel. Serbest metinde "SAC" aramak kırılgandı.
  const SETTLING = new Set([
    "TicketVoided", "CouponRefunded", "CouponExchanged", "CouponFlown",
    "CouponPrinted", "CouponPrintExchanged", "RefundCancelled", "EmdVoided", "EmdRefunded",
  ]);
  const settlementItems = rows.filter((r) => SETTLING.has(r.type)).length;
  return {
    periodId,
    closed,
    count: rows.length,
    accountable: issues + refunds + voids + exchanges,
    issues, refunds, voids, exchanges,
    closing: closingByCurrency(rows),
    settlementItems,
    // Dönem kapandığında bu haklar düşer.
    reversible: closed ? { voidable: 0, refundCancellable: 0 } : countReversible(rows),
  };
}

/** Verilen tarihte yürürlükteki KDV oranı — rapor başlığında gösterilir. */
export { vatRateAt };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
