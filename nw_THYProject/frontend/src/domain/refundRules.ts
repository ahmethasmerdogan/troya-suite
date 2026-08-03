// İade değerleme kuralları — IATA Ticketing Handbook 15.1 + tarife kuralı (ATPCO Cat 33).
//
// Personel iade tutarını ELLE YAZMAZ: türü ve sebebi seçer, sistem hesaplar.
//
// Handbook birebir:
//  15.1.1.1  Involuntary = taşımanın reddi (iptal, tarife değişikliği, over/under
//            carriage, offload, misconnection, güvenlik/hukuk, yolcunun hâli).
//  15.1.1.2  Voluntary   = bunun dışındaki her iade.
//  15.1.2    Involuntary: (a) hiç kullanılmamışsa ödenen ücret; (b) kısmen
//            kullanılmışsa — kullanılmayan taşımanın tek yön ücreti (RT/CT'de
//            yarısı) İLE ödenen ücret − kullanılan taşımanın ücreti farkından
//            YÜKSEK OLANI.
//  15.1.3.1  Voluntary: (a) hiç kullanılmamışsa tam ücret − service charge −
//            communication expenses; (b) kısmen kullanılmışsa fark − aynı kesintiler.
//  15.1.6    Değerleme: taşımanın başladığı ülkenin para biriminde; ödeme başka
//            para birimindeyse ödeme günü kuru, değilse iade günü banka kuru.
//
// Handbook'un YAZMADIĞI ama işin merkezinde olan iki şey tarife kuralından gelir:
//
//  1) CEZA. Handbook ceza tanımlamaz. İptal/değişiklik/no-show ücretleri
//     ATPCO Cat 33/31'de filed edilir (bkz. domain/fareRules.ts). Ceza YALNIZ
//     ÜCRETE uygulanır — devlet vergilerinden ceza kesilmez.
//  2) VERGİNİN İADE EDİLEBİLİRLİĞİ. Kalem bazındadır (bkz. domain/taxCodes.ts):
//     olaya bağlı harçlar uçulmadıysa iade edilir (bilet iade edilemez olsa bile),
//     ödenen tutara bağlı vergiler ve taşıyıcı ek ücretleri ücretin kuralını izler.
//
// SADELEŞTİRME (mock): kupon başına ücret dağılımı doğrusaldır (fare construction
// motoru kapsam dışı). Kullanılmayan bölümün tek yön ücreti gerçek tarife
// motorundan (pricing.ts) sorulur; böylece 15.1.2(b)'nin iki yolu farklı sonuç
// verir ve "yüksek olanı" kuralının anlamı korunur.

import type { CouponStatus, Money, TaxFeeCharge, Ticket } from "./types";
import { airportByCode } from "./airports";
import { cheapestTotal } from "./pricing";
import { convert } from "./fx";
import { isTfcRefundable, tfcRefundReason } from "./taxCodes";
import {
  computePenalty, fareRuleFor, isFareRefundable, waives,
  type FareRule, type WaiverCode,
} from "./fareRules";
import { fareTypeByCoupon } from "./fareTypes";

export type RefundType = "involuntary" | "voluntary";

/** 15.1.1.1 — taşımanın reddedilme sebepleri. Başka sebep involuntary değildir. */
export type InvoluntaryReason =
  | "flight_cancellation"
  | "schedule_change"
  | "over_under_carriage"
  | "offloading"
  | "misconnection"
  | "safety_legal"
  | "pax_condition_conduct";

export const INVOLUNTARY_REASON_LABEL: Record<InvoluntaryReason, string> = {
  flight_cancellation: "Uçuş iptali",
  schedule_change: "Tarife değişikliği",
  over_under_carriage: "Over/under carriage",
  offloading: "Offload (uçuştan indirme)",
  misconnection: "Bağlantı kaçırma (misconnection)",
  safety_legal: "Güvenlik / hukuki sebep",
  pax_condition_conduct: "Yolcunun hâli veya davranışı",
};

/** 15.1.2(c): güvenlik/hukuk ve yolcu davranışı kaynaklı iptalde masraf üstlenimi reddedilebilir. */
export const REASON_ALLOWS_CHARGES: Record<InvoluntaryReason, boolean> = {
  flight_cancellation: false,
  schedule_change: false,
  over_under_carriage: false,
  offloading: false,
  misconnection: false,
  safety_legal: true,
  pax_condition_conduct: true,
};

