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
import { isTfcRefundable, taxByCode, tfcRefundReason, type TfcRefundBasis } from "./taxCodes";
import { isFinal } from "./couponStatus";
import {
  computePenalty, fareRuleFor, isFareRefundable, waives,
  type FareRule, type PenaltyRule, type WaiverCode,
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

/** Aynı sözlüğün İngilizcesi — arayüz dili EN iken gösterilir (hesaba etkisi yoktur). */
export const INVOLUNTARY_REASON_LABEL_EN: Record<InvoluntaryReason, string> = {
  flight_cancellation: "Flight cancellation",
  schedule_change: "Schedule change",
  over_under_carriage: "Over/under carriage",
  offloading: "Offloading",
  misconnection: "Misconnection",
  safety_legal: "Safety / legal grounds",
  pax_condition_conduct: "Passenger's condition or conduct",
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
  /** `reason`'ın İngilizcesi — aynı karar, yalnız dil farkı. */
  reasonEn: string;
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
  /** İade ile düzeltilecek KDV — iade edilen ÜCRETLE orantılıdır (md.35). */
  vatRefunded: number;
  assessmentCurrency: string;
  rateType: "original" | "bank" | "none";
  rate?: number;
  fareComponent: number;
  tfcComponent: number;
  /** Tarife kuralından gelen ceza (yalnız ücrete uygulanır). */
  penalty: number;
  penaltyExplain?: string;
  /** `penaltyExplain`'in İngilizcesi. */
  penaltyExplainEn?: string;
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
  alternatives?: { label: string; labelEn: string; amount: number; chosen: boolean }[];
  notes: string[];
  /** `notes` ile aynı sırada, aynı sayıda — yalnız dil farkı. */
  notesEn: string[];
  /** Kesintiler iadeyi aştı → net sıfır. */
  clampedToZero: boolean;
}

export function quoteRefund(input: RefundQuoteInput): RefundQuote {
  const { ticket, couponSeqs, refundType } = input;
  const notes: string[] = [];
  // EN karşılıkları TR ile AYNI SIRADA doldurulur; hesaba girmez, yalnız gösterilir.
  const notesEn: string[] = [];
  const ticketCurrency = ticket.fare.total.currency;
  const n = ticket.coupons.length || 1;

  const rule = ruleOfTicket(ticket);
  const fareRefundable = isFareRefundable(rule);
  const selected = ticket.coupons.filter((c) => couponSeqs.includes(c.seq));
  const usedCoupons = ticket.coupons.filter((c) => couponUsed(c.status));
  const partial = usedCoupons.length > 0;

  // Değer taşıyan kuponlar: final statüye düşmüş olanlar (R/E/V/G/P/X/Z)
  // artık iade edilecek bir değer TAŞIMAZ. Aksi hâlde bir kuponu iade edilmiş
  // bilet hâlâ "hiç kullanılmamış" görünür ve ücretin tamamı ikinci kez iade
  // edilebilirdi.
  const valueCoupons = ticket.coupons.filter((c) => !isFinal(c.status));
  /** Biletin kalan değerinin TAMAMI mı iade ediliyor? */
  const wholeRemainingTicket =
    valueCoupons.length > 0 && valueCoupons.every((c) => couponSeqs.includes(c.seq));
  /**
   * Bilete HİÇ dokunulmamış mı? Bir kuponu daha önce iade/exchange/void
   * edilmiş bilette değerin bir kısmı çoktan çıkmıştır; "tam ücret" ödemek
   * o değeri ikinci kez iade etmek olur.
   */
  const untouched = ticket.coupons.every((c) => !isFinal(c.status));
  /** Ödenen ücretin tamamı ancak dokunulmamış biletin tamamı iade edilirken verilir. */
  const fullFareApplies = untouched && wholeRemainingTicket;

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
    let reasonEn = selectedLine
      ? tfcRefundReasonEn(line.code, flown, fareRefundable)
      : "This coupon is not being refunded.";
    // Cat 33 vergi göstergesi "X": iade edilemez üründe vergiler de bilette kalır.
    if (taxIndicatorBlocks && !fareRefundable) {
      refundable = false;
      reason = "Tarife kuralı gereği vergiler de iade edilmez (Cat 33 vergi göstergesi X).";
      reasonEn = "Under the fare rule the taxes are not refunded either (Cat 33 tax indicator X).";
    }
    return { ...line, refundable, reason, reasonEn };
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
    notesEn.push("Tax / fee refund only (Y) — the base fare is not refunded.");
    notes.push("Bu işlemden sonra biletin kalan değeri kullanılamaz; yolcuya bildirin.");
    notesEn.push("After this transaction the remaining value of the ticket cannot be used; advise the passenger.");
  } else if (!fareRefundable && refundType === "voluntary") {
    // İade edilemez ürün: ücret yanar, yalnız iade edilebilir vergiler geri verilir.
    method = "non_refundable_taxes_only";
    notes.push("Tarife kuralı iadeye izin vermiyor — çıplak ücret iade edilmez.");
    notesEn.push("The fare rule does not permit a refund — the base fare is not refunded.");
    notes.push("Olaya bağlı devlet harçları (kalkış/servis) yine de iade edilir.");
    notesEn.push("Event-driven government charges (departure / service) are still refunded.");
  } else if (refundType === "involuntary") {
    if (!partial && fullFareApplies) {
      method = "involuntary_unused";
      fareComponent = base;
      notes.push("15.1.2(a): biletin hiçbir bölümü kullanılmamış — ödenen ücretin tamamı iade edilir.");
      notesEn.push("15.1.2(a): no portion of the ticket has been used — the full fare paid is refunded.");
    } else if (!partial) {
      // Kullanılmamış ama YALNIZ BİR BÖLÜMÜ iade ediliyor → seçilen kuponların payı.
      method = "involuntary_partial";
      fareComponent = round2(unusedShare);
      notes.push("Bilet kullanılmamış ancak yalnız bir bölümü iade ediliyor — seçilen kuponların ücret payı iade edilir.");
      notesEn.push("The ticket is unused but only part of it is being refunded — the fare share of the selected coupons is refunded.");
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
        {
          label: halfRule ? "Kullanılmayan taşımanın tek yön ücreti (RT/CT → yarısı)" : "Kullanılmayan taşımanın tek yön ücreti",
          labelEn: halfRule ? "One-way fare for the unused transportation (RT/CT → one half)" : "One-way fare for the unused transportation",
          amount: a, chosen: a >= b,
        },
        {
          label: "Ödenen ücret − kullanılan taşımanın ücreti",
          labelEn: "Fare paid − fare for the transportation used",
          amount: b, chosen: b > a,
        },
      ];
      notes.push("15.1.2(b): iki hesaptan YÜKSEK olanı önerilir.");
      notesEn.push("15.1.2(b): the HIGHER of the two calculations is proposed.");
      if (owFare == null) {
        notes.push("Tek yön ücreti tarifeden alınamadı — kupon payı kullanıldı.");
        notesEn.push("The one-way fare could not be obtained from the tariff — the coupon share was used instead.");
      }
    }
    notes.push(
      input.reason && REASON_ALLOWS_CHARGES[input.reason]
        ? "15.1.2(c): güvenlik/hukuki sebep veya yolcunun hâli/davranışı — masraf üstlenimi reddedilebilir."
        : "15.1.2(c): masraflar taşıyıcıya aittir; iptal cezası uygulanmaz.",
    );
    notesEn.push(
      input.reason && REASON_ALLOWS_CHARGES[input.reason]
        ? "15.1.2(c): safety / legal grounds or the passenger's condition or conduct — the carrier may decline to bear the expenses."
        : "15.1.2(c): the expenses are borne by the carrier; no cancellation penalty is applied.",
    );
  } else if (!partial && fullFareApplies) {
    method = "voluntary_unused";
    fareComponent = base;
    notes.push("15.1.3.1(a): hiç kullanılmamış — tam ücret, kesintiler düşülerek.");
    notesEn.push("15.1.3.1(a): completely unused — the full fare, less the applicable deductions.");
  } else if (!partial) {
    method = "voluntary_partial";
    fareComponent = round2(unusedShare);
    notes.push("Bilet kullanılmamış ancak yalnız bir bölümü iade ediliyor — seçilen kuponların ücret payı iade edilir.");
    notesEn.push("The ticket is unused but only part of it is being refunded — the fare share of the selected coupons is refunded.");
  } else {
    method = "voluntary_partial";
    const usedFare = perCoupon * usedCoupons.length;
    // Fark, yalnız SEÇİLEN kuponların payını aşamaz — kalan kuponlar duruyor.
    fareComponent = round2(Math.min(Math.max(0, base - usedFare), unusedShare));
    notes.push("15.1.3.1(b): ödenen ücret ile kullanılan taşımanın ücreti arasındaki fark (seçilen kupon payıyla sınırlı).");
    notesEn.push("15.1.3.1(b): the difference between the fare paid and the fare for the transportation used (capped at the selected coupons' share).");
  }

  // ---------------------------------------------------------------
  // 3) CEZA (tarife kuralı) — yalnız ücrete uygulanır, vergiden kesilmez.
  // ---------------------------------------------------------------
  let penalty = 0;
  let penaltyExplain: string | undefined;
  let penaltyExplainEn: string | undefined;
  let penaltyWaived: WaiverCode | undefined;
  let noShowFee = 0;

  const noShow = selected.some((c) => c.noShow);
  // Muafiyet, kuralın izin verdiği hâllerde TÜM taşıyıcı kesintilerini kaldırır:
  // ceza, no-show ücreti ve 15.1.3.1 service charge / iletişim gideri.
  const waiverApplies = waives(rule, input.waiver);
  if (waiverApplies) {
    penaltyWaived = input.waiver;
    notes.push(`Muafiyet (${input.waiver}) — tarife kuralı bu hâlde ceza ve kesintileri kaldırıyor.`);
    notesEn.push(`Waiver (${input.waiver}) — the fare rule removes the penalty and the deductions in this case.`);
  }

  if (refundType === "voluntary" && !input.taxOnly && !waiverApplies) {
    const after = afterDeparture(ticket, couponSeqs);
    const applicable = after ? rule?.refund?.afterDeparture ?? rule?.refund?.beforeDeparture : rule?.refund?.beforeDeparture;
    const p = computePenalty(applicable, base, selected.length);
    if (p) {
      penalty = p.amount;
      penaltyExplain = `${after ? "Kalkıştan sonra" : "Kalkıştan önce"} iade cezası — ${p.explain}`;
      penaltyExplainEn = `${after ? "After departure" : "Before departure"} refund penalty — ${penaltyHowEn(applicable, base, selected.length)}`;
    }
  }
  if (noShow && refundType === "voluntary" && !waiverApplies) {
    const ns = computePenalty(rule?.refund?.noShow, base, 1);
    if (ns) {
      noShowFee = ns.amount;
      notes.push("No-show ücreti ayrı bir kalemdir; iptal cezasına EKLENİR.");
      notesEn.push("The no-show fee is a separate item; it is ADDED to the cancellation penalty.");
    }
  }
  if (penalty > 0 || noShowFee > 0) {
    notes.push("Ceza yalnız çıplak ücrete uygulanır; devlet vergilerinden kesilmez.");
    notesEn.push("The penalty applies to the base fare only; it is never deducted from government taxes.");
    // 60 No.lu KDV Sirküleri: cezai şart / tazminat niteliğindeki tahsilat bir
    // hizmetin karşılığı değildir → KDV hesaplanmaz.
    notes.push("İptal/no-show cezası tazminat niteliğindedir — KDV hesaplanmaz.");
    notesEn.push("A cancellation / no-show penalty is compensatory in nature — no VAT is charged on it.");
  }
  // KDV md.35: iade düzeltmesi KESİM tarihindeki oranla yapılır.
  if (ticket.fare.vat?.regime === "taxable" && fareComponent > 0) {
    notes.push(
      `KDV düzeltmesi kesim tarihindeki oranla yapılır (%${(ticket.fare.vat.rate * 100).toFixed(0)}, ${ticket.fare.vat.rateDate}) — iade günündeki oranla değil (md.35).`,
    );
    notesEn.push(
      `The VAT adjustment uses the rate in force on the date of issue (${(ticket.fare.vat.rate * 100).toFixed(0)}%, ${ticket.fare.vat.rateDate}) — not the rate on the date of refund (VAT Act art. 35).`,
    );
  }
  if (ticket.fare.vat?.regime === "exempt") {
    notes.push("Uluslararası taşıma KDV'den istisnadır (md.14) — iade hesabında KDV düzeltmesi yoktur.");
    notesEn.push("International carriage is VAT-exempt (VAT Act art. 14) — there is no VAT adjustment in the refund calculation.");
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
  if (clampedToZero) {
    notes.push("Kesintiler iade tutarını aşıyor — net iade sıfırdır, yolcudan ek tahsilat yapılmaz.");
    notesEn.push("The deductions exceed the refund — the net refund is zero; nothing further is collected from the passenger.");
  }

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
      notesEn.push(`15.1.6(b)(i): payment was made in ${ticketCurrency} — the refund is assessed in the same currency at the original transaction rate.`);
    }
  } else {
    rateType = "bank";
    notes.push("15.1.6(b)(ii): iade, iade günü banka kuru ile değerlendi.");
    notesEn.push("15.1.6(b)(ii): the refund is assessed at the bank rate on the date of refund.");
  }

  // KDV bilet bedelinin içindedir; iade edilen ücret kadarı düzeltilir.
  // Yalnız-vergi iadesinde ve ücret iade edilmediğinde KDV düzeltmesi YOKTUR.
  const vatRefunded = ticket.fare.vat && ticket.fare.vat.regime === "taxable" && base > 0
    ? round2(ticket.fare.vat.amount * (fareComponent / base))
    : 0;

  return {
    amount: { amount: round2(net), currency: ticketCurrency },
    vatRefunded,
    assessmentCurrency,
    rateType,
    rate,
    fareComponent: round2(fareComponent),
    tfcComponent: round2(refundableTax),
    penalty: round2(penalty),
    penaltyExplain,
    penaltyExplainEn,
    penaltyWaived,
    noShowFee: round2(noShowFee),
    deductions: round2(deductions),
    tfcLines,
    fareRefundable,
    method,
    alternatives,
    notes,
    notesEn,
    clampedToZero,
  };
}

