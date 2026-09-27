// QuickRes — Rezervasyon domaini (PNR + availability). Mock; backend gelince REST'e bağlanır.
// PNR (Passenger Name Record) → Troya'da bilet kesimine kaynak olur (PNR→ticket linkage).
import { shiftFixture } from "./demoClock";
import { searchFlights } from "./flights";
import { computeFareOffers } from "./pricing";
import type { CabinName } from "./fareTypes";
import type { Passenger } from "./types";

export type PnrStatus = "active" | "ticketed" | "cancelled";
/**
 * Segment durum kodu (booking status): HK onaylı · HL bekleme listesi ·
 * TK tarife değişikliği onayı · HN talep · UN uçuş yok · XX iptal edildi.
 */
export type ReservationStatus = "HK" | "HL" | "TK" | "HN" | "UN" | "XX";

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
  /** Serbest notlar: RM (iç not) ve OSI (havayoluna bilgi). */
  remarks?: PnrRemark[];
  /** Rezervasyon geçmişi (RH) — her değişiklik kim/ne zaman ile. */
  history?: PnrHistoryEntry[];
}

export interface PnrRemark {
  kind: "RM" | "OSI";
  text: string;
  by: string;
  at: string;
}

export type PnrAction = "created" | "ticketed" | "renamed" | "ttl_extended" | "segment_cancelled" | "cancelled" | "remark";
export interface PnrHistoryEntry {
  at: string;
  by: string;
  action: PnrAction;
  /** İnsan-okur özet — kayıt dilinde kalır (event store ilkesi), EN ikizi yanında. */
  text: string;
  textEn: string;
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
  /** Satılabilir koltuk, 0–9 (rezervasyon ekranları 9'dan fazlasını "9" gösterir). */
  available: number;
  fareFrom: { amount: number; currency: string };
  cabin: CabinName;
  /** Ücret ailesi — "Economy Flex" gibi. */
  family: string;
}
export interface FlightOption {
  carrier: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
  durationMin: number;
  aircraft: string;
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

// Geçmiş tohumu — her PNR oluşturulma kaydıyla, biletlenmişler kesim kaydıyla başlar.
for (const p of MOCK_PNRS) {
  p.history = [{ at: p.createdAt, by: "QuickRes", action: "created", text: "Rezervasyon oluşturuldu", textEn: "Reservation created" }];
  for (const tn of p.ticketNumbers) {
    p.history.push({ at: p.createdAt, by: "Troya", action: "ticketed", text: `Bilet kesildi · ${tn}`, textEn: `Ticket issued · ${tn}` });
  }
}
MOCK_PNRS[2].remarks = [{ kind: "RM", text: "Yolcu ödemeyi akşam şubede yapacak.", by: "Elif Demir", at: MOCK_PNRS[2].createdAt }];

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
  log(p, "Troya", "ticketed",
    `Bilet kesildi · ${ticketNumber}${pax ? ` · ${paxKey(pax)}` : ""}`,
    `Ticket issued · ${ticketNumber}${pax ? ` · ${paxKey(pax)}` : ""}`);
  return p;
}

function log(p: Pnr, by: string, action: PnrAction, text: string, textEn: string) {
  (p.history ??= []).push({ at: new Date().toISOString(), by, action, text, textEn });
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
  log(p, "Troya", "renamed", `Ad düzeltildi · ${k} → ${paxKey(to)}`, `Name corrected · ${k} → ${paxKey(to)}`);
}

/* ===================================================================
   PNR işlemleri — gişenin rezervasyon üzerindeki günlük komutları.
   Her biri geçmişe (RH) yazılır; biletlenmiş yolcu varken rezervasyonu
   bozan işlem reddedilir (önce bilet void/iade edilir — Troya tarafı).
   =================================================================== */

const activeSegments = (p: Pnr) => p.segments.filter((s) => s.status !== "XX");

/** PNR iptali (XI). Kesilmiş bilet varken yapılamaz. */
export async function cancelPnr(recordLocator: string, by: string, reason?: string): Promise<Pnr> {
  await delay(420);
  const p = pnrByLocator(recordLocator);
  if (!p) throw new Error("PNR bulunamadı");
  if (p.status === "cancelled") throw new Error("PNR zaten iptal edilmiş.");
  if ((p.ticketedPax?.length ?? 0) > 0 || p.ticketNumbers.length > 0)
    throw new Error("Kesilmiş bilet var — önce biletleri void ya da iade edin, sonra rezervasyonu iptal edin.");
  p.status = "cancelled";
  p.ttl = undefined;
  for (const s of p.segments) s.status = "XX";
  log(p, by, "cancelled", `Rezervasyon iptal edildi${reason ? ` · ${reason}` : ""}`, `Reservation cancelled${reason ? ` · ${reason}` : ""}`);
  return p;
}

