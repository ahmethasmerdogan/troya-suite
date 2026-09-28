// Reissue / exchange para hesabı — IATA Ticketing Handbook 12.5, 12.7, 12.11
// + tarife kuralı (ATPCO Cat 31).
//
// EN KRİTİK AYRIM: Handbook'un ADC'si SADECE iki kalemdir —
//
//     ADC = (yeni ücret − eski ücret) + (yalnız ARTAN vergiler)
//
// Handbook Ch.12'de "penalty" / "change fee" kavramı HİÇ GEÇMEZ. Değişiklik
// ücreti tarifenin kuralından (Cat 31) gelir ve AYRI bir kalemdir. Bu yüzden
// fareDiff, tfcDiff ve penalty burada ayrı alanlarda tutulur.
//
// PD (previously paid) mekanizması — 12.5(c):
//   (i)   vergi değişmediyse : "PD" + ödenmiş tutar + kod   → yeniden tahsil YOK
//   (ii)  vergi azaldıysa    : iade edilebilirse "PD" + YENİ tutar ve fark iade;
//                              iade edilemezse ORİJİNAL tutar aynen taşınır
//   (iii) vergi arttıysa     : "PD" + ödenmiş tutar, AYRICA yalnız FARK tahsil
//   (iv)  vergi kalktıysa    : kutu boş; iade edilebilirse iade, değilse taşınır
// Para birimi kodu PD satırına YAZILMAZ (orijinal yolcu kuponunda görünür).
//
// TOPLAM kutusu — 12.5(d):
//   ek tahsilat yoksa   → "NO ADC"   (bu "para hareket etmedi" DEMEK DEĞİLDİR)
//   ek tahsilat varsa   → para birimi + tutar + "A"   (ör. "TRY 1.234,00A")
//
// RESIDUAL — 12.11.2.1 / 12.7.3:
//   Yeni ücret düşükse fark ADC ile NETLENMEZ; ayrı bir belgeyle (MCO/EMD-S)
//   dışarı çıkar. Bakiyenin nakde çevrilebilirliği ORİJİNAL biletin kuralına
//   bağlıdır: iade edilemez bilette bakiye yalnız gelecekteki seyahat için
//   verilir. Ceza bakiyeden DÜŞÜLÜR (eklenmez); bakiye cezayı karşılamıyorsa
//   aradaki fark yolcudan tahsil edilir.

import type { Money, TaxFeeCharge, Ticket } from "./types";
import { isTfcRefundable } from "./taxCodes";
import { computePenalty, fareRuleFor, isFareRefundable, penaltyInCurrency, waives, type WaiverCode } from "./fareRules";
import { fareTypeByCoupon } from "./fareTypes";
import { couponUsed, penaltyHowEn } from "./refundRules";
import { classifyChange, pricingBasis, type ChangeAnalysis } from "./changeRules";
import { ticketValidity } from "./validity";
import { demoNow } from "./demoClock";

export type TfcDisposition =
  | "pd_carry_forward"          // 12.5(c)(i)  — değişmedi
  | "pd_new_amount"             // 12.5(c)(ii) — azaldı ve iade edilebilir
  | "forfeit_difference"        // 12.5(c)(ii) — azaldı ama iade edilemez
  | "collect_additional"        // 12.5(c)(iii)— arttı
  | "blank_no_longer_applicable"; // 12.5(c)(iv)— artık uygulanmıyor

export interface TfcReissueLine {
  code: string;
  oldAmount: number;
  newAmount: number;
  refundable: boolean;
  disposition: TfcDisposition;
  /** Bilete basılacak metin — PD satırında para birimi kodu YOKTUR. */
  ticketText: string;
  /** + tahsil edilecek · − iade edilecek · 0 hareketsiz. */
  delta: number;
}

export interface ResidualValue {
  amount: number;
  currency: string;
  /** Orijinal biletin kuralı iadeye izin veriyor mu? */
  refundable: boolean;
  document: "mco" | "emd_s";
  /** EMD kesiminden itibaren bir yıl. */
  validUntil: string;
  /** Cezanın bakiyeden düşülen kısmı. */
  penaltyDeducted: number;
  note: string;
  /** `note`'un İngilizcesi — aynı karar, yalnız dil farkı. */
  noteEn: string;
}

