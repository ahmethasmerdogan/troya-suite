// HUB Kontrol / Operasyon domaini — biletten kalkışa kadar uçuş ve yolcu operasyonunu izler.
// Araştırma temeli: EUROCONTROL A-CDM, IATA AHM/PSCRM, kupon FSM (O→A→C→L→F).
// Mock: checkin FLIGHTS'tan türetilir + deterministik (seeded) operasyonel ekstralar.
import { FLIGHTS, manualBoardedCount, type DepartureFlight } from "./checkin";
import { airportByCode } from "./airports";

// ---- Uçuş operasyon durumu (A-CDM, STD'ye göre eşiklerle türetilir) ----
export type FlightOpsStatus =
  | "scheduled" | "checkin_open" | "checkin_closed" | "go_to_gate"
  | "boarding" | "final_call" | "gate_closed" | "boarding_complete"
  | "pushback" | "departed";

export const OPS_STATUS_META: Record<FlightOpsStatus, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  scheduled: { label: "Planlandı", tone: "neutral" },
  checkin_open: { label: "Check-in Açık", tone: "info" },
  checkin_closed: { label: "Check-in Kapandı", tone: "neutral" },
  go_to_gate: { label: "Kapıya", tone: "info" },
  boarding: { label: "Biniş", tone: "success" },
  final_call: { label: "Son Çağrı", tone: "warning" },
  gate_closed: { label: "Kapı Kapandı", tone: "danger" },
  boarding_complete: { label: "Biniş Tamam", tone: "success" },
  pushback: { label: "Geri İtme", tone: "info" },
  departed: { label: "Kalktı", tone: "neutral" },
};

/** STD'ye kalan dakikadan A-CDM ops durumu türet (eşikler ayarlanabilir varsayılan). */
export function deriveOpsStatus(minsToDeparture: number, base: DepartureFlight["status"]): FlightOpsStatus {
  const m = minsToDeparture;
  if (base === "departed" || m <= -3) return "departed";
  if (m <= 0) return "pushback";
  if (m <= 5) return "boarding_complete";
  if (m <= 15) return "gate_closed";
  if (m <= 20) return "final_call";
  if (m <= 35) return "boarding";
  if (m <= 50) return "go_to_gate";
  if (m <= 60) return "checkin_closed";
  if (m <= 180) return "checkin_open";
  return "scheduled";
}

export type AlertSeverity = "critical" | "warning" | "info";
export interface OpsAlert {
  id: string;
  code: string; // A1, B1, C1...
  flightId: string;
  flightNumber: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  action: string;
}

export interface OpsPax {
  name: string;
  seat?: string;
  cabin: "Business" | "Economy";
  boarded: boolean;
  bags: number;
  connecting?: string; // bağlantı uçuşu
  mctMin?: number; // bağlantıya kalan dk (MCT riski)
  special?: string; // UM / WCHR / STCR...
}

export interface OpsMilestone { code: string; label: string; actual: boolean; }

export interface OpsFlight {
  flightId: string;
  flightNumber: string;
  origin: string;
  destination: string;
  destCity: string;
  departure: string; // ISO (STD)
  etd?: string; // rötarlıysa
  gate?: string;
  gateChanged?: boolean;
  aircraftType: string;
  registration: string;
  baseStatus: DepartureFlight["status"];
  capacity: number;
  // funnel / metrikler
  booked: number;
  accepted: number;
  boarded: number;
  atGate: number;
  noShow: number;
  standby: number;
  bagsOffloadPending: number;
  connectingRisk: number;
  specialPaxPending: number;
  loadFactor: number; // %
  delayed: boolean;
  crewReady: boolean;
  loadsheetFinal: boolean;
  paxList: OpsPax[];
  milestones: OpsMilestone[];
}

export interface HubKpis {
  otpD0: number; // % zamanında off-block (bugün)
  departingNext60: number;
  byStage: { boarding: number; finalCall: number; gateClosed: number; departed: number };
  openCritical: number;
  openWarning: number;
  avgLoad: number;
  accepted: number;
  boarded: number;
  noShow: number;
  mctRisk: number;
  bagOffload: number;
  specialPending: number;
}