/** Kullanılmış sayılan kupon statüleri — taşıma fiilen başlamış/tamamlanmış. */
const USED: CouponStatus[] = ["F", "L", "C"];

export function couponUsed(status: CouponStatus): boolean {
  return USED.includes(status);
}

export function travelCommenced(ticket: Ticket): boolean {
  return ticket.coupons.some((c) => couponUsed(c.status));
}

export function isRoundOrCircleTrip(ticket: Ticket): boolean {
  const cs = ticket.coupons;
  if (cs.length < 2) return false;
  return cs[0].segment.origin === cs[cs.length - 1].segment.destination;
}

/** 15.1.6(a) — taşımanın başladığı ülkenin para birimi. Bilinmiyorsa biletin para birimi. */
const COUNTRY_CURRENCY: Record<string, string> = {
  TR: "TRY", US: "USD", GB: "GBP", CH: "CHF", JP: "JPY", AE: "AED", SA: "SAR",
  QA: "QAR", KW: "KWD", RU: "RUB", CN: "CNY",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", AT: "EUR", BE: "EUR",
  GR: "EUR", PT: "EUR", IE: "EUR", FI: "EUR",
};

export function commencementCurrency(ticket: Ticket): string {
  const origin = ticket.coupons[0]?.segment.origin;
  const cc = airportByCode(origin)?.countryCode;
  return (cc && COUNTRY_CURRENCY[cc]) || ticket.fare.total.currency;
}

/** Biletin tarife kuralı — ilk kuponun fare basis'inden türetilir. */
export function ruleOfTicket(ticket: Ticket): FareRule | undefined {
  const c = ticket.coupons[0];
  const ft = fareTypeByCoupon(c?.segment.rbd, c?.segment.fareBasis);
  return fareRuleFor(ft?.id);
}

/** Kalkış geçti mi? (ceza kalkıştan önce/sonra farklı olabilir) */
function afterDeparture(ticket: Ticket, seqs: number[]): boolean {
  const sel = ticket.coupons.filter((c) => seqs.includes(c.seq));
  const first = sel[0] ?? ticket.coupons[0];
  return !!first && new Date(first.segment.departure).getTime() < Date.now();
}

/** Vergi kaleminin ait olduğu kupon — kalemde yoksa doğrusal dağıtım varsayılır. */
export interface TfcLine {
  code: string;
  amount: number;
  refundable: boolean;
  reason: string;
  couponSeq?: number;
}

export interface RefundQuoteInput {
  ticket: Ticket;
  /** İade edilecek (kullanılmayan) kupon sıraları. */
  couponSeqs: number[];
  refundType: RefundType;
  reason?: InvoluntaryReason;
  /** 15.1.3.1 — voluntary'de düşülen kesintiler (taşıyıcı tarifesi). */
  serviceCharge?: number;
  communicationExpenses?: number;
  /** Yalnız vergi/harç iadesi (1.3.5 / Y statüsü). */
  taxOnly?: boolean;
  /** Vefat/hastalık vb. muafiyet — kural izin veriyorsa cezayı kaldırır. */
  waiver?: WaiverCode;
}

export interface RefundQuote {
  amount: Money;
  assessmentCurrency: string;
  rateType: "original" | "bank" | "none";
  rate?: number;
  fareComponent: number;
  tfcComponent: number;
  /** Tarife kuralından gelen ceza (yalnız ücrete uygulanır). */
  penalty: number;
  penaltyExplain?: string;
  penaltyWaived?: WaiverCode;
  /** No-show ücreti — ayrı bir kalem (iptal cezasından farklıdır). */
  noShowFee: number;
  /** 15.1.3.1 service charge + iletişim gideri. */
  deductions: number;
  /** Vergi kalemleri — hangisi neden iade edildi/edilmedi. */
  tfcLines: TfcLine[];
  /** Ücretin kendisi iade edilebilir mi (tarife kuralı). */
  fareRefundable: boolean;
  method:
    | "involuntary_unused" | "involuntary_partial"
    | "voluntary_unused" | "voluntary_partial"
    | "tax_only" | "non_refundable_taxes_only";
  alternatives?: { label: string; amount: number; chosen: boolean }[];
  notes: string[];
  /** Kesintiler iadeyi aştı → net sıfır. */
  clampedToZero: boolean;
}

