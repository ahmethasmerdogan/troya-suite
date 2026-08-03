// Bilet değişikliği türleri — IATA Ticketing Handbook 12.1.1.
//
// Handbook birebir tanımlar:
//   EXCHANGE   : HİÇ KULLANILMAMIŞ biletin değerini, GÜNCEL ücret ve kurallarla
//                düzenlenen yepyeni bir bilete tamamen/kısmen "ödeme" olarak vermek.
//   REBOOKING  : bilet yeniden düzenlemeyi/değişimi GEREKTİRMEYEN rezervasyon
//                (ve benzeri) değişikliği.
//   REISSUE    : KISMEN KULLANILMIŞ biletin, ORİJİNAL KESİM TARİHİNDE geçerli
//                ücret ve kurallarla revize güzergâh için yeniden fiyatlanması.
//   REROUTING  : bilet reissue/exchange gerektiren güzergâh (vb.) değişikliği.
//   UPGRADING  : ödenen ücretten daha YÜKSEK bir ücrete geçiş. (Sezon, haftanın
//                günü ya da ilgili ücretlerdeki artıştan doğan yüksek tutar
//                upgrading SAYILMAZ.)
//
// Bu modül saf sınıflandırmadır: personel türü elle seçmez, sistem güzergâh /
// kabin / kullanım durumundan çıkarır ve doğru akışa yönlendirir.

import type { Segment, Ticket } from "./types";
import { couponUsed } from "./refundRules";

export type ChangeType = "exchange" | "rebooking" | "reissue" | "rerouting" | "upgrading";

export const CHANGE_TYPE_LABEL: Record<ChangeType, string> = {
  exchange: "Exchange (kullanılmamış bilet → yeni bilet)",
  rebooking: "Rebooking (yalnız rezervasyon değişikliği)",
  reissue: "Reissue (kısmen kullanılmış bilet yeniden fiyatlanır)",
  rerouting: "Rerouting (güzergâh değişikliği)",
  upgrading: "Upgrading (daha yüksek ücrete geçiş)",
};

/** Değişikliğin bilet yeniden düzenlemeyi gerektirip gerektirmediği. */
export const NEEDS_REISSUE: Record<ChangeType, boolean> = {
  exchange: true,
  rebooking: false,
  reissue: true,
  rerouting: true,
  upgrading: true,
};

export interface ChangeAnalysis {
  type: ChangeType;
  /** Kısmen kullanılmış mı (12.1.1 EXCHANGE ↔ REISSUE ayrımı). */
  partiallyUsed: boolean;
  routeChanged: boolean;
  cabinRaised: boolean;
  /** Yalnız tarih/saat değişti mi (rota, taşıyıcı, sınıf aynı). */
  onlyScheduleChanged: boolean;
  /** Personele gösterilecek gerekçe. */
  rationale: string;
  /** Doğru akış: revalidation yeter mi, reissue şart mı? */
  recommendedFlow: "revalidate" | "exchange";
}

const CABIN_RANK: Record<string, number> = { Economy: 0, Premium: 1, Business: 2 };

function cabinOf(rbd: string): "Economy" | "Premium" | "Business" {
  if ("JCDIZ".includes(rbd)) return "Business";
  if ("WPS".includes(rbd)) return "Premium";
  return "Economy";
}

function routeKey(segs: { origin: string; destination: string }[]): string {
  return segs.map((s) => `${s.origin}-${s.destination}`).join("|");
}

/**
 * Eski bilet + yeni segmentlerden değişiklik türünü çıkarır (12.1.1).
 * Sıralama önemlidir: rota değiştiyse rerouting, sınıf yükseldiyse upgrading,
 * ikisi de yoksa yalnız rezervasyon değişikliği → rebooking.
 */
export function classifyChange(ticket: Ticket, newSegments: Segment[]): ChangeAnalysis {
  const openCoupons = ticket.coupons.filter((c) => c.status === "O");
  const oldSegs = (openCoupons.length ? openCoupons : ticket.coupons).map((c) => c.segment);
  const partiallyUsed = ticket.coupons.some((c) => couponUsed(c.status));

  const routeChanged = routeKey(oldSegs) !== routeKey(newSegments);
  const oldCabin = Math.max(...oldSegs.map((s) => CABIN_RANK[cabinOf(s.rbd)] ?? 0), 0);
  const newCabin = Math.max(...newSegments.map((s) => CABIN_RANK[cabinOf(s.rbd)] ?? 0), 0);
  const cabinRaised = newCabin > oldCabin;
  const carrierChanged = oldSegs.some((s, i) => newSegments[i] && s.marketingCarrier !== newSegments[i].marketingCarrier);
  const scheduleChanged = oldSegs.some(
    (s, i) => newSegments[i] && (s.departure !== newSegments[i].departure || s.flightNumber !== newSegments[i].flightNumber),
  );
  const onlyScheduleChanged = !routeChanged && !cabinRaised && !carrierChanged && scheduleChanged;

  let type: ChangeType;
  let rationale: string;

  if (onlyScheduleChanged) {
    type = "rebooking";
    rationale = "Rota, taşıyıcı ve sınıf aynı; yalnız rezervasyon değişti — bilet yeniden düzenlenmez (12.1.1 REBOOKING).";
  } else if (cabinRaised) {
    type = "upgrading";
    rationale = "Ödenen ücretten daha yüksek bir kabine geçiliyor (12.1.1 UPGRADING).";
  } else if (routeChanged || carrierChanged) {
    type = "rerouting";
    rationale = "Güzergâh/taşıyıcı değişiyor — bilet reissue/exchange gerektirir (12.1.1 REROUTING).";
  } else if (partiallyUsed) {
    type = "reissue";
    rationale = "Bilet kısmen kullanılmış — ücret ORİJİNAL KESİM TARİHİ kural ve tarifeleriyle yeniden hesaplanır (12.1.1 REISSUE).";
  } else {
    type = "exchange";
    rationale = "Bilet hiç kullanılmamış — değeri GÜNCEL tarifelerle yeni bilete aktarılır (12.1.1 EXCHANGE).";
  }

  // Kısmen kullanılmış bilette rota değişse de fiyatlama reissue kuralına tabidir.
  if (partiallyUsed && (type === "rerouting" || type === "upgrading")) {
    rationale += " Bilet kısmen kullanıldığı için fiyatlama REISSUE kuralıyla (orijinal kesim tarihi) yapılır.";
  }

  return {
    type,
    partiallyUsed,
    routeChanged,
    cabinRaised,
    onlyScheduleChanged,
    rationale,
    recommendedFlow: NEEDS_REISSUE[type] ? "exchange" : "revalidate",
  };
}

/**
 * 12.1.1 REISSUE: kısmen kullanılmış bilette ücret ORİJİNAL KESİM TARİHİNDEKİ
 * kurallarla; hiç kullanılmamışta (EXCHANGE) GÜNCEL tarifelerle değerlenir.
 */
export function pricingBasis(a: ChangeAnalysis): "original_issue_date" | "current" {
  return a.partiallyUsed ? "original_issue_date" : "current";
}
