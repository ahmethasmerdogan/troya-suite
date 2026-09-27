import type { Segment, Ticket } from "./types";
import { airportByCode } from "./airports";

/* ====================================================================
   Tarife değişikliği (schedule change) — toplu zorunlu işlem.

   Taşıyıcı bir seferin saatini değiştirince o seferde açık kuponu olan
   her bilet etkilenir. Sektör akışı (Amadeus SKCHG / Sabre Q5-Q6,
   Travelport durum kodları, THY 2023 duyurusu, US DOT 2024 iade kuralı):

   · Kuponun rezervasyon durumu HK → TK olur: "onaylı, yolcuya yeni saati
     bildir". Yolcu bilgilendirilince tekrar HK.
   · 15 dakikanın altındaki kayma KÜÇÜK değişikliktir — yalnız bildirim.
   · 15 dakika ve üstü ZORUNLU (involuntary) değişikliktir: yolcu yeni
     saati kabul edebilir, ücretsiz başka sefere geçebilir (ADC ve ceza
     yok, orijinal ücret korunur) ya da zorunlu iade alabilir (15.1.1.1).
     Bilete "INVOL SKCHG <sefer>/<tarih>" cirosu yazılır; sonraki değişiklik
     bu ciroyla ücretsiz işlenir.
   · İç hatta ≥3 saat, dış hatta ≥6 saat kayma ÖNEMLİ değişikliktir
     (US DOT 2024): yolcu uçmayı reddederse iade hakkı tartışmasızdır.
   ==================================================================== */

export type ChangeSeverity = "minor" | "involuntary" | "significant";

export const MINOR_MIN = 15;
export const SIGNIFICANT_DOMESTIC_MIN = 180;
export const SIGNIFICANT_INTL_MIN = 360;

export function isInternationalSegment(s: Pick<Segment, "origin" | "destination">): boolean {
  const a = airportByCode(s.origin)?.countryCode;
  const b = airportByCode(s.destination)?.countryCode;
  return !a || !b || a !== b;
}

export function classifyScheduleChange(minutes: number, international: boolean): ChangeSeverity {
  const m = Math.abs(minutes);
  if (m < MINOR_MIN) return "minor";
  return m >= (international ? SIGNIFICANT_INTL_MIN : SIGNIFICANT_DOMESTIC_MIN) ? "significant" : "involuntary";
}

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
/** "INVOL SKCHG TK1591/27SEP" — ciro kutusuna yazılan kısa metin. */
export function skchgEndorsement(flightNumber: string, departureIso: string): string {
  const d = new Date(departureIso);
  return `INVOL SKCHG ${flightNumber}/${String(d.getUTCDate()).padStart(2, "0")}${MON[d.getUTCMonth()]}`;
}

export interface ScheduledFlight {
  flightNumber: string;
  /** Kalkış günü (UTC, YYYY-MM-DD). */
  date: string;
  origin: string;
  destination: string;
  departure: string;
  /** Bu seferde açık kuponu olan bilet sayısı. */
  tickets: number;
}

const OPEN = new Set(["O", "A"]);

/** Seferin (numara + gün) açık kupon eşleşmesi. */
export function couponOnFlight(s: Segment, flightNumber: string, date: string): boolean {
  return s.flightNumber.toUpperCase() === flightNumber.toUpperCase() && s.departure.slice(0, 10) === date;
}

/** Gelecekte kalkan ve açık kuponu olan seferler — en kalabalık önce. */
export function upcomingFlights(tickets: Ticket[], now: number): ScheduledFlight[] {
  const map = new Map<string, ScheduledFlight>();
  for (const t of tickets) {
    for (const c of t.coupons) {
      if (!OPEN.has(c.status) || Date.parse(c.segment.departure) <= now) continue;
      const date = c.segment.departure.slice(0, 10);
      const k = `${c.segment.flightNumber}|${date}`;
      const hit = map.get(k);
      if (hit) hit.tickets += 1;
      else map.set(k, {
        flightNumber: c.segment.flightNumber, date, origin: c.segment.origin, destination: c.segment.destination,
        departure: c.segment.departure, tickets: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.tickets - a.tickets || Date.parse(a.departure) - Date.parse(b.departure));
}

export function affectedTickets(tickets: Ticket[], flightNumber: string, date: string): Ticket[] {
  return tickets.filter((t) => t.coupons.some((c) => OPEN.has(c.status) && couponOnFlight(c.segment, flightNumber, date)));
}
