import { airportByCode } from "./airports";
import { greatCircleKm } from "./geo";

/* ====================================================================
   Yolcu hakları — iptal, rötar ve biniş reddinde tazminat.

   Üç rejim, üç kaynak:
   · EU261 (Tüzük 261/2004, md. 4–7): AB/AEA/İsviçre'den KALKAN her uçuş;
     AB DIŞINDAN AB'ye gelen uçuşta yalnız AB taşıyıcısı. Tutar büyük daire
     mesafesine göre €250 / €400 / €600. Varışta ≥3 saat rötar iptalle aynı
     muameleyi görür (ABAD — Sturgeon). Olağanüstü hâlde tazminat yok.
   · SHY-YOLCU (Türkiye, 10.12.2024 değişikliği): Türkiye'den kalkan her
     uçuş; Türkiye'ye gelen uçuşta Türk taşıyıcısı. İç hat €100, dış hat
     €250 / €400 / €600; ödeme günündeki TCMB satış kuruyla TL. Teknik ya da
     operasyonel nedenli ≥3 saat varış rötarı da tazminat doğurur.
   · UK261: Birleşik Krallık'tan kalkan her uçuş; UK'e gelen uçuşta UK/AB
     taşıyıcısı. £220 / £350 / £520.

   Bantlar: ≤1500 km · 1500–3500 km (AB içi >1500 km de bu bant) · >3500 km.
   %50 indirim (md. 7(2)): alternatif uçuşla varış gecikmesi bant eşiğini
   (2 / 3 / 4 saat) aşmıyorsa; uzun mesafede 3–4 saatlik rötarda da.
   İptal bildirimi: ≥14 gün önce haber verildiyse tazminat yok; 7–13 gün
   önce ve alternatif ≤2 saat erken kalkıp <4 saat geç varıyorsa yok; <7 gün
   önce ve alternatif ≤1 saat erken kalkıp <2 saat geç varıyorsa yok.

   Bu bir KARAR DESTEĞİDİR: olağanüstü hâl değerlendirmesi personelin
   girdisidir; sonuç ödeme talimatı değil, hak ediş önizlemesidir.
   ==================================================================== */

export type Regime = "EU261" | "SHY" | "UK261";
export type DisruptionKind = "cancellation" | "delay" | "denied_boarding";

/** AB/AEA ve İsviçre — EU261 kapsamı. */
const EU_EEA_CH = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT",
  "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "NO", "IS", "LI", "CH",
]);
/** AB taşıyıcıları (demo alt kümesi). */
const EU_CARRIERS = new Set(["LH", "AF", "KL", "OS", "LX", "SN", "IB", "AZ", "SK", "LO", "TP", "EI", "A3", "FR", "U2"]);
const UK_CARRIERS = new Set(["BA", "VS", "U2", "LS"]);
/** Türk taşıyıcıları (SHY-YOLCU). */
const TR_CARRIERS = new Set(["TK", "PC", "VF", "XQ"]);

export interface DisruptionInput {
  origin: string;
  destination: string;
  /** Uçuşu fiilen işleten taşıyıcı (kapsam buna bakar). */
  operatingCarrier: string;
  kind: DisruptionKind;
  /** Son varış noktasına varıştaki gecikme (dakika). Rötar ve reroute için. */
  arrivalDelayMin: number;
  /** İptalde: yolcuya kaç gün önce haber verildi. */
  noticeDays?: number;
  /** İptalde önerilen alternatif: planlanandan kaç dk erken kalkıyor / kaç dk geç varıyor. */
  reroute?: { departEarlierMin: number; arriveLaterMin: number };
  /** Hava, hava trafik kontrolü, güvenlik, grev (taşıyıcı dışı) … — personelin kararı. */
  extraordinary: boolean;
}

export interface RegimeResult {
  regime: Regime;
  applies: boolean;
  /** Kapsam ya da muafiyet gerekçesi (TR). */
  reason: string;
  reasonEn: string;
  amount: number;
  currency: "EUR" | "GBP";
  reduced: boolean;
  band: 1 | 2 | 3;
}

export interface CareEntitlement {
  meals: boolean;
  hotel: boolean;
  /** 5 saati aşan rötarda yolcu uçmaktan vazgeçip bilet bedelini geri alabilir. */
  refundOption: boolean;
}

export interface RightsAssessment {
  distanceKm?: number;
  domesticTr: boolean;
  intraEu: boolean;
  regimes: RegimeResult[];
  care: CareEntitlement;
}

