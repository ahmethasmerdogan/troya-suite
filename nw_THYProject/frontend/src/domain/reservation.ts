// QuickRes — Rezervasyon domaini (PNR + availability). Mock; backend gelince REST'e bağlanır.
// PNR (Passenger Name Record) → Troya'da bilet kesimine kaynak olur (PNR→ticket linkage).
import { shiftFixture } from "./demoClock";
import type { Passenger } from "./types";

export type PnrStatus = "active" | "ticketed" | "cancelled";
export type ReservationStatus = "HK" | "HL" | "TK" | "HN" | "UN"; // booking status (HK=confirmed)

export interface ReservationSegment {
  origin: string;
  destination: string;
  carrier: string;
  flightNumber: string;
  rbd: string; // booking class
  departure: string; // ISO
  arrival: string;
  status: ReservationStatus;
}

export interface Pnr {
  recordLocator: string; // 6 karakter (örn. XQ7T2M)
  passengers: Passenger[];
  segments: ReservationSegment[];
  createdAt: string;
  status: PnrStatus;
  contact?: string;
  ticketNumbers: string[]; // kesilmiş biletler (Troya linkage)
  /** Bileti kesilmiş yolcular ("SOYAD/AD") — her yolcuya ayrı ET (Handbook 2.3). */
  ticketedPax?: string[];
  /** Ticketing Time Limit (SSR ADTK) — bu tarihe kadar bilet kesilmezse rezervasyon düşer. */
  ttl?: string;
}

export interface PnrSummary {
  recordLocator: string;
  passengerName: string;
  route: string;
  createdAt: string;
  status: PnrStatus;
  segmentCount: number;
  ttl?: string;
  /** Yolcu sayısı ve bileti kesilmiş olanlar — kısmi kesim listede görünsün. */
  paxCount: number;
  ticketedCount: number;
}

// ---- Ticketing Time Limit (TTL / ADTK) — sektör standardı: süresinde bilet kesilmeyen
// rezervasyon uyarı kuyruğuna düşer, sonra iptal edilir. Yalnız 'active' PNR'da anlamlı. ----
export type TtlState =
  | { kind: "none" }
  | { kind: "ok" | "warning" | "expired"; ttl: string; hoursLeft: number };

export function ttlState(p: { status: PnrStatus; ttl?: string }, nowMs: number = Date.now()): TtlState {
  if (p.status !== "active" || !p.ttl) return { kind: "none" };
  const left = (new Date(p.ttl).getTime() - nowMs) / 3_600_000;
  if (left <= 0) return { kind: "expired", ttl: p.ttl, hoursLeft: 0 };
  return { kind: left <= 24 ? "warning" : "ok", ttl: p.ttl, hoursLeft: Math.floor(left) };
}

// Availability — bir O/D/tarih için uçuş seçenekleri (shopping/inventory mock; kapsam dışı motor).
export interface FareClass {
  rbd: string;
  available: number; // koltuk
  fareFrom: { amount: number; currency: string };
  cabin: "Economy" | "Business";
}
export interface FlightOption {
  carrier: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
  durationMin: number;
  classes: FareClass[];
}