export interface OpsBoard {
  kpis: HubKpis;
  flights: OpsFlight[];
  alerts: OpsAlert[];
}

// Operasyon personelinin kapattığı (ack/çözüldü) uyarılar — oturum boyunca kalıcı (mock).
const resolvedAlerts = new Set<string>();
export function resolveAlert(id: string) { resolvedAlerts.add(id); }
export function resetResolvedAlerts() { resolvedAlerts.clear(); }

// --- deterministik seeded yardımcılar ---
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}
const SURNAMES = ["KAYA", "DEMIR", "ŞAHIN", "ÇELIK", "YILDIZ", "YILMAZ", "AYDIN", "ÖZTÜRK", "ARSLAN", "DOĞAN", "TANAKA", "SMITH", "WANG", "MÜLLER", "GARCIA", "ROSSI", "KIM", "SINGH"];
const GIVENS = ["MEHMET", "ELIF", "AHMET", "ZEYNEP", "CAN", "MERVE", "JOHN", "KENJI", "LEI", "PAUL", "MARIA", "ANNA", "DAVID", "SARA", "OMAR"];
const SPECIALS = ["WCHR", "UM", "WCHC", "STCR", "MEDA"];
const CONN = ["TK1", "TK2", "LH1304", "AF1391", "TK6", "TK21"];

function buildPaxList(f: DepartureFlight, accepted: number, boarded: number, connectingRisk: number, specialPending: number): OpsPax[] {
  const seed = hash(f.flightId);
  const rnd = (n: number) => ((seed >> (n % 28)) & 0xff) / 255;
  const list: OpsPax[] = [];
  const bizCap = Number((f.aircraft.config.match(/C(\d+)/) || [])[1] ?? 12);
  for (let i = 0; i < accepted; i++) {
    const r = (hash(f.flightId + "p" + i) % 1000) / 1000;
    const cabin = i < Math.min(bizCap, Math.round(accepted * 0.12)) ? "Business" : "Economy";
    const row = 1 + Math.floor((hash(f.flightId + "r" + i) % f.aircraft.rows));
    const seat = `${row}${"ABCDEF"[i % 6]}`;
    list.push({
      name: `${SURNAMES[hash(f.flightId + "s" + i) % SURNAMES.length]}/${GIVENS[hash(f.flightId + "g" + i) % GIVENS.length]}`,
      seat, cabin,
      boarded: i < boarded,
      bags: r < 0.2 ? 0 : r < 0.7 ? 1 : 2,
      connecting: i < connectingRisk ? CONN[i % CONN.length] : undefined,
      mctMin: i < connectingRisk ? 25 + (hash(f.flightId + "m" + i) % 30) : undefined,
      special: i >= accepted - specialPending && specialPending > 0 ? SPECIALS[i % SPECIALS.length] : undefined,
    });
  }
  void rnd;
  return list;
}

function buildMilestones(status: FlightOpsStatus): OpsMilestone[] {
  const order: { code: string; label: string; from: FlightOpsStatus }[] = [
    { code: "SIBT", label: "Uçak geldi (IN)", from: "scheduled" },
    { code: "CKO", label: "Check-in açıldı", from: "checkin_open" },
    { code: "TSAT", label: "Kalkış onay (TSAT)", from: "go_to_gate" },
    { code: "BRDG", label: "Biniş başladı", from: "boarding" },
    { code: "ARDT", label: "Hazır (RDY)", from: "boarding_complete" },
    { code: "AOBT", label: "Off-block (OUT)", from: "pushback" },
    { code: "ATOT", label: "Havalandı (OFF)", from: "departed" },
  ];
  const seq: FlightOpsStatus[] = ["scheduled", "checkin_open", "checkin_closed", "go_to_gate", "boarding", "final_call", "gate_closed", "boarding_complete", "pushback", "departed"];
  const idx = seq.indexOf(status);
  return order.map((mtone) => ({ code: mtone.code, label: mtone.label, actual: seq.indexOf(mtone.from) <= idx }));
}