function countryOf(code: string): string | undefined {
  return airportByCode(code)?.countryCode;
}

/** Mesafe bandı: 1 ≤1500 · 2 1500–3500 (ya da AB içi >1500) · 3 >3500. */
export function bandOf(km: number, intraEu: boolean): 1 | 2 | 3 {
  if (km <= 1500) return 1;
  if (intraEu || km <= 3500) return 2;
  return 3;
}

const BAND_THRESHOLD_MIN = { 1: 120, 2: 180, 3: 240 } as const;

/** İptalde bildirim ve alternatif uçuşa göre muafiyet (EU261 md. 5(1)(c)). */
function cancellationExempt(i: DisruptionInput): { exempt: boolean; tr: string; en: string } {
  const n = i.noticeDays ?? 0;
  const r = i.reroute;
  if (n >= 14) return { exempt: true, tr: "İptal en az 14 gün önce bildirilmiş.", en: "Cancellation notified at least 14 days in advance." };
  if (n >= 7 && r && r.departEarlierMin <= 120 && r.arriveLaterMin < 240)
    return { exempt: true, tr: "7–13 gün önce bildirilmiş; alternatif ≤2 sa erken kalkıp <4 sa geç varıyor.", en: "Notified 7–13 days ahead; the alternative departs ≤2h earlier and arrives <4h later." };
  if (n < 7 && r && r.departEarlierMin <= 60 && r.arriveLaterMin < 120)
    return { exempt: true, tr: "7 günden kısa bildirim; alternatif ≤1 sa erken kalkıp <2 sa geç varıyor.", en: "Less than 7 days' notice; the alternative departs ≤1h earlier and arrives <2h later." };
  return { exempt: false, tr: "", en: "" };
}

function scopeOf(regime: Regime, i: DisruptionInput): { in: boolean; tr: string; en: string } {
  const from = countryOf(i.origin);
  const to = countryOf(i.destination);
  const cx = i.operatingCarrier.toUpperCase();
  if (regime === "EU261") {
    if (from && EU_EEA_CH.has(from)) return { in: true, tr: "AB/AEA'dan kalkış — her taşıyıcı kapsamda.", en: "Departure from the EU/EEA — every carrier is covered." };
    if (to && EU_EEA_CH.has(to) && EU_CARRIERS.has(cx)) return { in: true, tr: "AB'ye varış, AB taşıyıcısı.", en: "Arrival in the EU on an EU carrier." };
    return { in: false, tr: to && EU_EEA_CH.has(to) ? `AB dışından AB'ye varış ama ${cx} AB taşıyıcısı değil.` : "Rota AB'ye dokunmuyor.", en: to && EU_EEA_CH.has(to) ? `Arrival in the EU from outside, but ${cx} is not an EU carrier.` : "The route does not touch the EU." };
  }
  if (regime === "UK261") {
    if (from === "GB") return { in: true, tr: "Birleşik Krallık'tan kalkış — her taşıyıcı kapsamda.", en: "Departure from the UK — every carrier is covered." };
    if (to === "GB" && (UK_CARRIERS.has(cx) || EU_CARRIERS.has(cx))) return { in: true, tr: "UK'e varış, UK/AB taşıyıcısı.", en: "Arrival in the UK on a UK/EU carrier." };
    return { in: false, tr: to === "GB" ? `UK'e varış ama ${cx} UK/AB taşıyıcısı değil.` : "Rota Birleşik Krallık'a dokunmuyor.", en: to === "GB" ? `Arrival in the UK, but ${cx} is not a UK/EU carrier.` : "The route does not touch the UK." };
  }
  if (from === "TR") return { in: true, tr: "Türkiye'den kalkış — her taşıyıcı kapsamda.", en: "Departure from Türkiye — every carrier is covered." };
  if (to === "TR" && TR_CARRIERS.has(cx)) return { in: true, tr: "Türkiye'ye varış, Türk taşıyıcısı.", en: "Arrival in Türkiye on a Turkish carrier." };
  return { in: false, tr: to === "TR" ? `Türkiye'ye varış ama ${cx} Türk taşıyıcısı değil.` : "Rota Türkiye'ye dokunmuyor.", en: to === "TR" ? `Arrival in Türkiye, but ${cx} is not a Turkish carrier.` : "The route does not touch Türkiye." };
}

const AMOUNTS: Record<Regime, Record<1 | 2 | 3, number>> = {
  EU261: { 1: 250, 2: 400, 3: 600 },
  SHY: { 1: 250, 2: 400, 3: 600 },
  UK261: { 1: 220, 2: 350, 3: 520 },
};