/** Tek segment iptali (XE). Son aktif segment iptal edilemez — PNR iptal edilir. */
export async function cancelSegment(recordLocator: string, index: number, by: string): Promise<Pnr> {
  await delay(380);
  const p = pnrByLocator(recordLocator);
  if (!p) throw new Error("PNR bulunamadı");
  if (p.status !== "active") throw new Error("Yalnız biletlenmemiş, aktif rezervasyonda segment iptal edilir.");
  const seg = p.segments[index];
  if (!seg || seg.status === "XX") throw new Error("Segment bulunamadı ya da zaten iptal.");
  if (activeSegments(p).length <= 1) throw new Error("Son segment iptal edilemez — rezervasyonu iptal edin.");
  seg.status = "XX";
  const code = `${seg.carrier}${seg.flightNumber.replace(/^[A-Z]{2}/, "")}`;
  log(p, by, "segment_cancelled", `Segment iptal · ${code} ${seg.origin}-${seg.destination}`, `Segment cancelled · ${code} ${seg.origin}-${seg.destination}`);
  return p;
}

/** Bilet kesim süre limiti uzatma — en çok ilk kalkıştan 2 saat öncesine kadar. */
export const TTL_EXTEND_HOURS = 24;
export async function extendTtl(recordLocator: string, by: string, nowMs = Date.now()): Promise<Pnr> {
  await delay(300);
  const p = pnrByLocator(recordLocator);
  if (!p) throw new Error("PNR bulunamadı");
  if (p.status !== "active") throw new Error("Yalnız biletlenmemiş rezervasyonun süresi uzatılır.");
  const firstDep = Math.min(...activeSegments(p).map((s) => Date.parse(s.departure)));
  const cap = firstDep - 2 * 3_600_000;
  const from = Math.max(nowMs, p.ttl ? Date.parse(p.ttl) : nowMs);
  const next = Math.min(from + TTL_EXTEND_HOURS * 3_600_000, cap);
  if (next <= from) throw new Error("Uçuşa çok az kaldı — süre uzatılamaz, bilet şimdi kesilmeli.");
  p.ttl = new Date(next).toISOString();
  log(p, by, "ttl_extended", `Bilet kesim süresi uzatıldı · ${p.ttl.slice(0, 16).replace("T", " ")}Z`, `Ticketing time limit extended · ${p.ttl.slice(0, 16).replace("T", " ")}Z`);
  return p;
}

/** Not ekle — RM iç nottur, OSI havayoluna bilgi mesajıdır. */
export async function addRemark(recordLocator: string, kind: PnrRemark["kind"], text: string, by: string): Promise<Pnr> {
  await delay(240);
  const p = pnrByLocator(recordLocator);
  if (!p) throw new Error("PNR bulunamadı");
  const clean = text.trim();
  if (clean.length < 3) throw new Error("Not en az 3 karakter olmalı.");
  if (clean.length > 200) throw new Error("Not 200 karakteri geçemez.");
  (p.remarks ??= []).push({ kind, text: clean, by, at: new Date().toISOString() });
  log(p, by, "remark", `${kind} eklendi · ${clean}`, `${kind} added · ${clean}`);
  return p;
}

export interface CreatePnrInput {
  passengers: Passenger[];
  segments: ReservationSegment[];
  contact?: string;
  by?: string;
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
    history: [],
  };
  log(pnr, input.by ?? "QuickRes", "created", "Rezervasyon oluşturuldu", "Reservation created");
  MOCK_PNRS.unshift(pnr);
  return pnr;
}

/**
 * Uygunluk (availability) — bir O/D/gün için seferler ve sınıf bazında
 * satılabilir koltuk.
 *
 * Önce güzergâhtan bağımsız sabit üç uçuş (TK198, TK1991, TK2024) dönüyordu:
 * IST→LHR sorgusu Tokyo seferini gösteriyordu. Artık Bilet Kes sihirbazının
 * kullandığı AYNI sefer programından (`searchFlights`) ve AYNI ücret
 * motorundan (`computeFareOffers`) türer — iki ekran aynı uçuşu, aynı
 * "…'den başlayan" fiyatla söyler. Koltuk sayısı RBD başına 0–9'dur
 * (rezervasyon ekranı geleneği); ucuz sınıflar daha çabuk kapanır.
 */
export async function getAvailability(origin: string, destination: string, date: string): Promise<FlightOption[]> {
  await delay(360);
  const day = date || new Date().toISOString().slice(0, 10);
  return searchFlights(origin, destination, day, 1).map((f) => {
    const offers = computeFareOffers([{ origin: f.origin, destination: f.destination }], f.demandFactor);
    return {
      carrier: f.carrier,
      flightNumber: f.flightNumber,
      origin: f.origin,
      destination: f.destination,
      departure: f.departure,
      arrival: f.arrival,
      durationMin: f.durationMin,
      aircraft: f.aircraft,
      classes: offers.map((o, i) => {
        // Kapanma olasılığı ucuz sınıflarda (listenin sonu) daha yüksek.
        const h = seatHash(`${f.id}-${o.rbd}`);
        const closed = h % 100 < Math.min(70, i * 9);
        return {
          rbd: o.rbd,
          available: closed ? 0 : 1 + (h % 9),
          fareFrom: o.total,
          cabin: o.cabin,
          family: o.fareType.label,
        };
      }),
    };
  });
}

function seatHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