export async function getOpsBoard(): Promise<OpsBoard> {
  await new Promise((r) => setTimeout(r, 260));
  const now = Date.now();
  const flights: OpsFlight[] = FLIGHTS.map((f) => {
    const mins = Math.round((new Date(f.departure).getTime() - now) / 60000);
    const status = deriveOpsStatus(mins, f.status);
    const seed = hash(f.flightId);
    const accepted = f.checkedIn;
    // boarding ilerlemesi statüye göre
    const progressByStatus: Record<FlightOpsStatus, number> = {
      scheduled: 0, checkin_open: 0, checkin_closed: 0, go_to_gate: 0,
      boarding: 0.35 + (seed % 40) / 100, final_call: 0.82 + (seed % 12) / 100,
      gate_closed: 0.95, boarding_complete: 0.99, pushback: 1, departed: 1,
    };
    // sentezlenmiş baseline + bu oturumda QuickCheck-in'den elle bindirilenler (canlı senkron)
    const boarded = Math.min(accepted, Math.round(accepted * progressByStatus[status]) + manualBoardedCount(f.flightId));
    const gatePast = ["gate_closed", "boarding_complete", "pushback", "departed"].includes(status);
    const noShow = gatePast ? Math.max(0, accepted - boarded) : (status === "final_call" ? (seed % 4) : 0);
    const bagsOffloadPending = noShow > 0 ? Math.max(0, noShow - (seed % 2)) : 0;
    const connectingRisk = ["boarding", "final_call", "gate_closed"].includes(status) ? (seed % 5) : 0;
    const specialPaxPending = status === "boarding" || status === "go_to_gate" ? (seed % 3) : 0;
    const standby = status === "checkin_open" || status === "checkin_closed" ? (seed % 6) : 0;
    const delayed = (seed % 7) === 0 && !["departed", "pushback"].includes(status);
    const loadFactor = Math.round((accepted / f.capacity) * 100);

    return {
      flightId: f.flightId,
      flightNumber: f.flightNumber,
      origin: f.origin,
      destination: f.destination,
      destCity: airportByCode(f.destination)?.city ?? f.destination,
      departure: f.departure,
      etd: delayed ? new Date(new Date(f.departure).getTime() + (20 + (seed % 40)) * 60000).toISOString() : undefined,
      gate: f.gate,
      gateChanged: (seed % 11) === 0,
      aircraftType: f.aircraft.type,
      registration: f.aircraft.registration,
      baseStatus: f.status,
      capacity: f.capacity,
      booked: Math.round(accepted * 1.04) + standby,
      accepted,
      boarded,
      atGate: Math.min(accepted, boarded + (gatePast ? 0 : Math.round((accepted - boarded) * 0.5))),
      noShow, standby, bagsOffloadPending, connectingRisk, specialPaxPending,
      loadFactor,
      delayed,
      crewReady: !((seed % 13) === 0 && !gatePast),
      loadsheetFinal: gatePast,
      paxList: buildPaxList(f, accepted, boarded, connectingRisk, specialPaxPending),
      milestones: buildMilestones(status),
    };
  });

  // --- alert'ler ---
  const alerts: OpsAlert[] = [];
  for (const f of flights) {
    const mins = Math.round((new Date(f.departure).getTime() - now) / 60000);
    const status = deriveOpsStatus(mins, f.baseStatus);
    if (f.bagsOffloadPending > 0)
      alerts.push({ id: f.flightId + "-A1", code: "A1", flightId: f.flightId, flightNumber: f.flightNumber, severity: "critical", title: "No-show bagajı indir", detail: `${f.bagsOffloadPending} yolcu binmedi, bagajı yüklü — uçaktan indirilmeli (BRS/Annex 17).`, action: "Bagajı tanımla & offload" });
    if (status === "boarding" && f.boarded / Math.max(1, f.accepted) < 0.7 && mins <= 22)
      alerts.push({ id: f.flightId + "-B1", code: "B1", flightId: f.flightId, flightNumber: f.flightNumber, severity: "warning", title: "Biniş geride", detail: `Biniş %${Math.round((f.boarded / Math.max(1, f.accepted)) * 100)} — eşiğin altında, kalkışa ${mins} dk.`, action: "Final call / gate'e personel" });
    if (f.connectingRisk > 0)
      alerts.push({ id: f.flightId + "-C1", code: "C1", flightId: f.flightId, flightNumber: f.flightNumber, severity: mins <= 20 ? "critical" : "warning", title: "Bağlantı riski (MCT)", detail: `${f.connectingRisk} aktarma yolcusu için kalan süre MCT'ye yakın.`, action: "Bekle / re-protect / hızlı transfer" });
    if (status === "gate_closed" || (status === "final_call" && mins <= 16))
      alerts.push({ id: f.flightId + "-D1", code: "D1", flightId: f.flightId, flightNumber: f.flightNumber, severity: "warning", title: "Kapı kapanıyor", detail: `Kalkışa ${mins} dk — gate kapanış kararı.`, action: "Eksik yolcu çağrısı" });
    if (f.specialPaxPending > 0)
      alerts.push({ id: f.flightId + "-H1", code: "H1", flightId: f.flightId, flightNumber: f.flightNumber, severity: "warning", title: "Özel yolcu asistanı bekliyor", detail: `${f.specialPaxPending} özel yolcuya (UM/WCHR vb.) asistan atanmadı.`, action: "Ön-biniş asistanı ata" });
    if (f.delayed)
      alerts.push({ id: f.flightId + "-I1", code: "I1", flightId: f.flightId, flightNumber: f.flightNumber, severity: "warning", title: "Rötar / OTP riski", detail: `ETD STD'den sonra — gecikme sebebi kodlanmalı.`, action: "Sebep kodla, turnaround hızlandır" });
    if (f.gateChanged)
      alerts.push({ id: f.flightId + "-G1", code: "G1", flightId: f.flightId, flightNumber: f.flightNumber, severity: "info", title: "Gate değişikliği", detail: `${f.flightNumber} kapısı ${f.gate} olarak güncellendi.`, action: "FIDS/yolcu bilgilendir" });
    if (!f.crewReady)
      alerts.push({ id: f.flightId + "-J1", code: "J1", flightId: f.flightId, flightNumber: f.flightNumber, severity: "critical", title: "Ekip/loadsheet hazır değil", detail: `${f.flightNumber} için W&B/ekip eksik.`, action: "Eksik kalemi kovala" });
  }
  const sev = { critical: 0, warning: 1, info: 2 };
  // Operasyon personelinin kapattığı uyarıları çıkar (oturum boyunca).
  const visibleAlerts = alerts.filter((a) => !resolvedAlerts.has(a.id)).sort((a, b) => sev[a.severity] - sev[b.severity]);

  // --- hub KPI ---
  const departing = flights.filter((f) => deriveOpsStatus(Math.round((new Date(f.departure).getTime() - now) / 60000), f.baseStatus) !== "departed");
  const stageOf = (f: OpsFlight) => deriveOpsStatus(Math.round((new Date(f.departure).getTime() - now) / 60000), f.baseStatus);
  const kpis: HubKpis = {
    otpD0: 86,
    departingNext60: flights.filter((f) => { const m = Math.round((new Date(f.departure).getTime() - now) / 60000); return m > 0 && m <= 60; }).length,
    byStage: {
      boarding: flights.filter((f) => ["boarding", "go_to_gate"].includes(stageOf(f))).length,
      finalCall: flights.filter((f) => stageOf(f) === "final_call").length,
      gateClosed: flights.filter((f) => ["gate_closed", "boarding_complete", "pushback"].includes(stageOf(f))).length,
      departed: flights.filter((f) => stageOf(f) === "departed").length,
    },
    openCritical: visibleAlerts.filter((a) => a.severity === "critical").length,
    openWarning: visibleAlerts.filter((a) => a.severity === "warning").length,
    avgLoad: Math.round(departing.reduce((s, f) => s + f.loadFactor, 0) / Math.max(1, departing.length)),
    accepted: flights.reduce((s, f) => s + f.accepted, 0),
    boarded: flights.reduce((s, f) => s + f.boarded, 0),
    noShow: flights.reduce((s, f) => s + f.noShow, 0),
    mctRisk: flights.reduce((s, f) => s + f.connectingRisk, 0),
    bagOffload: flights.reduce((s, f) => s + f.bagsOffloadPending, 0),
    specialPending: flights.reduce((s, f) => s + f.specialPaxPending, 0),
  };

  return { kpis, flights, alerts: visibleAlerts };
}