export function assessRights(i: DisruptionInput): RightsAssessment {
  const km = greatCircleKm(i.origin, i.destination);
  const from = countryOf(i.origin);
  const to = countryOf(i.destination);
  const intraEu = !!from && !!to && EU_EEA_CH.has(from) && EU_EEA_CH.has(to);
  const domesticTr = from === "TR" && to === "TR";
  const band = bandOf(km ?? 0, intraEu);

  // Bakım hakkı (md. 6 / 9) — rötar bant eşiğini aşınca; 5 saatte iade seçeneği.
  const care: CareEntitlement = {
    meals: i.kind !== "denied_boarding" ? i.arrivalDelayMin >= BAND_THRESHOLD_MIN[band] : true,
    hotel: i.arrivalDelayMin >= 8 * 60,
    refundOption: i.kind === "cancellation" || i.arrivalDelayMin >= 5 * 60,
  };

  const regimes: RegimeResult[] = (["SHY", "EU261", "UK261"] as Regime[]).map((regime) => {
    const currency = regime === "UK261" ? "GBP" : "EUR";
    const base: RegimeResult = { regime, applies: false, reason: "", reasonEn: "", amount: 0, currency, reduced: false, band };
    const scope = scopeOf(regime, i);
    if (!scope.in) return { ...base, reason: scope.tr, reasonEn: scope.en };
    if (km === undefined) return { ...base, reason: "Mesafe hesaplanamadı (havalimanı koordinatı yok).", reasonEn: "Distance unknown (no airport coordinates)." };

    if (i.extraordinary && i.kind !== "denied_boarding")
      return { ...base, reason: "Olağanüstü hâl — tazminat yok; bakım ve alternatif/iade hakkı sürer.", reasonEn: "Extraordinary circumstances — no compensation; care and rerouting/refund rights remain." };
    if (i.kind === "delay" && i.arrivalDelayMin < 180)
      return { ...base, reason: "Varış rötarı 3 saatin altında — tazminat eşiği aşılmadı.", reasonEn: "Arrival delay under 3 hours — compensation threshold not reached." };
    if (i.kind === "cancellation") {
      const ex = cancellationExempt(i);
      if (ex.exempt) return { ...base, reason: ex.tr, reasonEn: ex.en };
    }

    let amount = regime === "SHY" && domesticTr ? 100 : AMOUNTS[regime][band];
    // %50 indirim: alternatifle varış gecikmesi bant eşiğinde kaldıysa; uzun
    // mesafede 3–4 saatlik rötar da aynı indirimi alır.
    const late = i.kind === "cancellation" || i.kind === "denied_boarding" ? i.reroute?.arriveLaterMin : i.arrivalDelayMin;
    const reduced = !(regime === "SHY" && domesticTr) && late !== undefined && (
      (i.kind !== "delay" && late <= BAND_THRESHOLD_MIN[band]) ||
      (i.kind === "delay" && band === 3 && late < 240)
    );
    if (reduced) amount = amount / 2;
    const why = i.kind === "denied_boarding" ? "İstem dışı biniş reddi." : i.kind === "delay" ? "Varış rötarı 3 saati aştı." : "İptal, muafiyet koşulları oluşmadı.";
    const whyEn = i.kind === "denied_boarding" ? "Involuntary denied boarding." : i.kind === "delay" ? "Arrival delay exceeded 3 hours." : "Cancellation; no exemption applies.";
    return {
      ...base, applies: true, amount, reduced,
      reason: `${scope.tr} ${why}${reduced ? " Alternatifle gecikme bant eşiğinde kaldığı için %50 indirimli." : ""}`,
      reasonEn: `${scope.en} ${whyEn}${reduced ? " Reduced by 50% because the delay stayed within the band threshold." : ""}`,
    };
  });

  return { distanceKm: km, domesticTr, intraEu, regimes, care };
}

/**
 * Yolcunun alacağı tek tutar: aynı olay için birden çok rejim kapsıyorsa
 * tazminat MÜKERRER ödenmez — en yükseği esas alınır (EUR karşılaştırması).
 */
export function payableRegime(a: RightsAssessment, gbpToEur = 1.17): RegimeResult | undefined {
  const live = a.regimes.filter((r) => r.applies);
  if (!live.length) return undefined;
  return live.reduce((best, r) => {
    const eur = (x: RegimeResult) => (x.currency === "GBP" ? x.amount * gbpToEur : x.amount);
    return eur(r) > eur(best) ? r : best;
  });
}