export function quoteRefund(input: RefundQuoteInput): RefundQuote {
  const { ticket, couponSeqs, refundType } = input;
  const notes: string[] = [];
  const ticketCurrency = ticket.fare.total.currency;
  const n = ticket.coupons.length || 1;

  const rule = ruleOfTicket(ticket);
  const fareRefundable = isFareRefundable(rule);
  const selected = ticket.coupons.filter((c) => couponSeqs.includes(c.seq));
  const usedCoupons = ticket.coupons.filter((c) => couponUsed(c.status));
  const partial = usedCoupons.length > 0;

  const base = ticket.fare.baseFare.amount;
  const perCoupon = base / n;
  const unusedShare = perCoupon * selected.length;

  // ---------------------------------------------------------------
  // 1) VERGİ — kalem kalem. Toplu oran YOK.
  // ---------------------------------------------------------------
  const taxIndicatorBlocks = rule?.refund?.taxIndicator === "X";
  const tfcLines: TfcLine[] = expandTfcs(ticket.fare.tfcs, ticket, couponSeqs).map((line) => {
    const coupon = ticket.coupons.find((c) => c.seq === line.couponSeq);
    const flown = coupon ? couponUsed(coupon.status) : false;
    // Seçilmemiş kupona ait kalem iade edilmez (o kupon duruyor).
    const selectedLine = line.couponSeq == null || couponSeqs.includes(line.couponSeq);
    let refundable = selectedLine && isTfcRefundable(line.code, flown, fareRefundable);
    let reason = selectedLine
      ? tfcRefundReason(line.code, flown, fareRefundable)
      : "Bu kupon iade edilmiyor.";
    // Cat 33 vergi göstergesi "X": iade edilemez üründe vergiler de bilette kalır.
    if (taxIndicatorBlocks && !fareRefundable) {
      refundable = false;
      reason = "Tarife kuralı gereği vergiler de iade edilmez (Cat 33 vergi göstergesi X).";
    }
    return { ...line, refundable, reason };
  });
  const refundableTax = tfcLines.filter((l) => l.refundable).reduce((s, l) => s + l.amount, 0);

  // ---------------------------------------------------------------
  // 2) ÜCRET
  // ---------------------------------------------------------------
  let fareComponent = 0;
  let method: RefundQuote["method"];
  let alternatives: RefundQuote["alternatives"];

  if (input.taxOnly) {
    method = "tax_only";
    notes.push("Yalnız vergi/harç iadesi (Y) — çıplak ücret iade edilmez.");
    notes.push("Bu işlemden sonra biletin kalan değeri kullanılamaz; yolcuya bildirin.");
  } else if (!fareRefundable && refundType === "voluntary") {
    // İade edilemez ürün: ücret yanar, yalnız iade edilebilir vergiler geri verilir.
    method = "non_refundable_taxes_only";
    notes.push("Tarife kuralı iadeye izin vermiyor — çıplak ücret iade edilmez.");
    notes.push("Olaya bağlı devlet harçları (kalkış/servis) yine de iade edilir.");
  } else if (refundType === "involuntary") {
    if (!partial) {
      method = "involuntary_unused";
      fareComponent = base;
      notes.push("15.1.2(a): biletin hiçbir bölümü kullanılmamış — ödenen ücretin tamamı iade edilir.");
    } else {
      method = "involuntary_partial";
      const owFare = oneWayFareOfUnused(ticket, selected.map((c) => c.seq));
      const halfRule = isRoundOrCircleTrip(ticket);
      const routeValue = owFare != null ? (halfRule ? owFare / 2 : owFare) : unusedShare;
      const usedFare = perCoupon * usedCoupons.length;
      const difference = base - usedFare;
      const a = round2(routeValue);
      const b = round2(difference);
      fareComponent = Math.max(a, b);
      alternatives = [
        { label: halfRule ? "Kullanılmayan taşımanın tek yön ücreti (RT/CT → yarısı)" : "Kullanılmayan taşımanın tek yön ücreti", amount: a, chosen: a >= b },
        { label: "Ödenen ücret − kullanılan taşımanın ücreti", amount: b, chosen: b > a },
      ];
      notes.push("15.1.2(b): iki hesaptan YÜKSEK olanı önerilir.");
      if (owFare == null) notes.push("Tek yön ücreti tarifeden alınamadı — kupon payı kullanıldı.");
    }
    notes.push(
      input.reason && REASON_ALLOWS_CHARGES[input.reason]
        ? "15.1.2(c): güvenlik/hukuki sebep veya yolcunun hâli/davranışı — masraf üstlenimi reddedilebilir."
        : "15.1.2(c): masraflar taşıyıcıya aittir; iptal cezası uygulanmaz.",
    );
  } else if (!partial) {
    method = "voluntary_unused";
    fareComponent = base;
    notes.push("15.1.3.1(a): hiç kullanılmamış — tam ücret, kesintiler düşülerek.");
  } else {
    method = "voluntary_partial";
    const usedFare = perCoupon * usedCoupons.length;
    fareComponent = Math.max(0, base - usedFare);
    notes.push("15.1.3.1(b): ödenen ücret ile kullanılan taşımanın ücreti arasındaki fark.");
  }

  // ---------------------------------------------------------------
  // 3) CEZA (tarife kuralı) — yalnız ücrete uygulanır, vergiden kesilmez.
  // ---------------------------------------------------------------
  let penalty = 0;
  let penaltyExplain: string | undefined;
  let penaltyWaived: WaiverCode | undefined;
  let noShowFee = 0;

  const noShow = selected.some((c) => c.noShow);
  // Muafiyet, kuralın izin verdiği hâllerde TÜM taşıyıcı kesintilerini kaldırır:
  // ceza, no-show ücreti ve 15.1.3.1 service charge / iletişim gideri.
  const waiverApplies = waives(rule, input.waiver);
  if (waiverApplies) {
    penaltyWaived = input.waiver;
    notes.push(`Muafiyet (${input.waiver}) — tarife kuralı bu hâlde ceza ve kesintileri kaldırıyor.`);
  }

  if (refundType === "voluntary" && !input.taxOnly && !waiverApplies) {
    const after = afterDeparture(ticket, couponSeqs);
    const p = computePenalty(
      after ? rule?.refund?.afterDeparture ?? rule?.refund?.beforeDeparture : rule?.refund?.beforeDeparture,
      base,
      selected.length,
    );
    if (p) {
      penalty = p.amount;
      penaltyExplain = `${after ? "Kalkıştan sonra" : "Kalkıştan önce"} iade cezası — ${p.explain}`;
    }
  }
  if (noShow && refundType === "voluntary" && !waiverApplies) {
    const ns = computePenalty(rule?.refund?.noShow, base, 1);
    if (ns) {
      noShowFee = ns.amount;
      notes.push("No-show ücreti ayrı bir kalemdir; iptal cezasına EKLENİR.");
    }
  }
  if (penalty > 0 || noShowFee > 0) {
    notes.push("Ceza yalnız çıplak ücrete uygulanır; devlet vergilerinden kesilmez.");
    // 60 No.lu KDV Sirküleri: cezai şart / tazminat niteliğindeki tahsilat bir
    // hizmetin karşılığı değildir → KDV hesaplanmaz.
    notes.push("İptal/no-show cezası tazminat niteliğindedir — KDV hesaplanmaz.");
  }
  // KDV md.35: iade düzeltmesi KESİM tarihindeki oranla yapılır.
  if (ticket.fare.vat?.regime === "taxable" && fareComponent > 0) {
    notes.push(
      `KDV düzeltmesi kesim tarihindeki oranla yapılır (%${(ticket.fare.vat.rate * 100).toFixed(0)}, ${ticket.fare.vat.rateDate}) — iade günündeki oranla değil (md.35).`,
    );
  }
  if (ticket.fare.vat?.regime === "exempt") {
    notes.push("Uluslararası taşıma KDV'den istisnadır (md.14) — iade hesabında KDV düzeltmesi yoktur.");
  }

  // ---------------------------------------------------------------
  // 4) KESİNTİLER + NET
  // ---------------------------------------------------------------
  let deductions = 0;
  if (refundType === "voluntary" && !waiverApplies) {
    deductions = (input.serviceCharge ?? 0) + (input.communicationExpenses ?? 0);
  }

  const fareAfterPenalty = Math.max(0, fareComponent - penalty - noShowFee);
  const gross = round2(fareAfterPenalty + refundableTax - deductions);
  const clampedToZero = gross < 0;
  const net = Math.max(0, gross);
  if (clampedToZero) notes.push("Kesintiler iade tutarını aşıyor — net iade sıfırdır, yolcudan ek tahsilat yapılmaz.");

  // ---------------------------------------------------------------
  // 5) DEĞERLEME (15.1.6)
  // ---------------------------------------------------------------
  const assessmentCurrency = commencementCurrency(ticket);
  let rateType: RefundQuote["rateType"] = "none";
  let rate: number | undefined;

  if (assessmentCurrency !== ticketCurrency) {
    const converted = convert(net, ticketCurrency, assessmentCurrency);
    if (converted != null) {
      rateType = "original";
      notes.push(`15.1.6(b)(i): ödeme ${ticketCurrency} olarak yapılmış — iade aynı para biriminde, orijinal işlem kuru ile değerlendi.`);
    }
  } else {
    rateType = "bank";
    notes.push("15.1.6(b)(ii): iade, iade günü banka kuru ile değerlendi.");
  }

  return {
    amount: { amount: round2(net), currency: ticketCurrency },
    assessmentCurrency,
    rateType,
    rate,
    fareComponent: round2(fareComponent),
    tfcComponent: round2(refundableTax),
    penalty: round2(penalty),
    penaltyExplain,
    penaltyWaived,
    noShowFee: round2(noShowFee),
    deductions: round2(deductions),
    tfcLines,
    fareRefundable,
    method,
    alternatives,
    notes,
    clampedToZero,
  };
}