// ---- mock store ----
const MOCK_PNRS: Pnr[] = [
  {
    recordLocator: "XQ7T2M",
    passengers: [{ surname: "ERDOGAN", givenName: "AHMET", title: "MR" }],
    segments: [
      { origin: "IST", destination: "NRT", carrier: "TK", flightNumber: "TK198", rbd: "C", departure: "2026-06-05T01:55:00Z", arrival: "2026-06-05T20:25:00Z", status: "HK" },
      { origin: "NRT", destination: "IST", carrier: "TK", flightNumber: "TK199", rbd: "C", departure: "2026-06-19T22:10:00Z", arrival: "2026-06-20T05:30:00Z", status: "HK" },
    ],
    createdAt: "2026-05-30T10:00:00Z",
    status: "ticketed",
    contact: "+90 532 000 00 00",
    ticketNumbers: ["2351234567890"],
    ticketedPax: ["ERDOGAN/AHMET"],
  },
  {
    recordLocator: "LM4K9Z",
    passengers: [{ surname: "YILMAZ", givenName: "ELIF", title: "MS" }],
    segments: [
      { origin: "IST", destination: "FRA", carrier: "TK", flightNumber: "TK1591", rbd: "Y", departure: "2026-06-14T07:20:00Z", arrival: "2026-06-14T10:05:00Z", status: "HK" },
      { origin: "FRA", destination: "JFK", carrier: "LH", flightNumber: "LH400", rbd: "Y", departure: "2026-06-14T13:30:00Z", arrival: "2026-06-14T16:25:00Z", status: "HK" },
    ],
    createdAt: "2026-06-09T09:30:00Z",
    status: "ticketed",
    ticketNumbers: ["2359988776655"],
    ticketedPax: ["YILMAZ/ELIF"],
  },
  {
    recordLocator: "TR8N1P",
    passengers: [{ surname: "DEMIR", givenName: "CAN", title: "MR" }, { surname: "DEMIR", givenName: "AYSE", title: "MRS" }],
    segments: [
      { origin: "IST", destination: "AYT", carrier: "TK", flightNumber: "TK2410", rbd: "Y", departure: "2026-06-20T06:00:00Z", arrival: "2026-06-20T07:15:00Z", status: "HK" },
    ],
    createdAt: "2026-06-12T14:20:00Z",
    status: "active", // henüz biletlenmemiş
    ticketNumbers: [],
    ttl: new Date(Date.now() + 6 * 3_600_000).toISOString(), // 6 saat — TTL uyarısı
  },
  {
    recordLocator: "KQ5B7X",
    passengers: [{ surname: "OZTURK", givenName: "SELIN", title: "MS" }],
    segments: [
      { origin: "IST", destination: "LHR", carrier: "TK", flightNumber: "TK21", rbd: "Y", departure: "2026-07-20T08:40:00Z", arrival: "2026-07-20T10:55:00Z", status: "HK" },
    ],
    createdAt: "2026-06-16T11:00:00Z", // fixture günü (18 Haz) öncesi — ileri tarihli kayıt olmasın
    status: "active",
    ticketNumbers: [],
    ttl: new Date(Date.now() - 5 * 3_600_000).toISOString(), // 5 saat önce DOLDU — kuyruğa düşer
  },
];

// Demo saati: oluşturma ve sefer tarihleri bugüne kayar; TTL zaten şimdiye göre yazıldı.
shiftFixture(MOCK_PNRS, ["ttl"]);

