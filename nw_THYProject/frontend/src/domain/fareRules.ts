// Ücret kuralları — iptal / değişiklik / no-show cezaları.
//
// ÖNEMLİ: IATA Ticketing Handbook ceza TANIMLAMAZ. Handbook belgeyi ve iade
// hesabının çerçevesini (15.1) anlatır; cezanın kendisi TARİFENİN KURALINDAN
// gelir. Sektörde bu kurallar ATPCO kategorilerinde filed edilir:
//
//   Cat 16 — Penalties   : ekranda gösterilen "fine print". Otomatik işlemde
//                          OTORİTE DEĞİLDİR, yalnız görüntüleme/elle işlem metni.
//   Cat 31 — Voluntary Changes : otomatik değişiklik/reissue otoritesi.
//   Cat 33 — Voluntary Refunds : otomatik iade otoritesi.
//
// Bu modül Cat 31/33'ün prototip karşılığıdır. Kurulan kurallar:
//
//  • Kural YOKSA işlem SERBEST ve ÜCRETSİZDİR. ("veri yok = yasak" YANLIŞTIR;
//    tam esnek ücret teknik olarak "kural yok" ile temsil edilir.)
//  • Ceza tetikleyicileri AYRI alanlardır: iptal/iade, değişiklik, no-show.
//    No-show cezası normal iptal cezasından farklı bir kalemdir.
//  • Zamanlama: kalkıştan ÖNCE ve SONRA farklı tutarlar kodlanabilir.
//  • Hem sabit tutar hem yüzde varsa H → yükseği, L → düşüğü uygulanır;
//    İKİSİ ASLA TOPLANMAZ.
//  • Yüzde ÇIPLAK ÜCRET (base fare) üzerinden hesaplanır, bilet toplamı değil.
//  • "Minimum amount" varsa hesaplanan ceza bunun altına inemez.
//  • Ceza yalnız ÜCRETE uygulanır; devlet vergilerinden ceza kesilmez.
//  • Muafiyetler (vefat, hastalık, tarife değişikliği…) cezayı sıfırlar.
//  • Bilet kısıtı: X = iade edilemez, N = değiştirilemez, B = ikisi de.

import type { Money } from "./types";

export type PenaltyBase = "perTicket" | "perCoupon" | "perDirection" | "perFareComponent";

/** Tek bir ceza hükmü. */
export interface PenaltyRule {
  /** Sabit tutar. */
  amount?: number;
  /** Çıplak ücret yüzdesi (0.25 = %25). */
  percent?: number;
  /** İkisi de kodlanmışsa hangisi uygulanır — H: yüksek, L: düşük. Toplanmaz. */
  hiLo?: "H" | "L";
  /** Hesaplanan ceza bu tutarın altına inemez. */
  minimum?: number;
  currency: string;
  /** Cezanın uygulama tabanı — "her zaman bilet başına" DEĞİLDİR. */
  base: PenaltyBase;
}

export type WaiverCode = "death" | "illness" | "family_death" | "family_illness" | "schedule_change" | "upgrade";

export interface FareRule {
  fareTypeId: string;
  /** X = iade edilemez · N = değiştirilemez · B = ikisi de. Yoksa serbest. */
  restriction?: "X" | "N" | "B";
  /** Cat 33 — iade. Hüküm yoksa iade ücretsiz ve serbesttir. */
  refund?: {
    beforeDeparture?: PenaltyRule;
    afterDeparture?: PenaltyRule;
    /** Yolcu uçuşa gelmediyse EK olarak alınan ücret. */
    noShow?: PenaltyRule;
    /** "X" ise iade edilemez üründe vergiler de bilette KALIR (yalnız-vergi iadesi yok). */
    taxIndicator?: "X";
  };
  /** Cat 31 — değişiklik. Hüküm yoksa değişiklik ücretsiz ve serbesttir. */
  change?: {
    beforeDeparture?: PenaltyRule;
    afterDeparture?: PenaltyRule;
    /** A = reissue zorunlu · B = revalidation yeterli. Yoksa ikisi de olur. */
    ticketType?: "A" | "B";
    /** İzin verilen azami reissue sayısı. */
    maxReissues?: number;
  };
  /** Bu kuralda cezayı kaldıran haller. */
  waivers?: WaiverCode[];
}

