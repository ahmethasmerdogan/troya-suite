// ===== Ücret Tarifesi (Fare Quote) — mock pricing motoru =====
// Bilet müdürlerinin geri bildirimi (2026-07-12): personel bilet ücretini ELLE GİRMEZ.
// Tarih + güzergâh + yolcu bilgisi girilince SİSTEM bir ücret tarifesi üretir; personel
// bilet tipine ve seçilen duruma göre bir ücret SEÇER (yüksek ücret → esnek kurallar + iyi
// koltuk hakkı; düşük ücret → kısıtlı). RBD / Fare Basis ("TK kodu") otomatik oluşur.
//
// Pricing motoru mimaride KAPSAM DIŞI (ARCHITECTURE: "port arkasında mock"). Bu dosya o
// portun frontend mock'ıdır — backend geldiğinde GET /fares/quote'a bağlanır (F4 FareQuotePort).
// Deterministik: aynı güzergâh + kabin → her zaman aynı tarife (Math.random YOK).

import type { Money, TaxFeeCharge } from "./types";
import { FARE_TYPES, type FareType, type CabinName } from "./fareTypes";
import { airportByCode } from "./airports";

export interface FareOffer {
  id: string;
  fareType: FareType;
  cabin: CabinName;
  rbd: string;
  fareBasis: string;
  baseFare: Money;
  totalTfc: Money;
  total: Money;
  tfcs: TaxFeeCharge[];
  refundable: boolean;
  changeable: boolean;
  /** Koltuk seçimi ücretsiz mi (esnek ücretlerde tüm kabin; ucuzlarda ücretli/EMD). */
  seatSelection: "included" | "paid";
  /** Personele gösterilecek koltuk hakkı özeti. */
  seatNote: string;
  /** Bagaj hakkı (kg) — checked baggage. */
  baggageKg: number;
  cabinBaggageKg: number;
  /** Mil/statü kazanımı yüzdesi (esnek ücret daha çok kazandırır). */
  milesPct: number;
  /** Bu fiyattan kalan koltuk (aciliyet + "bazı koltuklara alabiliyoruz" mantığı). */
  seatsLeft: number;
  /** Sistemin önerdiği dengeli seçenek. */
  recommended: boolean;
  note: string;
}

export interface QuoteLeg {
  origin: string;
  destination: string;
}
export interface QuoteInput {
  legs: QuoteLeg[];
  /** İleride yolcu sayısı/tipi çarpanı için — şimdilik 1. */
  passengers?: number;
  /** Seçilen uçuşun talep/sezon çarpanı (uçuş listesiyle fiyat tutarlılığı için). */
  demandFactor?: number;
}

// Deterministik string hash (kod-çiftinden sözde-mesafe/koltuk türetmek için).
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// İki havalimanı arası sözde-mesafe (km). Koordinat yok → kod hash'i + yurtiçi/dışı tier.
function legDistanceKm(origin: string, destination: string): number {
  const o = airportByCode(origin);
  const d = airportByCode(destination);
  const domestic = o?.countryCode === "TR" && d?.countryCode === "TR";
  const h = hash([origin, destination].sort().join(">"));
  return domestic ? 350 + (h % 1100) : 1500 + (h % 8000);
}

// Mesafeye göre km başı TRY (uzun mesafede km birim ucuzlar).
function perKm(distanceKm: number): number {
  if (distanceKm < 1500) return 9.5;
  if (distanceKm < 4000) return 6.2;
  return 4.1;
}

const CABIN_MULT: Record<CabinName, number> = { Economy: 1, Premium: 1.9, Business: 3.4 };

// Bilet ailesi çarpanı (kabin-içi; Flex tam ücret, ucuzlar kademeli iner).
const FAMILY_MULT: Record<string, number> = {
  "biz-flex": 1.0, "biz-classic": 0.8, "biz-saver": 0.62,
  "prem-flex": 1.0, "prem-classic": 0.75,
  "eco-flex": 1.0, "eco-classic": 0.7, "eco-saver": 0.55, "eco-promo": 0.45,
};

// Bagaj hakkı (kg) bilet ailesine göre.
const BAGGAGE_KG: Record<string, number> = {
  "biz-flex": 40, "biz-classic": 40, "biz-saver": 32,
  "prem-flex": 30, "prem-classic": 25,
  "eco-flex": 30, "eco-classic": 25, "eco-saver": 20, "eco-promo": 15,
};

const round = (n: number, step: number) => Math.round(n / step) * step;

/** Güzergâh toplam sözde-mesafesi (km) — uçuş süresi/fiyat için ortak kaynak. */
export function routeDistanceKm(legs: QuoteLeg[]): number {
  return legs.filter((l) => l.origin && l.destination).reduce((sum, l) => sum + legDistanceKm(l.origin, l.destination), 0);
}