let rlCounter = 0;
const RL_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genRecordLocator(seed: number): string {
  // deterministik (Math.random kullanılamaz); seed'den üret
  let s = "";
  let n = seed * 2654435761;
  for (let i = 0; i < 6; i++) {
    s += RL_CHARS[Math.abs(n) % RL_CHARS.length];
    n = Math.floor(n / 7) + (i + 1) * 131;
  }
  return s;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function summary(p: Pnr): PnrSummary {
  return {
    recordLocator: p.recordLocator,
    passengerName: `${p.passengers[0].surname}/${p.passengers[0].givenName}` + (p.passengers.length > 1 ? ` +${p.passengers.length - 1}` : ""),
    route: [p.segments[0]?.origin, ...p.segments.map((s) => s.destination)].filter(Boolean).join(" → "),
    createdAt: p.createdAt,
    status: p.status,
    segmentCount: p.segments.length,
    ttl: p.ttl,
    paxCount: p.passengers.length,
    ticketedCount: p.ticketedPax?.length ?? 0,
  };
}

export async function listPnrs(): Promise<PnrSummary[]> {
  await delay(220);
  return MOCK_PNRS.map(summary);
}

export async function searchPnrs(query: string): Promise<PnrSummary[]> {
  await delay(200);
  const q = query.trim().toUpperCase();
  if (!q) return MOCK_PNRS.map(summary);
  return MOCK_PNRS.filter(
    (p) =>
      p.recordLocator.includes(q) ||
      p.passengers.some((pax) => pax.surname.toUpperCase().includes(q) || pax.givenName.toUpperCase().includes(q)) ||
      p.segments.some((s) => s.origin === q || s.destination === q),
  ).map(summary);
}

export async function getPnr(recordLocator: string): Promise<Pnr | undefined> {
  await delay(220);
  return MOCK_PNRS.find((p) => p.recordLocator === recordLocator);
}

/**
 * PNR → bilet bağı (linkage).
 *
 * Bilet kesildiğinde rezervasyon "biletlendi" olur: doküman numarası PNR'a
 * yazılır ve TTL (ADTK) düşer — süresi dolmuş sayılmaz. Bu, QuickRes ile
 * Troya arasındaki tek gerçek bağdır; olmadığında kesim rezervasyonu
 * güncellemez ve PNR süresiz "bilet bekliyor" görünür.
 */
/** Yolcu adı anahtarı — büyük harf, boşluksuz "SOYAD/AD". */
export function paxKey(p: { surname: string; givenName: string }): string {
  return `${p.surname}/${p.givenName}`.toUpperCase().replace(/\s+/g, "");
}

/** PNR'ı eşzamanlı oku (komut tarafı kontrolleri için). */
export function pnrByLocator(recordLocator: string): Pnr | undefined {
  return MOCK_PNRS.find((x) => x.recordLocator === recordLocator.toUpperCase());
}

/** Henüz bileti kesilmemiş yolcular — kesim formu bunların ilkiyle dolar. */
export function unticketedPassengers(p: Pnr): Passenger[] {
  const done = new Set(p.ticketedPax ?? []);
  return p.passengers.filter((x) => !done.has(paxKey(x)));
}

/**
 * Kesilen bileti PNR'a bağla. Her yolcu ayrı ET alır (Handbook 2.3); PNR ancak
 * TÜM yolcuları biletlenince "ticketed" olur ve kesim süre limiti (ADTK) düşer.
 * Önceden ilk bilet PNR'ı tamamen biletlenmiş sayıyordu: iki yolculu
 * rezervasyonda ikinci yolcunun TTL'i siliniyor, koltuğu süresiz tutuluyordu.
 */
export function attachTicketToPnr(
  recordLocator: string,
  ticketNumber: string,
  pax?: { surname: string; givenName: string },
): Pnr | undefined {
  const p = pnrByLocator(recordLocator);
  if (!p) return undefined;
  if (!p.ticketNumbers.includes(ticketNumber)) p.ticketNumbers.push(ticketNumber);
  if (pax) {
    const k = paxKey(pax);
    p.ticketedPax = [...new Set([...(p.ticketedPax ?? []), k])];
  }
  if (p.status === "active" && unticketedPassengers(p).length === 0) {
    p.status = "ticketed";
    p.ttl = undefined; // biletlendi → kesim süre limiti anlamsız
  }
  return p;
}

/**
 * Ad düzeltmesini PNR'a yansıt: bilet adı PNR'dakiyle birebir aynı kalmalı
 * (Handbook 2.3). Biletlenmiş yolcu kaydı da yeni adla taşınır.
 */
export function renamePnrPassenger(recordLocator: string, from: Passenger, to: Passenger): void {
  const p = pnrByLocator(recordLocator);
  if (!p) return;
  const k = paxKey(from);
  const i = p.passengers.findIndex((x) => paxKey(x) === k);
  if (i < 0) return;
  p.passengers[i] = { ...p.passengers[i], surname: to.surname, givenName: to.givenName, title: to.title ?? p.passengers[i].title };
  if (p.ticketedPax) p.ticketedPax = p.ticketedPax.map((x) => (x === k ? paxKey(to) : x));
}

export interface CreatePnrInput {
  passengers: Passenger[];
  segments: ReservationSegment[];
  contact?: string;
}
export async function createPnr(input: CreatePnrInput): Promise<Pnr> {
  await delay(600);
  const pnr: Pnr = {
    recordLocator: genRecordLocator(++rlCounter + MOCK_PNRS.length + 17),
    passengers: input.passengers,
    segments: input.segments,
    createdAt: new Date().toISOString(),
    status: "active",
    contact: input.contact,
    ticketNumbers: [],
    // Standart TTL: rezervasyondan 72 saat (SSR ADTK) — süresinde kesilmezse uyarı → iptal.
    ttl: new Date(Date.now() + 72 * 3_600_000).toISOString(),
  };
  MOCK_PNRS.unshift(pnr);
  return pnr;
}

// Availability mock — O/D/tarih için sabit üretilmiş uçuş listesi.
export async function getAvailability(origin: string, destination: string, _date: string): Promise<FlightOption[]> {
  await delay(360);
  const o = origin.toUpperCase(), d = destination.toUpperCase();
  const base = [
    { fn: "TK198", dep: "08:05", arr: "10:40", dur: 155 },
    { fn: "TK1991", dep: "13:20", arr: "15:55", dur: 155 },
    { fn: "TK2024", dep: "19:45", arr: "22:20", dur: 155 },
  ];
  return base.map((b, i) => ({
    carrier: "TK",
    flightNumber: b.fn,
    origin: o,
    destination: d,
    departure: `${_date}T${b.dep}:00`,
    arrival: `${_date}T${b.arr}:00`,
    durationMin: b.dur,
    classes: [
      { rbd: "Y", available: 9 - i, fareFrom: { amount: 4200 + i * 350, currency: "TRY" }, cabin: "Economy" as const },
      { rbd: "C", available: 4 - i, fareFrom: { amount: 12800 + i * 600, currency: "TRY" }, cabin: "Business" as const },
    ],
  }));
}