const TRY_ = "TRY";
const P = (amount: number, base: PenaltyBase = "perTicket", extra: Partial<PenaltyRule> = {}): PenaltyRule => ({
  amount, currency: TRY_, base, ...extra,
});

/**
 * Ücret ailesi → kural. Tutarlar DEMO tarifesidir (gerçekte ATPCO'dan filed
 * edilir ve rotaya/sezona göre değişir); yapı gerçektir.
 *
 * Esnek ürünlerde hiç hüküm yoktur — bu, "ücretsiz ve serbest" demektir.
 */
export const FARE_RULES: FareRule[] = [
  // --- tam esnek: kural yok → ceza yok ---
  { fareTypeId: "biz-flex", waivers: ["death", "illness", "family_death", "schedule_change"] },
  { fareTypeId: "prem-flex", waivers: ["death", "illness", "family_death", "schedule_change"] },
  { fareTypeId: "eco-flex", waivers: ["death", "illness", "family_death", "schedule_change"] },

  // --- klasik: ücretli değişiklik, kısmi iade cezası ---
  {
    fareTypeId: "biz-classic",
    refund: { beforeDeparture: P(1500), afterDeparture: P(3000), noShow: P(2000) },
    change: { beforeDeparture: P(1000), afterDeparture: P(2000) },
    waivers: ["death", "illness", "family_death", "schedule_change"],
  },
  {
    fareTypeId: "prem-classic",
    restriction: "X", // iade edilemez
    change: { beforeDeparture: P(900), afterDeparture: P(1800) },
    waivers: ["death", "family_death", "schedule_change"],
  },
  {
    fareTypeId: "eco-classic",
    restriction: "X",
    change: { beforeDeparture: P(750), afterDeparture: P(1500) },
    refund: { noShow: P(1200) },
    waivers: ["death", "family_death", "schedule_change"],
  },

  // --- saver: iade yok, değişiklik pahalı; yüzde + sabit birlikte (H → yükseği) ---
  {
    fareTypeId: "biz-saver",
    restriction: "X",
    change: { beforeDeparture: P(2000, "perTicket", { percent: 0.15, hiLo: "H", minimum: 1500 }) },
    waivers: ["death", "schedule_change"],
  },
  {
    fareTypeId: "eco-saver",
    restriction: "B", // ne iade ne değişiklik
    refund: { noShow: P(1500) },
    waivers: ["death", "schedule_change"],
  },
  {
    fareTypeId: "eco-promo",
    restriction: "B",
    // Promosyonda vergi bile bilette kalır (Cat 33 tax indicator "X").
    refund: { taxIndicator: "X", noShow: P(1500) },
    waivers: ["death"],
  },
];

const BY_ID = new Map(FARE_RULES.map((r) => [r.fareTypeId, r]));

export function fareRuleFor(fareTypeId?: string): FareRule | undefined {
  return fareTypeId ? BY_ID.get(fareTypeId) : undefined;
}

/** Kural iadeye izin veriyor mu? (kısıt X ya da B ise hayır) */
export function isFareRefundable(rule?: FareRule): boolean {
  return rule?.restriction !== "X" && rule?.restriction !== "B";
}

/** Kural değişikliğe izin veriyor mu? (kısıt N ya da B ise hayır) */
export function isFareChangeable(rule?: FareRule): boolean {
  return rule?.restriction !== "N" && rule?.restriction !== "B";
}

export interface PenaltyResult {
  amount: number;
  currency: string;
  /** Personele gösterilecek hesap gerekçesi. */
  explain: string;
  waived?: WaiverCode;
}

/**
 * Ceza tutarı. Sabit ve yüzde birlikte kodlanmışsa H/L göstergesine göre biri
 * seçilir (asla toplanmaz); minimum eşiği uygulanır. Yüzde ÇIPLAK ÜCRET
 * üzerinden hesaplanır.
 */