/**
 * Vergi kalemlerini kupona dağıt. Kalemde `couponSeq` varsa aynen kullanılır;
 * yoksa (bizim tarife motorumuzun ürettiği gibi) kalkış bazlı kalemler kuponlara
 * eşit dağıtılır. Ödenen tutara bağlı kalemler (KDV, YQ) bilet geneline aittir
 * ve seçilen kupon payı kadar hesaplanır.
 */
function expandTfcs(tfcs: TaxFeeCharge[], ticket: Ticket, selectedSeqs: number[]): TfcLine[] {
  const n = ticket.coupons.length || 1;
  const out: TfcLine[] = [];
  // Kalem dökümü olmayan eski kayıt: toplam TFC tek kalem sayılır ki vergi
  // sessizce kaybolmasın. Kod bilinmediği için olay bazlı kabul edilir.
  const lines: TaxFeeCharge[] = tfcs.length
    ? tfcs
    : ticket.fare.totalTfc.amount > 0
      ? [{ code: "TFC", amount: ticket.fare.totalTfc }]
      : [];
  for (const t of lines) {
    if (t.couponSeq != null) {
      out.push({ code: t.code, amount: t.amount.amount, refundable: false, reason: "", couponSeq: t.couponSeq });
      continue;
    }
    // Dağıtılmamış kalem: seçilen kupon sayısı kadar pay.
    const share = (t.amount.amount / n) * selectedSeqs.length;
    // Payı, seçilen ilk kupona bağla (uçulmuşluk kontrolü için).
    out.push({ code: t.code, amount: round2(share), refundable: false, reason: "", couponSeq: selectedSeqs[0] });
  }
  return out;
}

function oneWayFareOfUnused(ticket: Ticket, seqs: number[]): number | null {
  const cs = ticket.coupons.filter((c) => seqs.includes(c.seq)).sort((a, b) => a.seq - b.seq);
  if (!cs.length) return null;
  const legs = cs.map((c) => ({ origin: c.segment.origin, destination: c.segment.destination }));
  const cabin = cabinOfRbd(cs[0].segment.rbd);
  const q = cheapestTotal(legs, cabin);
  return q ? q.amount : null;
}

function cabinOfRbd(rbd: string): "Economy" | "Premium" | "Business" {
  if ("JCDIZ".includes(rbd)) return "Business";
  if ("WPS".includes(rbd)) return "Premium";
  return "Economy";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