/* ---------------------------------------------------------------------
   İngilizce açıklama üreticileri.

   YALNIZ METİN üretirler: hiçbir tutar buradan gelmez, hiçbir karar burada
   verilmez. Kararın kendisi TR tarafındaki fonksiyonlarda (taxCodes ve
   fareRules) alınır; buradaki dallar onların AYNASIDIR.
   --------------------------------------------------------------------- */

/** `taxCodes.tfcRefundReason`'ın İngilizce aynası. */
function tfcRefundReasonEn(code: string, couponFlown: boolean, fareRefundable: boolean): string {
  const def = taxByCode(code);
  const basis: TfcRefundBasis = def?.refundBasis ?? "perDeparture";
  if (basis === "always") return "Refunded even when unused (statutory requirement).";
  if (basis === "never") return "Not refundable.";
  if (couponFlown) return "The coupon was flown — the charge became due and is not refunded.";
  if (basis === "percentOfFare" || def?.followsFare) {
    return fareRefundable
      ? "Based on the amount paid; refunded because the fare itself is refundable."
      : "Based on the amount paid; not refunded because the fare itself is non-refundable.";
  }
  return "The departure did not take place — the charge never became due and is refunded.";
}

/**
 * `fareRules.computePenalty().explain` alanının İngilizce aynası — tutarı
 * DEĞİL, tutarın nasıl seçildiğini anlatır (yüksek/düşük olan, minimum,
 * kupon başına). Ceza tutarı her zaman `computePenalty`'den gelir.
 */