export function computePenalty(rule: PenaltyRule | undefined, baseFare: number, couponCount = 1): PenaltyResult | null {
  if (!rule) return null;
  const fixed = rule.amount;
  const pct = rule.percent != null ? baseFare * rule.percent : undefined;

  let value: number;
  let how: string;
  if (fixed != null && pct != null) {
    const takeHigh = (rule.hiLo ?? "H") === "H";
    value = takeHigh ? Math.max(fixed, pct) : Math.min(fixed, pct);
    how = `${takeHigh ? "yüksek" : "düşük"} olan: sabit ${fixed.toLocaleString("tr-TR")} ile çıplak ücretin %${(rule.percent! * 100).toFixed(0)}'i (${Math.round(pct).toLocaleString("tr-TR")}) arasından`;
  } else if (pct != null) {
    value = pct;
    how = `çıplak ücretin %${(rule.percent! * 100).toFixed(0)}'i`;
  } else {
    value = fixed ?? 0;
    how = "sabit tutar";
  }

  if (rule.minimum != null && value < rule.minimum) {
    value = rule.minimum;
    how += ` · minimum ${rule.minimum.toLocaleString("tr-TR")} uygulandı`;
  }

  // Uygulama tabanı: kupon başına ise kupon sayısıyla çarpılır.
  if (rule.base === "perCoupon") {
    value *= couponCount;
    how += ` · kupon başına (${couponCount} kupon)`;
  }

  return { amount: Math.round(value), currency: rule.currency, explain: how };
}

/** Muafiyet cezayı kaldırır mı? */
export function waives(rule: FareRule | undefined, waiver?: WaiverCode): boolean {
  if (!rule || !waiver) return false;
  return (rule.waivers ?? []).includes(waiver);
}

/** Ürünün kısa kural özeti — ücret seçiminde ve iade ekranında gösterilir. */
export function ruleSummary(rule: FareRule | undefined, currency = TRY_): string[] {
  if (!rule) return ["Kural yok — iade ve değişiklik ücretsiz."];
  const out: string[] = [];
  if (rule.restriction === "B") out.push("İade ve değişiklik yapılamaz.");
  else if (rule.restriction === "X") out.push("İade edilemez (yalnız iade edilebilir vergiler geri verilir).");
  else if (rule.restriction === "N") out.push("Değiştirilemez.");

  const fmt = (p?: PenaltyRule) => {
    if (!p) return null;
    const parts: string[] = [];
    if (p.amount != null) parts.push(`${p.amount.toLocaleString("tr-TR")} ${p.currency}`);
    if (p.percent != null) parts.push(`%${(p.percent * 100).toFixed(0)}`);
    return parts.join(p.hiLo === "L" ? " / " : " veya ") + (p.hiLo ? ` (${p.hiLo === "H" ? "yüksek" : "düşük"} olan)` : "");
  };
  const rb = fmt(rule.refund?.beforeDeparture);
  const ra = fmt(rule.refund?.afterDeparture);
  const cb = fmt(rule.change?.beforeDeparture);
  const ca = fmt(rule.change?.afterDeparture);
  const ns = fmt(rule.refund?.noShow);
  if (rb || ra) out.push(`İade cezası: kalkıştan önce ${rb ?? "yok"}, sonra ${ra ?? "yok"}.`);
  if (cb || ca) out.push(`Değişiklik ücreti: kalkıştan önce ${cb ?? "yok"}, sonra ${ca ?? "yok"}.`);
  if (ns) out.push(`No-show ücreti: ${ns}.`);
  if (rule.refund?.taxIndicator === "X") out.push("Vergiler de iade edilmez (kural gereği bilette kalır).");
  if (rule.change?.ticketType === "A") out.push("Değişiklik reissue gerektirir; revalidation yetmez.");
  if (rule.waivers?.length) out.push(`Muafiyet: ${rule.waivers.map(waiverLabel).join(", ")}.`);
  void currency;
  return out;
}

export function waiverLabel(w: WaiverCode): string {
  return {
    death: "vefat", illness: "hastalık", family_death: "yakının vefatı",
    family_illness: "yakının hastalığı", schedule_change: "tarife değişikliği", upgrade: "upgrade",
  }[w];
}

/** Para birimi taşıyan yardımcı — ekranda Money bileşenine verilir. */
export function penaltyMoney(p: PenaltyResult | null): Money | null {
  return p ? { amount: p.amount, currency: p.currency } : null;
}
