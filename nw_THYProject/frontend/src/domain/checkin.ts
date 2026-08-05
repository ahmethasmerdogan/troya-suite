// QuickCheck-in — DCS (Departure Control) domaini. Mock.
// Check-in, ilgili bilet kuponunu Troya'da O→C'ye taşır (cross-modül linkage; api.setCouponStatus).

import { seatDenial } from "./seatRules";
import { airportByCode } from "./airports";
import {
  layoutFor, zoneOfRow, seatPosition, seatCount, configString, lastRow, type AircraftLayout,
  type CabinZone, type CabinClass,
} from "./aircraftLayout";
import { MOCK_TICKETS } from "./mockData";
import { generateTickets } from "./genTickets";

/**
 * Check-in yolcusuna GERÇEK bir bilet bağla.
 *
 * Üretilen yolculara rastgele 13 hane yazmak, "check-in kuponu O→C taşır"
 * vaadini sessizce boşa çıkarıyordu: numara hiçbir bilete denk gelmediği için
 * `advanceCouponStatus` hiçbir şey yapmadan dönüyordu. Artık numaralar açık
 * kuponu olan gerçek biletlerden seçilir.
 */
const LINKABLE = [...MOCK_TICKETS, ...generateTickets(30)]
  .filter((t) => t.coupons.some((c) => c.status === "O"))
  .map((t) => ({
    ticketNumber: t.ticketNumber,
    couponSeq: t.coupons.find((c) => c.status === "O")!.seq,
  }));

function pickRealTicket(rng: () => number, want: boolean): { ticketNumber?: string; couponSeq?: number } {
  if (!want || LINKABLE.length === 0) return {};
  return LINKABLE[Math.floor(rng() * LINKABLE.length)];
}

export type FlightStatus = "scheduled" | "checkin_open" | "boarding" | "departed" | "closed";
export type CheckinStatus = "not_checked" | "checked_in" | "boarded";

export interface Aircraft {
  type: string; // "Boeing 777-300ER"
  registration: string; // "TC-JJE"
  config: string; // "C49 / Y272" kabin yapılandırması
  rows: number;
  seatsPerRow: number;
}

export interface DepartureFlight {
  flightId: string;
  carrier: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departure: string; // ISO
  gate?: string;
  status: FlightStatus;
  capacity: number;
  checkedIn: number;
  aircraft: Aircraft;
}

export interface CheckinPassenger {
  id: string;
  surname: string;
  givenName: string;
  pnr: string;
  ticketNumber?: string;
  couponSeq?: number;
  cabin: "Economy" | "Business";
  status: CheckinStatus;
  seat?: string;
  bags: number;
  ff?: string; // frequent flyer
  sequenceNumber?: number; // boarding sequence
  nationalId?: string; // TC Kimlik No
  passport?: string; // pasaport no
  nationality?: string; // ISO-2
  apis?: boolean; // APIS (Advance Passenger Info) tamam mı
  /** IATA SSR kodları (Reso 1700) — koltuk uygunluk kuralları bunlara bakar (seatRules.ts). */
  ssr?: string[];
  /** Kucak bebeği ile seyahat (infant in connection with) — exit sırası kapalı. */
  infant?: boolean;
  /** 12 yaş altı — exit sırası kapalı. */
  child?: boolean;
}

