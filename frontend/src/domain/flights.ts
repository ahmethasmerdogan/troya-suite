// ===== Uçuş Programı / Availability — mock =====
// Bilet müdürü geri bildirimi (2026-07-12): personel UÇUŞ NUMARASINI da elle yazmaz.
// Güzergâh + tarih girilince sistem 3-4 GÜNLÜK bir uçuş listesi (TK sefer no + saatler +
// "from" fiyat) gösterir; personel bir uçuş SEÇER → sefer no, saat, taşıyıcı, fiyat otomatik.
// Rezervasyon/inventory mimaride KAPSAM DIŞI — bu, o portun deterministik mock'ı.
// Fiyatlar domain/pricing ile TUTARLI (aynı motor + uçuşun talep çarpanı).

import type { Money } from "./types";
import { cheapestTotal, routeDistanceKm } from "./pricing";

export interface FlightItem {
  id: string;
  flightNumber: string; // "TK198"
  carrier: string; // "TK"
  origin: string;
  destination: string;
  departure: string; // ISO
  arrival: string; // ISO
  durationMin: number;
  aircraft: string;
  /** Talep/sezon çarpanı — seçilince ücret adımına taşınır (fiyat tutarlılığı). */
  demandFactor: number;
  fromEconomy: Money | null;
  fromBusiness: Money | null;
  seatsLeft: number;
  /** Gün başlığı (gruplama) — "15 Tem Sal" gibi. */
  dayKey: string;
  dayLabel: string;
}

function hash(s: string): number {
  let h = 2166161;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
const pad = (n: number) => String(n).padStart(2, "0");

// Günlük sefer kalkış slotları (saat, dk, talep çarpanı) — sabah/akşam yoğun, öğle uygun.
const SLOTS = [
  { h: 7, m: 20, demand: 1.15 },
  { h: 11, m: 45, demand: 0.95 },
  { h: 16, m: 10, demand: 1.05 },
  { h: 20, m: 35, demand: 1.2 },
];

const WEEKDAYS_TR = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const MONTHS_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function aircraftFor(distanceKm: number): string {
  if (distanceKm < 1500) return "A321neo";
  if (distanceKm < 4500) return "A330-300";
  return "B777-300ER";
}

/**
 * Güzergâh için başlangıç tarihinden itibaren `days` günlük uçuş programını üretir.
 * Deterministik: aynı (güzergâh, tarih) → aynı liste.
 */
export function searchFlights(origin: string, destination: string, startDateISO?: string, days = 4): FlightItem[] {
  const o = origin?.toUpperCase(), d = destination?.toUpperCase();
  if (!o || !d || o.length !== 3 || d.length !== 3) return [];

  // Başlangıç tarihi (yalnız gün) — verilmezse bugün.
  const startStr = (startDateISO && startDateISO.slice(0, 10)) || new Date().toISOString().slice(0, 10);
  const [y, mo, da] = startStr.split("-").map(Number);
  if (!y || !mo || !da) return [];

  const legs = [{ origin: o, destination: d }];
  const distanceKm = routeDistanceKm(legs);
  const durationMin = Math.round((distanceKm / 800) * 60) + 35; // seyir + taxi/tırmanış
  const aircraft = aircraftFor(distanceKm);
  const routeH = hash(o + ">" + d);
  const routeJitter = 0.9 + (routeH % 20) / 100; // 0.90..1.09
  const flightBase = 100 + (routeH % 800); // TK1xx..TK8xx

  const out: FlightItem[] = [];
  for (let di = 0; di < days; di++) {
    const date = new Date(y, mo - 1, da + di);
    const yy = date.getFullYear(), mm = date.getMonth(), dd = date.getDate();
    const dayKey = `${yy}-${pad(mm + 1)}-${pad(dd)}`;
    const dayLabel = `${dd} ${MONTHS_TR[mm]} ${WEEKDAYS_TR[date.getDay()]}`;
    SLOTS.forEach((slot, si) => {
      const dep = new Date(yy, mm, dd, slot.h, slot.m);
      const arr = new Date(dep.getTime() + durationMin * 60000);
      const demandFactor = Math.min(1.3, Math.max(0.85, slot.demand * routeJitter));
      const flightNumber = `TK${flightBase + si}`;
      const seatsLeft = 1 + (hash(flightNumber + dayKey) % 40);
      out.push({
        id: `${flightNumber}-${dayKey}`,
        flightNumber,
        carrier: "TK",
        origin: o,
        destination: d,
        departure: dep.toISOString(),
        arrival: arr.toISOString(),
        durationMin,
        aircraft,
        demandFactor,
        fromEconomy: cheapestTotal(legs, "Economy", demandFactor),
        fromBusiness: cheapestTotal(legs, "Business", demandFactor),
        seatsLeft,
        dayKey,
        dayLabel,
      });
    });
  }
  return out;
}

/** Süreyi "2s 15d" biçiminde okunur yapar. */
export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}s ${pad(m)}d` : `${m}d`;
}