export function penaltyHowEn(rule: PenaltyRule | undefined, baseFare: number, couponCount = 1): string {
  if (!rule) return "";
  const fixed = rule.amount;
  const pct = rule.percent != null ? baseFare * rule.percent : undefined;

  let value: number;
  let how: string;
  if (fixed != null && pct != null) {
    const takeHigh = (rule.hiLo ?? "H") === "H";
    value = takeHigh ? Math.max(fixed, pct) : Math.min(fixed, pct);
    how = `the ${takeHigh ? "higher" : "lower"} of: a flat ${fixed.toLocaleString("en-GB")} and ${(rule.percent! * 100).toFixed(0)}% of the base fare (${Math.round(pct).toLocaleString("en-GB")})`;
  } else if (pct != null) {
    value = pct;
    how = `${(rule.percent! * 100).toFixed(0)}% of the base fare`;
  } else {
    value = fixed ?? 0;
    how = "a flat amount";
  }

  if (rule.minimum != null && value < rule.minimum) {
    how += ` · minimum ${rule.minimum.toLocaleString("en-GB")} applied`;
  }
  if (rule.base === "perCoupon") how += ` · per coupon (${couponCount} coupons)`;
  return how;
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
      out.push({ code: t.code, amount: t.amount.amount, refundable: false, reason: "", reasonEn: "", couponSeq: t.couponSeq });
      continue;
    }
    // Dağıtılmamış kalem: seçilen kupon sayısı kadar pay.
    const share = (t.amount.amount / n) * selectedSeqs.length;
    // Payı, seçilen ilk kupona bağla (uçulmuşluk kontrolü için).
    out.push({ code: t.code, amount: round2(share), refundable: false, reason: "", reasonEn: "", couponSeq: selectedSeqs[0] });
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