export interface ReissueQuote {
  analysis: ChangeAnalysis;
  /** 12.1.1 — kısmen kullanılmışta orijinal kesim tarihi, kullanılmamışta güncel. */
  basis: "original_issue_date" | "current";
  currency: string;
  oldFare: number;
  newFare: number;
  /** İşaretli: >0 ek tahsilat, <0 bakiye. */
  fareDiff: number;
  tfcLines: TfcReissueLine[];
  tfcAdditional: number;
  tfcRefunded: number;
  tfcForfeited: number;
  penalty: number;
  penaltyExplain?: string;
  /** `penaltyExplain`'in İngilizcesi. */
  penaltyExplainEn?: string;
  penaltyWaived?: WaiverCode;
  /** Yolcudan tahsil edilecek toplam. Bakiye buraya NETLENMEZ. */
  adc: number;
  noAdc: boolean;
  /** "Total" kutusuna basılacak metin. */
  totalBoxText: string;
  residual?: ResidualValue;
  /** Yeni biletin son geçerlilik tarihi (12.4.1 vs 12.9.1). */
  validUntil: string;
  notes: string[];
  /** `notes` ile aynı sırada, aynı sayıda — yalnız dil farkı. */
  notesEn: string[];
}

export interface ReissueQuoteInput {
  ticket: Ticket;
  /** Yeni yolculuğun ücreti ve vergileri (tarife motorundan gelir). */
  newBaseFare: number;
  newTfcs: TaxFeeCharge[];
  newSegments: Ticket["coupons"][number]["segment"][];
  waiver?: WaiverCode;
}