function offerFor(ft: FareType, distanceKm: number, legs: number, demandFactor: number): FareOffer {
  const ecoRef = distanceKm * perKm(distanceKm); // ekonomi referans fiyatı (tek bacak)
  const familyMult = FAMILY_MULT[ft.id] ?? 1;
  const baseOneLeg = ecoRef * CABIN_MULT[ft.cabin] * familyMult;
  const base = round(baseOneLeg * legs * demandFactor, 100);

  // TFC — havaalanı/devlet vergileri + taşıyıcı ücreti (deterministik breakdown).
  const domesticish = distanceKm < 1500;
  const trTax = round((domesticish ? 120 : 520) * legs, 10); // çıkış/güvenlik vergisi
  const yqFee = round(base * 0.045, 10); // taşıyıcı ek ücreti (YQ)
  const totalTfcAmt = trTax + yqFee;
  const cur = "TRY";
  const tfcs: TaxFeeCharge[] = [
    { code: "TR", amount: { amount: trTax, currency: cur } },
    { code: "YQ", amount: { amount: yqFee, currency: cur } },
  ];
  const total = base + totalTfcAmt;

  const flexish = ft.id.endsWith("-flex");
  const classicish = ft.id.endsWith("-classic");
  const seatSelection: "included" | "paid" = flexish || classicish ? "included" : "paid";
  const seatNote = flexish
    ? "Tüm kabin — ön sıra & ekstra diz mesafesi dahil"
    : classicish
      ? "Standart koltuk ücretsiz seçilir"
      : "Koltuk seçimi ücretli (EMD ile)";
  const milesPct = flexish ? (ft.cabin === "Business" ? 150 : 125) : classicish ? 100 : ft.id.endsWith("-saver") ? 70 : 50;

  // Kalan koltuk: ucuz ücretlerde daha az (aciliyet). Deterministik.
  const cap = flexish ? 9 : classicish ? 6 : ft.id.endsWith("-saver") ? 3 : 2;
  const seatsLeft = 1 + (hash(ft.id + distanceKm) % cap);

  return {
    id: ft.id,
    fareType: ft,
    cabin: ft.cabin,
    rbd: ft.rbd,
    fareBasis: ft.fareBasis,
    baseFare: { amount: base, currency: cur },
    totalTfc: { amount: totalTfcAmt, currency: cur },
    total: { amount: total, currency: cur },
    tfcs,
    refundable: ft.refundable,
    changeable: ft.changeable,
    seatSelection,
    seatNote,
    baggageKg: BAGGAGE_KG[ft.id] ?? 20,
    cabinBaggageKg: ft.cabin === "Business" ? 8 : 8,
    milesPct,
    seatsLeft,
    recommended: ft.id === "eco-classic", // dengeli varsayılan öneri
    note: ft.note,
  };
}

const CABIN_ORDER: CabinName[] = ["Business", "Premium", "Economy"];

/**
 * Ücret tarifesini SENKRON üretir (uçuş listesi "from" fiyatı için de kullanılır).
 * Her bilet ailesi için bir teklif; kabine göre gruplanır, kabin-içi pahalıdan ucuza sıralanır.
 */
export function computeFareOffers(legs: QuoteLeg[], demandFactor = 1): FareOffer[] {
  const valid = legs.filter((l) => l.origin && l.destination);
  if (valid.length === 0) return [];
  const distanceKm = routeDistanceKm(valid);
  const offers = FARE_TYPES.map((ft) => offerFor(ft, distanceKm, valid.length, demandFactor));
  return offers.sort((a, b) => {
    const ci = CABIN_ORDER.indexOf(a.cabin) - CABIN_ORDER.indexOf(b.cabin);
    if (ci !== 0) return ci;
    return b.total.amount - a.total.amount; // kabin içinde yüksek → düşük
  });
}

/** Bir kabinin en ucuz (from) toplam fiyatı — uçuş listesi kartlarında gösterilir. */
export function cheapestTotal(legs: QuoteLeg[], cabin: CabinName, demandFactor = 1): Money | null {
  const offers = computeFareOffers(legs, demandFactor).filter((o) => o.cabin === cabin);
  if (offers.length === 0) return null;
  return offers.reduce((min, o) => (o.total.amount < min.total.amount ? o : min)).total;
}

/** Async sarmalayıcı — "sunucu" gecikmesiyle (ücret seçimi adımı bunu kullanır). */
export async function quoteFares(input: QuoteInput): Promise<FareOffer[]> {
  await new Promise((r) => setTimeout(r, 420)); // "sunucu" tarife hesaplıyor
  return computeFareOffers(input.legs, input.demandFactor ?? 1);
}
