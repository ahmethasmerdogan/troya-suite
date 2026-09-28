// QuickCheck-in — DCS (Departure Control) domaini. Mock.
// Check-in, ilgili bilet kuponunu Troya'da O→C'ye taşır (cross-modül linkage; api.setCouponStatus).

import { seatDenial } from "./seatRules";
import { airportByCode } from "./airports";
import {
  layoutFor, zoneOfRow, seatPosition, seatCount, configString, lastRow, type AircraftLayout,
  type CabinZone, type CabinClass,
} from "./aircraftLayout";
import { checkTravelDocs, type DocCheckResult, type TravelPermit } from "./travelDocs";
import { buildTicketNumber } from "./ticketNumber";
import { foldIncludes } from "./text";
import { computeFareOffers, routeDistanceKm } from "./pricing";
import { LocalizedError } from "./errors";
import type { CouponStatus, LifecycleEvent, Ticket } from "./types";

/**
 * Check-in yolcusunun bileti — yolcunun KENDİ adına, O uçuşa ait tek kuponlu
 * bir ET. Kupon statüsü yolcunun DCS durumuyla aynıdır (kabul edilmemiş O,
 * kabul C, binmiş L, kalkmış uçuşta binmiş F).
 *
 * Önce üretilen yolcular mock depodaki RASTGELE biletlere bağlanıyordu: ad ve
 * güzergâh tutmuyor, aynı bilet birden çok yolcuya düşüyordu — bir yolcuyu
 * kabul etmek başka bir yolcunun kuponunu C yapıyordu. Bu biletler Troya
 * deposuna eklenir (`api.ts` store'u), böylece iki modül aynı kaydı görür.
 */
export const CHECKIN_TICKETS: Ticket[] = [];
let checkinSerial = 810000000;
const WANTS_TICKET = new Set<string>();

function couponStatusFor(pax: CheckinPassenger, flight: DepartureFlight): CouponStatus {
  const departed = flight.status === "departed" || flight.status === "closed";
  if (pax.status === "boarded") return departed ? "F" : "L";
  if (pax.status === "checked_in") return "C";
  return "O";
}