export function quoteReissue(input: ReissueQuoteInput): ReissueQuote {
  const { ticket } = input;
  const currency = ticket.fare.total.currency;
  const notes: string[] = [];
  // EN karşılıkları TR ile AYNI SIRADA doldurulur; hesaba girmez, yalnız gösterilir.
  const notesEn: string[] = [];

  const analysis = classifyChange(ticket, input.newSegments);
  const basis = pricingBasis(analysis);
  notes.push(
    basis === "original_issue_date"
      ? "12.1.1 REISSUE: bilet kısmen kullanılmış — ücret ORİJİNAL KESİM TARİHİNDEKİ tarife ve kurallarla hesaplanır."
      : "12.1.1 EXCHANGE: bilet hiç kullanılmamış — ücret GÜNCEL tarife ve kurallarla hesaplanır.",
  );
  notesEn.push(
    basis === "original_issue_date"
      ? "12.1.1 REISSUE: the ticket is partially used — the fare is calculated with the tariffs and rules in force on the ORIGINAL DATE OF ISSUE."
      : "12.1.1 EXCHANGE: the ticket is completely unused — the fare is calculated with CURRENT tariffs and rules.",
  );

  const oldFare = ticket.fare.baseFare.amount;
  const newFare = input.newBaseFare;
  const fareDiff = round2(newFare - oldFare);

  // --- vergi matrisi (12.5(c)) ---
  const ft = fareTypeByCoupon(ticket.coupons[0]?.segment.rbd, ticket.coupons[0]?.segment.fareBasis);
  const rule = fareRuleFor(ft?.id);
  const fareRefundable = isFareRefundable(rule);
  const anyFlown = ticket.coupons.some((c) => couponUsed(c.status));

  const oldByCode = new Map(ticket.fare.tfcs.map((t) => [t.code, t.amount.amount]));
  const newByCode = new Map(input.newTfcs.map((t) => [t.code, t.amount.amount]));
  const codes = [...new Set([...oldByCode.keys(), ...newByCode.keys()])];

  const tfcLines: TfcReissueLine[] = codes.map((code) => {
    const oldAmount = oldByCode.get(code) ?? 0;
    const newAmount = newByCode.get(code) ?? 0;
    const refundable = isTfcRefundable(code, anyFlown, fareRefundable);
    let disposition: TfcDisposition;
    let delta = 0;
    let ticketText: string;

    if (newAmount === 0 && oldAmount > 0) {
      // (iv) artık uygulanmıyor
      disposition = "blank_no_longer_applicable";
      if (refundable) { delta = -oldAmount; ticketText = ""; }
      else { disposition = "forfeit_difference"; ticketText = `PD${fmt(oldAmount)}${code}`; }
    } else if (newAmount === oldAmount) {
      // (i) değişmedi
      disposition = "pd_carry_forward";
      ticketText = `PD${fmt(oldAmount)}${code}`;
    } else if (newAmount > oldAmount) {
      // (iii) arttı — yalnız FARK tahsil edilir
      disposition = "collect_additional";
      delta = round2(newAmount - oldAmount);
      ticketText = `PD${fmt(oldAmount)}${code} + ${fmt(delta)}${code}`;
    } else {
      // (ii) azaldı
      if (refundable) {
        disposition = "pd_new_amount";
        delta = round2(newAmount - oldAmount); // negatif → iade
        ticketText = `PD${fmt(newAmount)}${code}`;
      } else {
        disposition = "forfeit_difference";
        ticketText = `PD${fmt(oldAmount)}${code}`;
      }
    }
    return { code, oldAmount, newAmount, refundable, disposition, ticketText, delta };
  });

  const tfcAdditional = round2(tfcLines.filter((l) => l.delta > 0).reduce((s, l) => s + l.delta, 0));
  const tfcRefunded = round2(tfcLines.filter((l) => l.delta < 0).reduce((s, l) => s - l.delta, 0));
  const tfcForfeited = round2(
    tfcLines.filter((l) => l.disposition === "forfeit_difference")
      .reduce((s, l) => s + Math.max(0, l.oldAmount - l.newAmount), 0),
  );
  if (tfcForfeited > 0) {
    notes.push("12.5(c)(ii): azalan vergi iade edilebilir nitelikte değil — orijinal tutar bilette aynen taşınır.");
    notesEn.push("12.5(c)(ii): the decreased tax is not refundable in nature — the original amount is carried forward on the ticket unchanged.");
  }

  // --- ceza (Cat 31) ---
  let penalty = 0;
  let penaltyExplain: string | undefined;
  let penaltyExplainEn: string | undefined;
  let penaltyWaived: WaiverCode | undefined;
  const waiverApplies = waives(rule, input.waiver);
  if (waiverApplies) {
    penaltyWaived = input.waiver;
    notes.push(`Muafiyet (${input.waiver}) — tarife kuralı değişiklik ücretini kaldırıyor.`);
    notesEn.push(`Waiver (${input.waiver}) — the fare rule removes the change fee.`);
  } else {
    const after = anyFlown || new Date(ticket.coupons[0]?.segment.departure ?? 0).getTime() < Date.now();
    const applicable = penaltyInCurrency(
      after ? rule?.change?.afterDeparture ?? rule?.change?.beforeDeparture : rule?.change?.beforeDeparture,
      ticket.fare.baseFare.currency,
    );
    const p = computePenalty(applicable, oldFare);
    if (p) {
      penalty = p.amount;
      penaltyExplain = `${after ? "Kalkıştan sonra" : "Kalkıştan önce"} değişiklik ücreti — ${p.explain}`;
      penaltyExplainEn = `${after ? "After departure" : "Before departure"} change fee — ${penaltyHowEn(applicable, oldFare)}`;
      notes.push("Değişiklik ücreti handbook'tan değil TARİFE KURALINDAN gelir (Cat 31) ve ADC'ye ayrı kalem olarak eklenir.");
      notesEn.push("The change fee comes from the FARE RULE (Cat 31), not from the handbook, and is added to the ADC as a separate item.");
    }
  }

  // --- ADC ve bakiye ---
  let adc = 0;
  let residual: ResidualValue | undefined;

  if (fareDiff >= 0) {
    adc = round2(fareDiff + tfcAdditional + penalty);
  } else {
    // Yeni ücret düşük → bakiye. Ceza bakiyeden DÜŞÜLÜR.
    const raw = round2(-fareDiff);
    const afterPenalty = round2(raw - penalty);
    if (afterPenalty > 0) {
      residual = {
        amount: afterPenalty,
        currency,
        refundable: fareRefundable,
        document: fareRefundable ? "mco" : "emd_s",
        validUntil: plusOneYear(),
        penaltyDeducted: penalty,
        note: fareRefundable
          ? "Orijinal bilet iade edilebilir — bakiye nakden iade edilebilir (MCO / For Refund Only)."
          : "Orijinal bilet iade edilemez — bakiye nakde çevrilemez; yalnız gelecekteki seyahat için EMD-S olarak verilir.",
        noteEn: fareRefundable
          ? "The original ticket is refundable — the residual may be refunded in cash (MCO / For Refund Only)."
          : "The original ticket is non-refundable — the residual cannot be converted to cash; it is issued as an EMD-S for future travel only.",
      };
      // Bakiye ADC ile netlenmez; yalnız artan vergi tahsil edilir.
      adc = tfcAdditional;
      notes.push("12.11.2.1: bakiye Total kutusuna netlenmez; ayrı belgeyle (MCO / EMD-S) verilir.");
      notesEn.push("12.11.2.1: the residual is not netted into the Total box; it is issued on a separate document (MCO / EMD-S).");
    } else {
      // Bakiye cezayı karşılamıyor → fark yolcudan tahsil edilir.
      adc = round2(-afterPenalty + tfcAdditional);
      notes.push("Bakiye değişiklik ücretini karşılamıyor — aradaki fark yolcudan tahsil edilir.");
      notesEn.push("The residual does not cover the change fee — the difference is collected from the passenger.");
    }
  }

  const noAdc = adc <= 0;
  const totalBoxText = noAdc ? "NO ADC" : `${currency} ${adc.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}A`;
  if (noAdc) {
    notes.push('12.5(d): "NO ADC" yalnız YOLCUDAN EK TAHSİLAT YOK demektir — bakiye belgesi ayrıca kesilebilir.');
    notesEn.push('12.5(d): "NO ADC" only means NO ADDITIONAL COLLECTION FROM THE PASSENGER — a residual document may still be issued.');
  }

  // --- geçerlilik (12.4.1 vs 12.9.1) ---
  // 12.4.1: yeni biletin geçerliliği, orijinal satış tarihinde kesilmiş olsaydı
  // geçerli olacak bitişle sınırlıdır — yani orijinal biletin bitişi. Komut da
  // yeni bilete aynı sınırı yazar (`validityLimit`), iki taraf aynı tarihi söyler.
  const validUntil = basis === "original_issue_date"
    ? ticketValidity(ticket, demoNow()).until
    : plusOneYear(input.newSegments[0]?.departure);
  notes.push(
    basis === "original_issue_date"
      ? "12.4.1: reissue taze bir yıl kazandırmaz — yeni bilet orijinal biletin geçerlilik bitişini taşır."
      : "12.9.1: hiç kullanılmamış biletin exchange'inde geçerlilik seyahat başlangıcından itibaren bir yıldır.",
  );
  notesEn.push(
    basis === "original_issue_date"
      ? "12.4.1: a reissue does not grant a fresh year — the new ticket carries the original ticket's validity end."
      : "12.9.1: on the exchange of a completely unused ticket, validity runs one year from the commencement of travel.",
  );

  return {
    analysis, basis, currency,
    oldFare, newFare, fareDiff,
    tfcLines, tfcAdditional, tfcRefunded, tfcForfeited,
    penalty, penaltyExplain, penaltyExplainEn, penaltyWaived,
    adc: Math.max(0, adc), noAdc, totalBoxText,
    residual, validUntil, notes, notesEn,
  };
}

/** ADC tutarını Money'e çevirir. */
export function adcMoney(q: ReissueQuote): Money {
  return { amount: q.adc, currency: q.currency };
}

function fmt(n: number): string {
  return n.toFixed(2);
}

function plusOneYear(from?: string): string {
  const d = from ? new Date(from) : new Date();
  const t = Number.isNaN(d.getTime()) ? new Date() : d;
  return new Date(t.getFullYear() + 1, t.getMonth(), t.getDate()).toISOString();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