export type Cabin = CabinClass;
export interface Seat {
  id: string; // "12A"
  row: number;
  col: string;
  occupied: boolean;
  cabin: Cabin;
  /** Acil çıkış sırası — kısıtlı yolcu oturamaz (EASA/DOT). */
  exit?: boolean;
  /** Kabin bölmesinin ilk sırası — önünde koltuk yok (PETC kafesi sığmaz). */
  bulkhead?: boolean;
  /** Pencere / koridor / orta — kural motoru ve arayüz okur. */
  position?: "window" | "aisle" | "middle";
  /** Kanat hizası — pencereden manzara kapalı. */
  overWing?: boolean;
  /** Yakınında lavabo var. */
  nearLavatory?: boolean;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Kalkış saatleri "şimdi"ye göre dinamik üretilir ki geri sayım/sıralama canlı görünsün.
const nowMs = Date.now();
const inMin = (m: number) => new Date(nowMs + m * 60000).toISOString();

export const FLIGHTS: DepartureFlight[] = [
  { flightId: "TK2410-D", carrier: "TK", flightNumber: "TK2410", origin: "IST", destination: "AYT", departure: inMin(28), gate: "A07", status: "boarding", capacity: 180, checkedIn: 168, aircraft: { type: "Boeing 737-800", registration: "TC-JFV", config: "C12 / Y156", rows: 30, seatsPerRow: 6 } },
  { flightId: "TK198-D", carrier: "TK", flightNumber: "TK198", origin: "IST", destination: "NRT", departure: inMin(55), gate: "215", status: "boarding", capacity: 300, checkedIn: 246, aircraft: { type: "Boeing 777-300ER", registration: "TC-JJE", config: "C18 / Y282", rows: 50, seatsPerRow: 6 } },
  { flightId: "TK21-D", carrier: "TK", flightNumber: "TK21", origin: "IST", destination: "LHR", departure: inMin(95), gate: "E05", status: "checkin_open", capacity: 180, checkedIn: 96, aircraft: { type: "Airbus A321neo", registration: "TC-LSA", config: "C16 / Y164", rows: 30, seatsPerRow: 6 } },
  { flightId: "TK1591-D", carrier: "TK", flightNumber: "TK1591", origin: "IST", destination: "FRA", departure: inMin(120), gate: "B12", status: "checkin_open", capacity: 180, checkedIn: 72, aircraft: { type: "Airbus A321neo", registration: "TC-LRA", config: "C16 / Y164", rows: 30, seatsPerRow: 6 } },
  { flightId: "TK6-D", carrier: "TK", flightNumber: "TK6", origin: "IST", destination: "JFK", departure: inMin(185), gate: "F08", status: "checkin_open", capacity: 350, checkedIn: 41, aircraft: { type: "Airbus A350-900", registration: "TC-LGA", config: "C32 / Y283", rows: 55, seatsPerRow: 6 } },
  { flightId: "TK2128-D", carrier: "TK", flightNumber: "TK2128", origin: "IST", destination: "ESB", departure: inMin(240), gate: "A21", status: "scheduled", capacity: 150, checkedIn: 0, aircraft: { type: "Boeing 737-800", registration: "TC-JGA", config: "C12 / Y126", rows: 25, seatsPerRow: 6 } },
  // Yakın-kalkış / kalkmış uçuşlar — HUB Kontrol board'unda final call / gate closed / departed çeşitliliği için.
  { flightId: "TK1986-D", carrier: "TK", flightNumber: "TK1986", origin: "IST", destination: "FRA", departure: inMin(12), gate: "D22", status: "boarding", capacity: 180, checkedIn: 176, aircraft: { type: "Airbus A321neo", registration: "TC-LTA", config: "C16 / Y164", rows: 30, seatsPerRow: 6 } },
  { flightId: "TK712-D", carrier: "TK", flightNumber: "TK712", origin: "IST", destination: "DXB", departure: inMin(6), gate: "C14", status: "boarding", capacity: 300, checkedIn: 289, aircraft: { type: "Boeing 777-300ER", registration: "TC-JJU", config: "C28 / Y272", rows: 50, seatsPerRow: 6 } },
  { flightId: "TK16-D", carrier: "TK", flightNumber: "TK16", origin: "IST", destination: "LAX", departure: inMin(-9), gate: "G03", status: "departed", capacity: 350, checkedIn: 338, aircraft: { type: "Airbus A350-900", registration: "TC-LGC", config: "C32 / Y283", rows: 55, seatsPerRow: 6 } },
];
/**
 * Kapasite ve kabin metni artık elle yazılmıyor: uçak tipinin düzeninden
 * türetilir. Önceden `capacity`, `config` metni ve haritadaki koltuk sayısı
 * üç ayrı sayı söylüyordu; check-in "168/180" derken harita 252 koltuk
 * çiziyordu.
 */
for (const f of FLIGHTS) {
  const layout = layoutFor(f.aircraft.type);
  f.capacity = seatCount(layout);
  f.aircraft.config = configString(layout);
  f.aircraft.rows = lastRow(layout);
  f.aircraft.seatsPerRow = Math.max(...layout.zones.map((z) => z.columns.filter(Boolean).length));
  // Kabul sayısı kapasiteyi aşmasın (elle yazılmış demo sayıları kırpılır).
  f.checkedIn = Math.min(f.checkedIn, f.capacity);
}

const PASSENGERS: Record<string, CheckinPassenger[]> = {
  "TK198-D": [
    { id: "p1", surname: "ERDOGAN", givenName: "AHMET", pnr: "XQ7T2M", ticketNumber: "2351234567890", couponSeq: 1, cabin: "Business", status: "not_checked", bags: 1, ff: "TK 233 445 566", nationalId: "12345678901", passport: "U07654321", nationality: "TR", apis: true },
    { id: "p2", surname: "TANAKA", givenName: "KENJI", pnr: "JJ22KK", cabin: "Economy", status: "checked_in", seat: "23C", bags: 2, sequenceNumber: 41, passport: "TK9981234", nationality: "JP", apis: true },
    { id: "p3", surname: "SMITH", givenName: "JOHN", pnr: "PP90AB", cabin: "Economy", status: "not_checked", bags: 0, passport: "557120098", nationality: "US", apis: false, ssr: ["WCHR"] },
    { id: "p8", surname: "KAYA", givenName: "MERVE", pnr: "XQ7T2M", cabin: "Business", status: "checked_in", seat: "3A", bags: 1, sequenceNumber: 12, nationalId: "23456789012", passport: "U08123456", nationality: "TR", apis: true },
    { id: "p9", surname: "WANG", givenName: "LEI", pnr: "CN44ZZ", cabin: "Economy", status: "not_checked", bags: 2, passport: "EJ7766554", nationality: "CN", apis: true, infant: true },
  ],
  "TK21-D": [
    { id: "p4", surname: "YILMAZ", givenName: "ELIF", pnr: "LM4K9Z", ticketNumber: "2359988776655", couponSeq: 1, cabin: "Economy", status: "not_checked", bags: 1, nationalId: "34567890123", passport: "U05551122", nationality: "TR", apis: true, ssr: ["PETC"] },
    { id: "p5", surname: "MUELLER", givenName: "HANS", pnr: "DE77QW", cabin: "Business", status: "checked_in", seat: "2A", bags: 1, sequenceNumber: 8, passport: "C01X9988", nationality: "DE", apis: true },
    { id: "p10", surname: "BROWN", givenName: "EMMA", pnr: "GB12MN", cabin: "Economy", status: "not_checked", bags: 1, passport: "509887766", nationality: "GB", apis: false, ssr: ["UMNR"], child: true },
  ],
  "TK2410-D": [
    { id: "p6", surname: "DEMIR", givenName: "CAN", pnr: "TR8N1P", cabin: "Economy", status: "boarded", seat: "14A", bags: 1, sequenceNumber: 120, nationalId: "45678901234", nationality: "TR", apis: true },
    { id: "p7", surname: "DEMIR", givenName: "AYSE", pnr: "TR8N1P", cabin: "Economy", status: "checked_in", seat: "14B", bags: 1, sequenceNumber: 121, nationalId: "56789012345", nationality: "TR", apis: true },
  ],
  "TK1591-D": [
    { id: "p11", surname: "SCHNEIDER", givenName: "PAUL", pnr: "DE90KL", cabin: "Economy", status: "not_checked", bags: 1, passport: "C09X1122", nationality: "DE", apis: true },
  ],
  "TK6-D": [
    { id: "p12", surname: "JOHNSON", givenName: "MARY", pnr: "US33PP", cabin: "Business", status: "not_checked", bags: 2, passport: "558901234", nationality: "US", apis: false, ssr: ["WCHC"] },
  ],
  "TK2128-D": [],
};

// ===== Deterministik yolcu üretimi =====
// El yazımı yolcular yukarıda korunur; her uçuş gerçekçi sayıda yolcuyla doldurulur ki
// PNR / TC kimlik / pasaport / ad / uçuş kodu / bilet ile arama HER ZAMAN sonuç döndürsün.
const FIRST = ["AHMET", "MERVE", "CAN", "ELIF", "DENIZ", "ZEYNEP", "EMRE", "BURAK", "SELIN", "KEREM", "NAZLI", "OZAN", "HANS", "MARIA", "JOHN", "EMMA", "LIU", "YUKI", "OMAR", "SARA", "PAOLO", "NINA", "IVAN", "ANNA", "FATMA", "MUSTAFA", "ECE", "BERK"];
const LAST = ["YILDIZ", "KAYA", "DEMIR", "SAHIN", "CELIK", "KOC", "ARSLAN", "DOGAN", "KILIC", "AYDIN", "SMITH", "BROWN", "MUELLER", "ROSSI", "GARCIA", "NOVAK", "TANAKA", "WANG", "KIM", "SILVA", "OZTURK", "YALCIN"];
const NAT = ["TR", "TR", "TR", "DE", "US", "GB", "FR", "IT", "JP", "CN", "NL", "ES"];
const B36 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const GEN_SSR = ["WCHR", "BLND", "DEAF", "PETC", "UMNR", "MAAS"];

function mkRng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
function pnrOf(rng: () => number) {
  let s = "";
  for (let i = 0; i < 6; i++) s += B36[Math.floor(rng() * 36)];
  return s;
}
function digits(rng: () => number, n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(rng() * 10);
  return s;
}

function genFor(flight: DepartureFlight, existing: CheckinPassenger[]): CheckinPassenger[] {
  const rng = mkRng(flight.flightId);
  const layout = layoutFor(flight.aircraft.type);
  const target = 10 + Math.floor(rng() * 8); // 10–17 yolcu
  const out = [...existing];
  let n = existing.length;
  while (out.length < target) {
    n += 1;
    const tr = NAT[Math.floor(rng() * NAT.length)] === "TR";
    const nationality = tr ? "TR" : NAT[Math.floor(rng() * NAT.length)];
    const biz = rng() < 0.18;
    // statü uçuşun durumuna göre
    let status: CheckinStatus = "not_checked";
    if (flight.status === "departed") status = rng() < 0.92 ? "boarded" : "checked_in";
    else if (flight.status === "boarding") status = rng() < 0.6 ? "boarded" : rng() < 0.8 ? "checked_in" : "not_checked";
    else if (flight.status === "checkin_open") status = rng() < 0.45 ? "checked_in" : "not_checked";
    const seated = status !== "not_checked";
    // Koltuk uçağın GERÇEK düzeninden seçilir; sabit "1-5 / 15-42" aralığı
    // dar gövdede olmayan sıralar üretiyor ve koltuk haritada bulunamıyordu.
    const zone = layout.zones.find((z) => z.cabin === (biz ? "Business" : "Economy")) ?? layout.zones[0];
    const zoneCols = zone.columns.filter(Boolean) as string[];
    const row = zone.fromRow + Math.floor(rng() * (zone.toRow - zone.fromRow + 1));
    const col = zoneCols[Math.floor(rng() * zoneCols.length)];
    const hasTicket = rng() < 0.5;
    out.push({
      id: `${flight.flightId}-g${n}`,
      surname: LAST[Math.floor(rng() * LAST.length)],
      givenName: FIRST[Math.floor(rng() * FIRST.length)],
      pnr: pnrOf(rng),
      // Bilet numarası UYDURULMAZ: gerçek bilet store'undan seçilir, yoksa
      // check-in kuponu ilerletemez ve cross-modül linkage sessizce ölürdü.
      ...pickRealTicket(rng, hasTicket),
      cabin: biz ? "Business" : "Economy",
      status,
      seat: seated ? `${row}${col}` : undefined,
      bags: Math.floor(rng() * 3),
      sequenceNumber: status === "boarded" ? 1 + Math.floor(rng() * 200) : undefined,
      nationalId: tr ? digits(rng, 11) : undefined,
      passport: !tr || rng() < 0.7 ? B36[Math.floor(rng() * 26)] + digits(rng, 8) : undefined,
      nationality,
      apis: rng() < 0.85,
      // Özel yolcu serpiştirmesi — koltuk uygunluk kuralları (seatRules) demoda görünür olsun.
      ssr: rng() < 0.1 ? [GEN_SSR[Math.floor(rng() * GEN_SSR.length)]] : undefined,
      infant: rng() < 0.05 || undefined,
      child: rng() < 0.06 || undefined,
    });
  }
  return out;
}

// Her uçuş için yolcu listesini (el yazımı + üretilen) hazırla.
for (const flight of FLIGHTS) {
  PASSENGERS[flight.flightId] = genFor(flight, PASSENGERS[flight.flightId] ?? []);
}

export async function listFlights(): Promise<DepartureFlight[]> {
  await delay(220);
  return [...FLIGHTS];
}

export async function getFlight(flightId: string): Promise<DepartureFlight | undefined> {
  await delay(180);
  return FLIGHTS.find((f) => f.flightId === flightId);
}

export async function listPassengers(flightId: string): Promise<CheckinPassenger[]> {
  await delay(220);
  return [...(PASSENGERS[flightId] ?? [])];
}

let seqCounter = 200;

/**
 * Koltuk id'sinden ("23C") koltuk bilgisi — uygunluk kontrolü için.
 *
 * Kabin, çıkış ve bulkhead artık SABİT sıra numarasından değil, uçuşun
 * uçak tipinden gelir; aynı koltuk numarası 737'de Economy, A350'de
 * Business olabilir. Uçuş verilmezse dar gövde varsayılanı kullanılır.
 */
export function seatFromId(id: string, flightId?: string): Seat | null {
  const m = id.toUpperCase().match(/^(\d{1,2})([A-K])$/);
  if (!m) return null;
  const row = Number(m[1]);
  const col = m[2];
  const flight = flightId ? FLIGHTS.find((f) => f.flightId === flightId) : undefined;
  const layout = layoutFor(flight?.aircraft.type ?? "");
  const zone = zoneOfRow(layout, row);
  if (!zone || !zone.columns.includes(col)) return null;
  return buildSeat(layout, zone, row, col, false);
}

/** Tek koltuk — düzenden türetilen tüm nitelikleriyle. */
function buildSeat(layout: AircraftLayout, zone: CabinZone, row: number, col: string, occupied: boolean): Seat {
  return {
    id: `${row}${col}`, row, col, occupied,
    cabin: zone.cabin,
    exit: layout.exitRows.includes(row),
    bulkhead: layout.bulkheadRows.includes(row),
    position: seatPosition(zone.columns, col),
    overWing: row >= layout.wingRows[0] && row <= layout.wingRows[1],
    nearLavatory: layout.lavatoryRows.includes(row),
  };
}

export interface CheckInInput { flightId: string; passengerId: string; seat: string; bags: number; idempotencyKey: string; }
/**
 * APIS kapısı (Advance Passenger Information).
 *
 * Uluslararası uçuşta yolcu bilgisi kalkıştan önce varış ülkesine iletilir;
 * bilgisi eksik yolcu KABUL EDİLMEZ — gişede bu bir kuraldır, öneri değil.
 * `apis` alanı veri modelinde vardı ama hiçbir yerde zorlanmıyordu: eksik
 * APIS'li yolcu sorunsuz check-in ediliyordu.
 */
export function isInternational(flight: DepartureFlight): boolean {
  const o = airportByCode(flight.origin)?.countryCode;
  const d = airportByCode(flight.destination)?.countryCode;
  return !!o && !!d && o !== d;
}

export function apisMissing(pax: CheckinPassenger): string[] {
  const gaps: string[] = [];
  if (!pax.passport?.trim()) gaps.push("pasaport numarası");
  if (!pax.nationality?.trim()) gaps.push("uyruk");
  if (pax.apis === false) gaps.push("APIS teyidi");
  return gaps;
}

/** APIS bilgisini tamamla — gişede pasaport okutulunca çağrılır. */
export async function recordApis(
  flightId: string, passengerId: string, data: { passport: string; nationality: string },
): Promise<CheckinPassenger> {
  await delay(320);
  const pax = PASSENGERS[flightId]?.find((p) => p.id === passengerId);
  if (!pax) throw new Error("Yolcu bulunamadı");
  if (!data.passport.trim()) throw new Error("Pasaport numarası zorunlu");
  if (data.nationality.trim().length !== 2) throw new Error("Uyruk iki harfli ülke kodu olmalı (ISO-2)");
  pax.passport = data.passport.trim().toUpperCase();
  pax.nationality = data.nationality.trim().toUpperCase();
  pax.apis = true;
  return pax;
}

export async function checkInPassenger(input: CheckInInput): Promise<CheckinPassenger> {
  await delay(550);
  const pax = PASSENGERS[input.flightId]?.find((p) => p.id === input.passengerId);
  if (!pax) throw new Error("Yolcu bulunamadı");
  // APIS kapısı — uluslararası uçuşta eksik bilgiyle kabul yok.
  const flightRef = FLIGHTS.find((f) => f.flightId === input.flightId);
  if (flightRef && isInternational(flightRef)) {
    const gaps = apisMissing(pax);
    if (gaps.length) throw new Error(`APIS eksik (${gaps.join(", ")}) — uluslararası uçuşta kabul yapılamaz.`);
  }
  // Koltuk uygunluğu — backend otorite ilkesinin mock karşılığı: UI atlatılsa bile burada reddedilir.
  const seatInfo = seatFromId(input.seat, input.flightId);
  if (!seatInfo) throw new Error(`Geçersiz koltuk: ${input.seat} — bu uçak tipinde böyle bir koltuk yok.`);
  const denial = seatDenial(pax, seatInfo);
  if (denial) throw new Error(`Koltuk ${seatInfo.id} bu yolcuya verilemez — ${denial.reason}`);

  // Doluluk da sunucuda zorlanır: aynı koltuk iki yolcuya verilemez.
  // (Yolcunun KENDİ koltuğunu koruması serbest — koltuk değiştirme akışı.)
  const other = (PASSENGERS[input.flightId] ?? []).find(
    (x) => x.id !== pax.id && x.seat?.toUpperCase() === seatInfo.id,
  );
  if (other) throw new Error(`Koltuk ${seatInfo.id} dolu — ${other.surname}/${other.givenName}.`);

  // Koltuk DEĞİŞTİRME kabul sayacını şişirmemeli; yalnız ilk kabul sayılır.
  const firstAccept = pax.status === "not_checked";
  pax.status = "checked_in";
  pax.seat = input.seat.toUpperCase();
  pax.bags = input.bags;
  if (pax.sequenceNumber == null) pax.sequenceNumber = ++seqCounter;
  const flight = FLIGHTS.find((f) => f.flightId === input.flightId);
  if (flight && firstAccept) flight.checkedIn += 1;
  return pax;
}

// HUB Kontrol board'unun canlı yansıtması için: bu oturumda elle bindirilen yolcu sayısı (uçuş başına).
const manualBoarded: Record<string, number> = {};
export function manualBoardedCount(flightId: string): number { return manualBoarded[flightId] ?? 0; }

export async function boardPassenger(flightId: string, passengerId: string): Promise<CheckinPassenger> {
  await delay(300);
  const pax = PASSENGERS[flightId]?.find((p) => p.id === passengerId);
  if (!pax) throw new Error("Yolcu bulunamadı");
  if (pax.status !== "checked_in") throw new Error("Önce check-in yapılmalı");
  pax.status = "boarded";
  manualBoarded[flightId] = (manualBoarded[flightId] ?? 0) + 1; // HUB board canlı senkron
  return pax;
}

/**
 * Check-in geri alma (undo).
 *
 * Yanlış yolcuyu kabul etmek gişede olağan bir hatadır; DCS'te geri alınabilir
 * olmalı. Koltuk boşalır, sıra numarası düşer, bilet kuponu A'ya (havalimanı
 * kontrolü) geri çekilir — bunu çağıran ekran yapar.
 */
export async function undoCheckIn(flightId: string, passengerId: string): Promise<CheckinPassenger> {
  await delay(400);
  const pax = PASSENGERS[flightId]?.find((p) => p.id === passengerId);
  if (!pax) throw new Error("Yolcu bulunamadı");
  if (pax.status === "boarded") throw new Error("Yolcu uçağa binmiş — check-in geri alınamaz.");
  if (pax.status !== "checked_in") throw new Error("Bu yolcu zaten kabul edilmemiş.");
  pax.status = "not_checked";
  pax.seat = undefined;
  pax.sequenceNumber = undefined;
  const flight = FLIGHTS.find((f) => f.flightId === flightId);
  if (flight && flight.checkedIn > 0) flight.checkedIn -= 1;
  return pax;
}

/** Kabul edilmiş tüm yolcuları tek işlemde bindir (gate'te olağan toplu aksiyon). */
export async function boardAll(flightId: string): Promise<CheckinPassenger[]> {
  await delay(600);
  const list = PASSENGERS[flightId] ?? [];
  const target = list.filter((p) => p.status === "checked_in");
  if (!target.length) throw new Error("Bindirilecek kabul edilmiş yolcu yok.");
  for (const p of target) {
    p.status = "boarded";
    manualBoarded[flightId] = (manualBoarded[flightId] ?? 0) + 1;
  }
  return target;
}

/**
 * Uçuş kapanışı (close-out).
 *
 * Kapı kapanır, uçuş kalkmış sayılır ve BİNEN yolcuların kuponları Flown'a
 * geçer. Kupon zincirinin son halkası buydu: O→A→C→L'ye kadar geliyor ama
 * hiçbir ekran F yazmıyordu.
 */
export interface CloseOutResult {
  flight: DepartureFlight;
  boarded: CheckinPassenger[];
  noShow: CheckinPassenger[];
}
export async function closeOutFlight(flightId: string): Promise<CloseOutResult> {
  await delay(700);
  const flight = FLIGHTS.find((f) => f.flightId === flightId);
  if (!flight) throw new Error("Uçuş bulunamadı");
  if (flight.status === "departed" || flight.status === "closed")
    throw new Error("Uçuş zaten kapatılmış.");
  const list = PASSENGERS[flightId] ?? [];
  const boarded = list.filter((p) => p.status === "boarded");
  // Kabul edilmiş ama binmemiş yolcular no-show'dur.
  const noShow = list.filter((p) => p.status === "checked_in");
  flight.status = "departed";
  return { flight, boarded, noShow };
}

export interface PaxHit { pax: CheckinPassenger; flight: DepartureFlight }

/** Global yolcu araması — pasaport / TC kimlik / uçuş kodu / yolcu adı / PNR / bilet. */
export async function searchPassengers(query: string): Promise<PaxHit[]> {
  await delay(200);
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const hits: PaxHit[] = [];
  for (const flight of FLIGHTS) {
    for (const pax of PASSENGERS[flight.flightId] ?? []) {
      const hay = [
        pax.surname, pax.givenName, `${pax.surname}/${pax.givenName}`, pax.pnr,
        pax.nationalId, pax.passport, pax.ticketNumber, flight.flightNumber,
        flight.origin, flight.destination,
      ].filter(Boolean).join(" ").toUpperCase();
      if (hay.includes(q)) hits.push({ pax, flight });
    }
  }
  return hits;
}

/**
 * Koltuk haritası — uçuşun UÇAK TİPİNDEN üretilir.
 *
 * Doluluk artık uydurma bir hash değil: uçuşun `checkedIn` sayısı kadar
 * koltuk deterministik olarak doldurulur, üstüne fiilen atanmış koltuklar
 * eklenir. Böylece panodaki "168/180" ile haritadaki dolu koltuk sayısı
 * birbirini tutar. (Önce hash ile doluluk üretiliyordu ve iki sayı
 * birbirinden bağımsızdı.)
 */
export async function getSeatMap(flightId: string): Promise<Seat[]> {
  await delay(260);
  const flight = FLIGHTS.find((f) => f.flightId === flightId);
  const layout = layoutFor(flight?.aircraft.type ?? "");

  // Fiilen atanmış koltuklar — harita bunları dolu göstermezse aynı koltuk
  // iki yolcuya verilebiliyordu.
  const taken = new Set(
    (PASSENGERS[flightId] ?? []).filter((p) => p.seat).map((p) => p.seat!.toUpperCase()),
  );

  const all: { zone: CabinZone; row: number; col: string }[] = [];
  for (const zone of layout.zones) {
    for (let r = zone.fromRow; r <= zone.toRow; r++) {
      for (const c of zone.columns) if (c) all.push({ zone, row: r, col: c });
    }
  }

  // Panoyla hizalı doluluk: checkedIn kadar koltuk, deterministik sırayla.
  const target = Math.max(0, Math.min((flight?.checkedIn ?? 0) - taken.size, all.length - taken.size));
  let h = 0;
  for (const ch of flightId) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  const order = all.map((_, i) => ({ i, k: (h + i * 7919) % all.length }))
    .sort((a, b) => a.k - b.k).map((x) => x.i);
  const filled = new Set<number>();
  for (const idx of order) {
    if (filled.size >= target) break;
    const s = all[idx];
    if (taken.has(`${s.row}${s.col}`)) continue;
    filled.add(idx);
  }

  return all.map((s, i) =>
    buildSeat(layout, s.zone, s.row, s.col, filled.has(i) || taken.has(`${s.row}${s.col}`)),
  );
}