function ticketFor(pax: CheckinPassenger, flight: DepartureFlight): Ticket {
  const ticketNumber = buildTicketNumber("235", String(checkinSerial++));
  const dep = Date.parse(flight.departure);
  const minutes = Math.round((routeDistanceKm([{ origin: flight.origin, destination: flight.destination }]) / 800) * 60 + 30);
  const arrival = new Date(dep + minutes * 60000).toISOString();
  const issuedAt = new Date(dep - 20 * 86400000).toISOString();
  const offers = computeFareOffers([{ origin: flight.origin, destination: flight.destination }]);
  const offer = offers.find((o) => o.id === (pax.cabin === "Business" ? "biz-classic" : "eco-classic")) ?? offers[0];
  const status = couponStatusFor(pax, flight);
  const ev = (id: string, type: LifecycleEvent["type"], at: number, s: CouponStatus, detail?: string, extra: Partial<LifecycleEvent> = {}): LifecycleEvent => ({
    id, type, occurredAt: new Date(at).toISOString(), actor: `${flight.carrier} / DCS`, couponSeq: 1, status: s, detail, ...extra,
  });
  const history: LifecycleEvent[] = [
    ev("ci1", "TicketIssued", dep - 20 * 86400000, "O", "Bilet kesildi", {
      couponSeq: undefined, actor: `${flight.carrier} / Web`,
      money: { currency: offer.total.currency, gross: offer.total.amount, vat: offer.vat.amount, vatRate: offer.vat.rate },
    }),
    ev("ci2", "CouponAdded", dep - 20 * 86400000 + 1000, "O", `${flight.origin}→${flight.destination} ${flight.flightNumber}`),
  ];
  if (status !== "O") history.push(ev("ci3", "CouponCheckedIn", dep - 90 * 60000, "C"));
  if (status === "L" || status === "F") history.push(ev("ci4", "CouponLifted", dep - 25 * 60000, "L"));
  if (status === "F") history.push(ev("ci5", "CouponFlown", dep + minutes * 60000, "F", "Uçuş tamamlandı"));
  return {
    ticketNumber,
    pnr: pax.pnr,
    passenger: { surname: pax.surname, givenName: pax.givenName },
    validatingCarrier: flight.carrier,
    issuedAt,
    formOfPayment: { type: "cash" },
    control: { holder: flight.carrier, isValidatingCarrier: true },
    coupons: [{
      seq: 1,
      status,
      segment: {
        origin: flight.origin, destination: flight.destination, marketingCarrier: flight.carrier, operatingCarrier: flight.carrier,
        flightNumber: flight.flightNumber, rbd: offer.rbd, departure: flight.departure, arrival,
        fareBasis: offer.fareBasis, reservationStatus: "HK",
      },
      ...(offer.baggageKg ? { baggage: { allowance: { type: "weight" as const, value: offer.baggageKg, unit: "K" as const } } } : {}),
    }],
    fare: { baseFare: offer.baseFare, totalTfc: offer.totalTfc, total: offer.total, tfcs: offer.tfcs, vat: offer.vat },
    history,
  };
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
  /** Bildirilmiş rötar (dk) — ETD = STD + rötar. HUB rötar uyarısı ve tazminat maruziyeti bunu okur. */
  delayMin?: number;
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
  /** Pasaport son geçerlilik tarihi (YYYY-MM-DD) — seyahat belgesi kontrolü okur. */
  passportExpiry?: string;
  /** Beyan edilen giriş izni (vize / ETA / ESTA) — DOCO. */
  visa?: TravelPermit;
  /** Varış ülkesi makamının "OK TO BOARD" onayı — belge NOT OK iken kabulü açan tek yol. */
  okToBoard?: { ref: string; by: string; at: string };
  /** Kontuar kapandıktan sonra süpervizör onayıyla yapılan kabul. */
  lateAcceptance?: { reason: LateReason; note?: string; approvedBy: string; at: string };
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
  { flightId: "TK1591-D", carrier: "TK", flightNumber: "TK1591", origin: "IST", destination: "FRA", departure: inMin(120), gate: "B12", status: "checkin_open", capacity: 180, checkedIn: 72, delayMin: 95, aircraft: { type: "Airbus A321neo", registration: "TC-LRA", config: "C16 / Y164", rows: 30, seatsPerRow: 6 } },
  { flightId: "TK6-D", carrier: "TK", flightNumber: "TK6", origin: "IST", destination: "JFK", departure: inMin(185), gate: "F08", status: "checkin_open", capacity: 350, checkedIn: 41, delayMin: 205, aircraft: { type: "Airbus A350-900", registration: "TC-LGA", config: "C32 / Y283", rows: 55, seatsPerRow: 6 } },
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

// El yazımı yolculardan biletli olanlar — bilet aşağıda kendi adlarına kesilir.
WANTS_TICKET.add("p1").add("p4");

const PASSENGERS: Record<string, CheckinPassenger[]> = {
  "TK198-D": [
    { id: "p1", surname: "ERDOGAN", givenName: "AHMET", pnr: "XQ7T2M", cabin: "Business", status: "not_checked", bags: 1, ff: "TK 233 445 566", nationalId: "12345678901", passport: "U07654321", passportExpiry: "2031-04-18", nationality: "TR", apis: true },
    { id: "p2", surname: "TANAKA", givenName: "KENJI", pnr: "JJ22KK", cabin: "Economy", status: "checked_in", seat: "23C", bags: 2, sequenceNumber: 41, passport: "TK9981234", passportExpiry: "2030-11-02", nationality: "JP", apis: true },
    { id: "p3", surname: "SMITH", givenName: "JOHN", pnr: "PP90AB", cabin: "Economy", status: "not_checked", bags: 0, passport: "557120098", passportExpiry: "2029-06-30", nationality: "US", apis: false, ssr: ["WCHR"] },
    { id: "p8", surname: "KAYA", givenName: "MERVE", pnr: "XQ7T2M", cabin: "Business", status: "checked_in", seat: "3A", bags: 1, sequenceNumber: 12, nationalId: "23456789012", passport: "U08123456", passportExpiry: "2032-01-09", nationality: "TR", apis: true },
    { id: "p9", surname: "WANG", givenName: "LEI", pnr: "CN44ZZ", cabin: "Economy", status: "not_checked", bags: 2, passport: "EJ7766554", passportExpiry: "2030-03-15", nationality: "CN", apis: true, infant: true, visa: { type: "JP", number: "JPV448120", validUntil: "2027-02-28" } },
  ],
  "TK21-D": [
    { id: "p4", surname: "YILMAZ", givenName: "ELIF", pnr: "LM4K9Z", cabin: "Economy", status: "not_checked", bags: 1, nationalId: "34567890123", passport: "U05551122", passportExpiry: "2030-08-21", nationality: "TR", apis: true, ssr: ["PETC"], visa: { type: "UK", number: "GBV0912733", validUntil: "2027-05-31" } },
    { id: "p5", surname: "MUELLER", givenName: "HANS", pnr: "DE77QW", cabin: "Business", status: "checked_in", seat: "2A", bags: 1, sequenceNumber: 8, passport: "C01X9988", passportExpiry: "2031-09-12", nationality: "DE", apis: true, visa: { type: "ETA", number: "ETA7745120", validUntil: "2028-03-01" } },
    { id: "p10", surname: "BROWN", givenName: "EMMA", pnr: "GB12MN", cabin: "Economy", status: "not_checked", bags: 1, passport: "509887766", passportExpiry: "2029-12-01", nationality: "GB", apis: false, ssr: ["UMNR"], child: true },
  ],
  "TK2410-D": [
    { id: "p6", surname: "DEMIR", givenName: "CAN", pnr: "TR8N1P", cabin: "Economy", status: "boarded", seat: "14A", bags: 1, sequenceNumber: 120, nationalId: "45678901234", nationality: "TR", apis: true },
    { id: "p7", surname: "DEMIR", givenName: "AYSE", pnr: "TR8N1P", cabin: "Economy", status: "checked_in", seat: "14B", bags: 1, sequenceNumber: 121, nationalId: "56789012345", nationality: "TR", apis: true },
  ],
  "TK1591-D": [
    { id: "p11", surname: "SCHNEIDER", givenName: "PAUL", pnr: "DE90KL", cabin: "Economy", status: "not_checked", bags: 1, passport: "C09X1122", passportExpiry: "2032-05-20", nationality: "DE", apis: true },
  ],
  "TK6-D": [
    { id: "p12", surname: "JOHNSON", givenName: "MARY", pnr: "US33PP", cabin: "Business", status: "not_checked", bags: 2, passport: "558901234", passportExpiry: "2030-02-14", nationality: "US", apis: false, ssr: ["WCHC"] },
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
    // Eski rastgele-bilet seçimi akıştan bir sayı tüketiyordu; akış kaymasın
    // (yolcu adları, koltuklar ve testlerin dayandığı veri aynı kalsın) diye
    // sayı yine çekilir, bilet ise aşağıda yolcunun kendisi için kesilir.
    if (hasTicket) { rng(); WANTS_TICKET.add(`${flight.flightId}-g${n}`); }
    out.push({
      id: `${flight.flightId}-g${n}`,
      surname: LAST[Math.floor(rng() * LAST.length)],
      givenName: FIRST[Math.floor(rng() * FIRST.length)],
      pnr: pnrOf(rng),
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
  for (const p of PASSENGERS[flight.flightId]) if (p.id.includes("-g")) seedDocs(flight, p);
  // Biletli yolcuya kendi bileti kesilir (el yazımı ERDOGAN/YILMAZ dahil).
  for (const p of PASSENGERS[flight.flightId]) {
    if (!WANTS_TICKET.has(p.id)) continue;
    const t = ticketFor(p, flight);
    CHECKIN_TICKETS.push(t);
    p.ticketNumber = t.ticketNumber;
    p.couponSeq = 1;
  }
}

/**
 * Üretilen yolcuya belge bilgisi (pasaport bitişi + gerekiyorsa izin).
 *
 * AYRI bir rastgele akışla üretilir (yolcu id'sinden): `genFor`'un akışına
 * çağrı eklemek tüm yolcuları kaydırır, testlerin dayandığı veriyi bozardı.
 * Dağılım bilerek karışık — gişede "belge uygun değil" hâli görünür olsun:
 * izin gerekenlerin ~%12'sinde izin yok, pasaportların ~%8'i eşiğe yakın.
 */
function seedDocs(flight: DepartureFlight, p: CheckinPassenger) {
  const rng = mkRng(`${p.id}-docs`);
  if (p.passport) {
    const day = flight.departure.slice(0, 10);
    const r = rng();
    const addDays = (n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
    p.passportExpiry = r < 0.05 ? addDays(40) : r < 0.08 ? addDays(120) : addDays(700 + Math.floor(rng() * 2600));
  }
  const dest = airportByCode(flight.destination)?.countryCode ?? "";
  const probe = checkTravelDocs({ nationality: p.nationality, passport: p.passport ?? "X", passportExpiry: "2099-01-01" }, dest, airportByCode(flight.origin)?.countryCode ?? "", flight.departure);
  if (probe.permitType && rng() > 0.12) {
    p.visa = { type: probe.permitType, number: `${probe.permitType.slice(0, 2)}${digits(rng, 7)}`, validUntil: "2028-12-31" };
  }
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

export interface CheckInInput {
  flightId: string; passengerId: string; seat: string; bags: number; idempotencyKey: string;
  /** Kontuar kapandıktan sonra kabul — süpervizör onayı ve gerekçe zorunlu. */
  late?: { reason: LateReason; note?: string; approvedBy: string };
}

/* ===================================================================
   Kabul penceresi — kontuar kapanışı ve geç kabul.

   Gişe kabulü kalkıştan belirli bir süre önce kapanır: yolcu ve bagajı
   kapıya, yükleme planına (loadsheet) yetişmelidir. Kapanıştan sonra kabul
   ancak süpervizör onayıyla ve gerekçeyle yapılır (geç kabul); kapı
   kapandıktan sonra hiç yapılmaz. Süreler taşıyıcı politikasıdır —
   burada THY'nin İstanbul kontuar kapanışı: dış hat 60, iç hat 45 dk.
   =================================================================== */

export const CHECKIN_CLOSE_MIN = { domestic: 45, international: 60 } as const;
/** Kapı kapanışı — HUB durum modelindeki `gate_closed` eşiğiyle aynı. */
export const GATE_CLOSE_MIN = 15;

export type CheckinWindowState = "open" | "late" | "closed";
export interface CheckinWindow {
  state: CheckinWindowState;
  /** Kalkışa kalan dakika (negatif = kalkmış). */
  minsToDeparture: number;
  /** Kontuar kapanışı — kalkıştan kaç dk önce. */
  closeMin: number;
  /** Kontuar kapanış anı (ISO). */
  closesAt: string;
}

export function checkinWindow(flight: DepartureFlight, now = Date.now()): CheckinWindow {
  const dep = Date.parse(flight.departure);
  // Durum KESİN süreyle belirlenir; yuvarlanmış dakika yalnız gösterim içindir
  // (kalkışa 15.4 dk kala kapı henüz kapanmamıştır).
  const exact = (dep - now) / 60000;
  const mins = Math.round(exact);
  const closeMin = isInternational(flight) ? CHECKIN_CLOSE_MIN.international : CHECKIN_CLOSE_MIN.domestic;
  const closesAt = new Date(dep - closeMin * 60000).toISOString();
  const gone = flight.status === "departed" || flight.status === "closed";
  const state: CheckinWindowState = gone || exact <= GATE_CLOSE_MIN ? "closed" : exact <= closeMin ? "late" : "open";
  return { state, minsToDeparture: mins, closeMin, closesAt };
}

/** Geç kabul gerekçeleri — denetim kaydında kod olarak durur. */
export type LateReason = "CONN" | "IRROP" | "MEDA" | "SEC" | "CIP" | "OTHER";
export const LATE_REASONS: { code: LateReason; tr: string; en: string }[] = [
  { code: "CONN", tr: "Gecikmeli bağlantı uçuşundan gelen yolcu", en: "Passenger from a delayed connecting flight" },
  { code: "IRROP", tr: "Havayolu kaynaklı aksama (IRROP)", en: "Airline-caused disruption (IRROP)" },
  { code: "SEC", tr: "Güvenlik / pasaport kontrolü kuyruğu", en: "Security / passport control queue" },
  { code: "MEDA", tr: "Özel yardım / tıbbi durum", en: "Special assistance / medical" },
  { code: "CIP", tr: "CIP / protokol yolcusu", en: "CIP / protocol passenger" },
  { code: "OTHER", tr: "Diğer (not zorunlu)", en: "Other (note required)" },
];

/** Yolcunun seyahat belgesi kontrolü — uçuşun varış ülkesine göre. */
export function paxDocCheck(pax: CheckinPassenger, flight: DepartureFlight): DocCheckResult {
  return checkTravelDocs(
    { nationality: pax.nationality, passport: pax.passport, passportExpiry: pax.passportExpiry, visa: pax.visa, okToBoard: pax.okToBoard },
    airportByCode(flight.destination)?.countryCode ?? "",
    airportByCode(flight.origin)?.countryCode ?? "",
    flight.departure,
  );
}

/** Gişede beyan edilen izni (vize/ETA/ESTA) kaydet — DOCO. */
export async function recordTravelPermit(flightId: string, passengerId: string, permit: TravelPermit): Promise<CheckinPassenger> {
  await delay(320);
  const pax = PASSENGERS[flightId]?.find((p) => p.id === passengerId);
  if (!pax) throw new LocalizedError("Yolcu bulunamadı", "Passenger not found");
  if (!permit.type.trim() || !permit.number.trim()) throw new LocalizedError("İzin türü ve numarası zorunlu", "Permit type and number are required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(permit.validUntil)) throw new LocalizedError("Geçerlilik tarihi YYYY-AA-GG olmalı", "Valid-until date must be YYYY-MM-DD");
  pax.visa = { type: permit.type.trim().toUpperCase(), number: permit.number.trim().toUpperCase(), validUntil: permit.validUntil };
  return pax;
}

/** Pasaport son geçerlilik tarihini düzelt (belgeden okunur). */
export async function recordPassportExpiry(flightId: string, passengerId: string, expiry: string): Promise<CheckinPassenger> {
  await delay(240);
  const pax = PASSENGERS[flightId]?.find((p) => p.id === passengerId);
  if (!pax) throw new LocalizedError("Yolcu bulunamadı", "Passenger not found");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) throw new LocalizedError("Tarih YYYY-AA-GG olmalı", "Date must be YYYY-MM-DD");
  pax.passportExpiry = expiry;
  return pax;
}

/**
 * "OK TO BOARD" — varış ülkesi makamının onayı.
 *
 * Belgesi NOT OK çıkan yolcuyu kabul etmenin tek yolu budur ve yetki
 * süpervizördedir; makam referansı olmadan istisna açılmaz.
 */
export async function recordOkToBoard(flightId: string, passengerId: string, ref: string, by: string): Promise<CheckinPassenger> {
  await delay(320);
  const pax = PASSENGERS[flightId]?.find((p) => p.id === passengerId);
  if (!pax) throw new LocalizedError("Yolcu bulunamadı", "Passenger not found");
  if (ref.trim().length < 4) throw new LocalizedError("Makam onay referansı zorunlu", "Authority approval reference is required");
  pax.okToBoard = { ref: ref.trim().toUpperCase(), by, at: new Date().toISOString() };
  return pax;
}

/**
 * Gişe özeti — kalkış kontrolü giriş sayfası okur. Uçuş başına bekleyen
 * yolcu, APIS eksiği, belgesi uygun olmayan yolcu ve kabul penceresi.
 */
export interface DeskFlight {
  flight: DepartureFlight;
  window: CheckinWindow;
  waiting: number;
  apisGaps: number;
  docsNotOk: number;
  special: number;
}
export async function deskOverview(now = Date.now()): Promise<DeskFlight[]> {
  await delay(160);
  return FLIGHTS.map((flight) => {
    const list = PASSENGERS[flight.flightId] ?? [];
    const pending = list.filter((p) => p.status === "not_checked");
    const intl = isInternational(flight);
    return {
      flight,
      window: checkinWindow(flight, now),
      waiting: pending.length,
      apisGaps: intl ? pending.filter((p) => apisMissing(p).length > 0).length : 0,
      docsNotOk: intl ? pending.filter((p) => paxDocCheck(p, flight).verdict === "not_ok").length : 0,
      special: list.filter((p) => p.ssr?.length || p.infant || p.child).length,
    };
  });
}
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

export function apisMissing(pax: CheckinPassenger, lang: "tr" | "en" = "tr"): string[] {
  const gaps: string[] = [];
  const en = lang === "en";
  if (!pax.passport?.trim()) gaps.push(en ? "passport number" : "pasaport numarası");
  if (!pax.nationality?.trim()) gaps.push(en ? "nationality" : "uyruk");
  if (pax.apis === false) gaps.push(en ? "APIS confirmation" : "APIS teyidi");
  return gaps;
}

/** APIS bilgisini tamamla — gişede pasaport okutulunca çağrılır. */
export async function recordApis(
  flightId: string, passengerId: string, data: { passport: string; nationality: string },
): Promise<CheckinPassenger> {
  await delay(320);
  const pax = PASSENGERS[flightId]?.find((p) => p.id === passengerId);
  if (!pax) throw new LocalizedError("Yolcu bulunamadı", "Passenger not found");
  if (!data.passport.trim()) throw new LocalizedError("Pasaport numarası zorunlu", "Passport number is required");
  if (!/^[A-Z]{2}$/.test(data.nationality.trim().toUpperCase())) throw new LocalizedError("Uyruk iki harfli ülke kodu olmalı (ISO-2, ör. TR)", "Nationality must be a two-letter country code (ISO-2, e.g. TR)");
  if (!/^[A-Z0-9]{5,12}$/.test(data.passport.trim().toUpperCase())) throw new LocalizedError("Pasaport numarası 5–12 harf/rakam olmalı", "The passport number must be 5–12 letters/digits");
  pax.passport = data.passport.trim().toUpperCase();
  pax.nationality = data.nationality.trim().toUpperCase();
  pax.apis = true;
  return pax;
}

export async function checkInPassenger(input: CheckInInput): Promise<CheckinPassenger> {
  await delay(550);
  const pax = PASSENGERS[input.flightId]?.find((p) => p.id === input.passengerId);
  if (!pax) throw new LocalizedError("Yolcu bulunamadı", "Passenger not found");
  const flightRef = FLIGHTS.find((f) => f.flightId === input.flightId);
  const firstAcceptance = pax.status === "not_checked";
  // Koltuk değiştirme yalnız kabul edilmiş ve henüz binmemiş yolcuda, uçuş
  // kapanmadan yapılır — aksi hâlde binmiş yolcu "kabul edildi"ye geri düşerdi.
  if (!firstAcceptance) {
    if (pax.status === "boarded") throw new LocalizedError("Yolcu uçağa binmiş — koltuk değiştirilemez.", "The passenger has boarded — the seat cannot be changed.");
    if (pax.status !== "checked_in") throw new LocalizedError("Bu yolcu için kabul işlemi yapılamaz.", "This passenger cannot be accepted.");
    if (flightRef && (flightRef.status === "departed" || flightRef.status === "closed"))
      throw new LocalizedError("Uçuş kapatıldı — koltuk değiştirilemez.", "The flight is closed — the seat cannot be changed.");
  }
  // Kabul penceresi — yalnız İLK kabulde (koltuk değiştirmek kabul değildir).
  if (flightRef && firstAcceptance) {
    const w = checkinWindow(flightRef);
    if (w.state === "closed") throw new LocalizedError("Kapı kapandı — bu uçuşa kabul yapılamaz.", "The gate is closed — no acceptance on this flight.");
    if (w.state === "late") {
      if (!input.late) throw new LocalizedError(`Kontuar kapandı (kalkıştan ${w.closeMin} dk önce) — geç kabul süpervizör onayı ve gerekçe ister.`, `Check-in counter closed (${w.closeMin} min before departure) — late acceptance requires supervisor approval and a reason.`);
      if (input.late.reason === "OTHER" && !input.late.note?.trim()) throw new LocalizedError("\"Diğer\" gerekçesinde açıklama zorunlu.", "A description is required for the \"Other\" reason.");
      if (!input.late.approvedBy?.trim()) throw new LocalizedError("Geç kabulü onaylayan süpervizör kayda geçmeli.", "The supervisor approving the late acceptance must be recorded.");
    }
  }
  // APIS kapısı — uluslararası uçuşta eksik bilgiyle kabul yok.
  if (flightRef && isInternational(flightRef)) {
    const gaps = apisMissing(pax);
    if (gaps.length) {
      throw new LocalizedError(
        `APIS eksik (${gaps.join(", ")}) — uluslararası uçuşta kabul yapılamaz.`,
        `APIS missing (${apisMissing(pax, "en").join(", ")}) — no acceptance on an international flight.`,
      );
    }
    // Seyahat belgesi kapısı (Timatic benzeri) — NOT OK yolcu taşınmaz.
    const docs = paxDocCheck(pax, flightRef);
    if (docs.verdict === "not_ok") {
      const failed = docs.lines.filter((l) => !l.ok);
      const why = failed.map((l) => l.tr).join("; ");
      throw new LocalizedError(
        `Seyahat belgesi uygun değil — ${why}.`,
        `Travel documents not OK — ${failed.map((l) => l.en).join("; ")}.`,
      );
    }
  }
  // Koltuk uygunluğu — backend otorite ilkesinin mock karşılığı: UI atlatılsa bile burada reddedilir.
  const seatInfo = seatFromId(input.seat, input.flightId);
  if (!seatInfo) throw new LocalizedError(`Geçersiz koltuk: ${input.seat} — bu uçak tipinde böyle bir koltuk yok.`, `Invalid seat: ${input.seat} — this aircraft type has no such seat.`);
  const denial = seatDenial(pax, seatInfo);
  if (denial) {
    throw new LocalizedError(
      `Koltuk ${seatInfo.id} bu yolcuya verilemez — ${denial.reason}`,
      `Seat ${seatInfo.id} cannot be assigned to this passenger — ${denial.reasonEn}`,
    );
  }

  // Doluluk da sunucuda zorlanır: aynı koltuk iki yolcuya verilemez.
  // (Yolcunun KENDİ koltuğunu koruması serbest — koltuk değiştirme akışı.)
  const other = (PASSENGERS[input.flightId] ?? []).find(
    (x) => x.id !== pax.id && x.seat?.toUpperCase() === seatInfo.id,
  );
  if (other) throw new LocalizedError(`Koltuk ${seatInfo.id} dolu — ${other.surname}/${other.givenName}.`, `Seat ${seatInfo.id} is taken — ${other.surname}/${other.givenName}.`);

  // Koltuk DEĞİŞTİRME kabul sayacını şişirmemeli; yalnız ilk kabul sayılır.
  const firstAccept = firstAcceptance;
  if (firstAccept && input.late && flightRef && checkinWindow(flightRef).state === "late") {
    pax.lateAcceptance = { ...input.late, note: input.late.note?.trim() || undefined, at: new Date().toISOString() };
  }
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
/** Manifestte (bu ekranda işlem yapılabilen yolcular) binmiş görünen yolcu sayısı. */
export function manifestBoardedCount(flightId: string): number {
  return (PASSENGERS[flightId] ?? []).filter((p) => p.status === "boarded").length;
}
/** Manifest — pano ve uçuş detayı aynı yolcuları göstersin diye senkron erişim. */
export function manifestOf(flightId: string): CheckinPassenger[] {
  return PASSENGERS[flightId] ?? [];
}
/** Bu oturumda kapatılan uçuşun binmeyen (no-show) sayısı; kapatılmadıysa undefined. */
const closedNoShow: Record<string, number> = {};
export function closedOutNoShow(flightId: string): number | undefined { return closedNoShow[flightId]; }

/** Kapanmış uçuşta DCS işlemi yapılmaz — kuponlar F'ye geçti, sayılar kesinleşti. */
function assertFlightOpen(flightId: string) {
  const f = FLIGHTS.find((x) => x.flightId === flightId);
  if (f && (f.status === "departed" || f.status === "closed")) throw new LocalizedError("Uçuş kapatıldı — bu işlem yapılamaz.", "The flight is closed — this action is not allowed.");
}

export async function boardPassenger(flightId: string, passengerId: string): Promise<CheckinPassenger> {
  await delay(300);
  const pax = PASSENGERS[flightId]?.find((p) => p.id === passengerId);
  if (!pax) throw new LocalizedError("Yolcu bulunamadı", "Passenger not found");
  assertFlightOpen(flightId);
  if (pax.status !== "checked_in") throw new LocalizedError("Önce check-in yapılmalı", "The passenger must be checked in first");
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
  if (!pax) throw new LocalizedError("Yolcu bulunamadı", "Passenger not found");
  assertFlightOpen(flightId);
  if (pax.status === "boarded") throw new LocalizedError("Yolcu uçağa binmiş — check-in geri alınamaz.", "The passenger has boarded — check-in cannot be undone.");
  if (pax.status !== "checked_in") throw new LocalizedError("Bu yolcu zaten kabul edilmemiş.", "This passenger has not been accepted.");
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
  assertFlightOpen(flightId);
  const list = PASSENGERS[flightId] ?? [];
  const target = list.filter((p) => p.status === "checked_in");
  if (!target.length) throw new LocalizedError("Bindirilecek kabul edilmiş yolcu yok.", "There are no accepted passengers to board.");
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
  if (!flight) throw new LocalizedError("Uçuş bulunamadı", "Flight not found");
  if (flight.status === "departed" || flight.status === "closed")
    throw new LocalizedError("Uçuş zaten kapatılmış.", "The flight is already closed.");
  const list = PASSENGERS[flightId] ?? [];
  const boarded = list.filter((p) => p.status === "boarded");
  // Kabul edilmiş ama binmemiş yolcular no-show'dur.
  const noShow = list.filter((p) => p.status === "checked_in");
  flight.status = "departed";
  closedNoShow[flightId] = noShow.length;
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
      ].filter(Boolean).join(" ");
      if (foldIncludes(hay, q)) hits.push({ pax, flight });
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
