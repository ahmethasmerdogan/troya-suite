// Mock API — backend hazır olunca TanStack Query çağrıları aynı kalır, sadece
// fetch implementasyonu gerçek REST'e (OpenAPI client) döner. İş kuralı YOK (CLAUDE.md §8).
import {
  MOCK_TICKETS, MOCK_EMDS, MOCK_MESSAGES, MOCK_AGREEMENTS, MOCK_ORDERS, MOCK_PTAS, MOCK_REVENUE_ALERTS, toSummary,
} from "./mockData";
import type {
  Ticket, TicketSummary, LifecycleEvent, LifecycleEventType, Emd, EmdType, InterlineMessage, BilateralAgreement, Order, OrderStatus,
  Segment, Money, CouponStatus, Pta, RevenueAlert, Passenger, RefundRecord, Coupon, TaxFeeCharge, EventMoney,
} from "./types";
import { buildTicketNumber } from "./ticketNumber";
import { applyTransition, applyRefundCancel, canTransition, isRefundable } from "./couponStatusMachine";
import { isFinal } from "./couponStatus";
import { quoteRefund, type InvoluntaryReason, type RefundType } from "./refundRules";
import type { WaiverCode } from "./fareRules";
import { classifyChange, type ChangeType } from "./changeRules";
import { quoteReissue } from "./reissueRules";
import { attachTicketToPnr, listPnrs, paxKey, pnrByLocator, renamePnrPassenger, unticketedPassengers } from "./reservation";
import { classifyNameChange, type NameCorrectionReason } from "./nameCorrection";
import { buildQueueItems, type QueueItem } from "./queues";
import { beyondValidity, changeBlockedByValidity, illnessExtension, ticketValidity, travelCommenced, type IllnessInput } from "./validity";
import { demoNow } from "./demoClock";
import { assessRights, payableRegime, type DisruptionInput, type RightsAssessment } from "./passengerRights";

/** İade ve reissue tarifesi — akışlar tutarı buradan alır (personel elle yazmaz). */
export { quoteRefund, quoteReissue };


// Prototip durumu: bellek içi store (kesilen biletler eklenir).
const store: Ticket[] = [...MOCK_TICKETS];
let serialCounter = 100200300;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function listTickets(): Promise<TicketSummary[]> {
  await delay(280);
  return store.map(toSummary);
}

export async function searchTickets(query: string): Promise<TicketSummary[]> {
  await delay(220);
  const q = query.trim().toUpperCase();
  if (!q) return store.map(toSummary);
  return store
    .filter(
      (t) =>
        t.ticketNumber.includes(q) ||
        t.passenger.surname.toUpperCase().includes(q) ||
        t.passenger.givenName.toUpperCase().includes(q) ||
        t.pnr?.toUpperCase().includes(q) ||
        t.passenger.foid?.toUpperCase().includes(q) ||
        t.formOfPayment.detail?.toUpperCase().includes(q) || // kart son-4 maskeli detayda geçer
        t.coupons.some((c) => c.segment.origin === q || c.segment.destination === q || c.segment.flightNumber.toUpperCase().includes(q)),
    )
    .map(toSummary);
}

export async function getTicket(ticketNumber: string): Promise<Ticket | undefined> {
  await delay(260);
  return store.find((t) => t.ticketNumber === ticketNumber);
}

export interface IssueTicketInput {
  passenger: Passenger;
  validatingCarrier: string;
  pnr?: string;
  segments: Ticket["coupons"][number]["segment"][];
  fare: Ticket["fare"];
  formOfPayment: Ticket["formOfPayment"];
  /** Seçilen ücretin bagaj hakkı (kg) — her kupona yazılır (Handbook 14.4). */
  baggageAllowanceKg?: number;
  /** Çift-submit koruması — frontend üretir (CLAUDE.md §9). */
  idempotencyKey: string;
}

const issuedKeys = new Map<string, string>(); // idempotencyKey → ticketNumber

export async function issueTicket(input: IssueTicketInput): Promise<Ticket> {
  await delay(700); // para işlemi: optimistic UI yok, sunucu beklenir
  // Idempotency: aynı key → aynı sonuç, yeni yan etki yok.
  const existing = issuedKeys.get(input.idempotencyKey);
  if (existing) return store.find((t) => t.ticketNumber === existing)!;

  // Kapanmış döneme yeni satış yazılamaz — kalemler settlement'a iletilmiştir.
  assertPeriodOpen(new Date().toISOString(), "yeni satış");
  // Rezervasyondan kesim: bilet adı PNR'daki adla birebir aynı olmalı ve her
  // yolcu tek ET alır (Handbook 2.3) — mükerrer kesim burada durur.
  const srcPnr = input.pnr ? pnrByLocator(input.pnr) : undefined;
  if (srcPnr) {
    const k = paxKey(input.passenger);
    if (!srcPnr.passengers.some((x) => paxKey(x) === k))
      throw new DomainError(`${input.passenger.surname}/${input.passenger.givenName} ${srcPnr.recordLocator} rezervasyonunda yok — bilet adı PNR'daki adla birebir aynı olmalı (Handbook 2.3).`);
    if (!unticketedPassengers(srcPnr).some((x) => paxKey(x) === k))
      throw new DomainError(`${srcPnr.recordLocator} rezervasyonunda bu yolcunun bileti zaten kesilmiş — mükerrer kesim yapılamaz.`);
  }
  const ticketNumber = buildTicketNumber("235", String(serialCounter++));
  const now = new Date().toISOString();
  const history: LifecycleEvent[] = [
    {
      id: "h1", type: "TicketIssued", occurredAt: now,
      actor: `${input.validatingCarrier} / Web`, detail: "Bilet kesildi", status: "O",
      money: {
        currency: input.fare.total.currency,
        gross: input.fare.total.amount,
        ...(input.fare.vat ? { vat: input.fare.vat.amount, vatRate: input.fare.vat.rate } : {}),
      },
    },
    ...input.segments.map((s, i) => ({
      id: `h-c${i + 1}`,
      type: "CouponAdded" as const,
      occurredAt: now,
      actor: input.validatingCarrier,
      couponSeq: i + 1,
      detail: `${s.origin}→${s.destination} ${s.marketingCarrier}${s.flightNumber.replace(/^\D+/, "")}`,
      status: "O" as const,
    })),
  ];

  const ticket: Ticket = {
    ticketNumber,
    pnr: input.pnr,
    passenger: input.passenger,
    validatingCarrier: input.validatingCarrier,
    issuedAt: now,
    formOfPayment: input.formOfPayment,
    control: { holder: input.validatingCarrier, isValidatingCarrier: true },
    coupons: input.segments.map((segment, i) => ({
      seq: i + 1,
      status: "O" as const,
      segment,
      // Bagaj hakkı ücretten gelir ve kupona yazılır (Handbook 14.4).
      ...(input.baggageAllowanceKg
        ? { baggage: { allowance: { type: "weight" as const, value: input.baggageAllowanceKg, unit: "K" as const } } }
        : {}),
    })),
    fare: input.fare,
    history,
  };

  store.unshift(ticket);
  issuedKeys.set(input.idempotencyKey, ticketNumber);
  // Rezervasyon → bilet bağı: PNR "biletlendi" olur, doküman numarası oraya yazılır.
  if (input.pnr) attachTicketToPnr(input.pnr, ticketNumber, input.passenger);
  return ticket;
}

export function newIdempotencyKey(): string {
  return "idem-" + crypto.randomUUID();
}

// ===== Panel dashboard istatistikleri (mock; store'dan türetilir) =====
export interface DashboardStats {
  statusDist: { status: CouponStatus; count: number }[];
  weekly: number[]; // son 7 gün kesilen bilet
  activity: { id: string; type: LifecycleEvent["type"]; label: string; ref: string; occurredAt: string; status?: CouponStatus }[];
}
export async function getDashboardStats(): Promise<DashboardStats> {
  await delay(240);
  const counts = new Map<CouponStatus, number>();
  for (const tk of store) for (const c of tk.coupons) counts.set(c.status, (counts.get(c.status) ?? 0) + 1);
  const statusDist = [...counts.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);

  const activity = store
    .flatMap((tk) => tk.history.map((h) => ({ id: tk.ticketNumber + h.id, type: h.type, label: h.detail || h.type, ref: tk.ticketNumber, occurredAt: h.occurredAt, status: h.status })))
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 6);

  return { statusDist, weekly: [4, 7, 5, 9, 6, 11, 8], activity };
}

// =====================================================================
// FE-3: Void / Exchange / Refund — bu mutasyonlar mock "sunucu"yu temsil
// eder; FSM invariant'ları (ARCHITECTURE §4) burada zorlanır. İdempotent.
// =====================================================================

/** İşlem hatası — mesaj alan altında / toast'ta gösterilir. */
export class DomainError extends Error {}

// idempotencyKey → işlenmiş işaret (komut sonucu referansı). Mock store.
// NOT (denetim O1): bu Map tüm komutlarca paylaşılır. Pratikte güvenli — her drawer
// `useState(newIdempotencyKey)` ile BENZERSIZ UUID üretir, yani çapraz-komut çakışması olmaz.
// Gerçek backend'de idempotency scope'u komut-tipi + key olmalı (F1 `idempotency_keys` tablosu
// bunu doğru yapıyor); bu mock kısıt bilinçlidir.
const opKeys = new Map<string, string>();

function event(type: LifecycleEvent["type"], partial: Partial<LifecycleEvent>): LifecycleEvent {
  return {
    id: "h-" + crypto.randomUUID().slice(0, 8),
    type,
    occurredAt: new Date().toISOString(),
    actor: "TK / IST-CTR",
    ...partial,
  };
}

export interface VoidInput { ticketNumber: string; reason?: string; idempotencyKey: string; }
export async function voidTicket(input: VoidInput): Promise<Ticket> {
  await delay(650);
  const t = store.find((x) => x.ticketNumber === input.ticketNumber);
  if (!t) throw new DomainError("Bilet bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) return t; // idempotent
  // 1.1.5.3 — void da bir statü değişikliğidir: kuponun zilyetliği bizde olmalı.
  assertControl(t, "Void");
  assertPeriodOpen(t.issuedAt, "void"); // kapanmış dönemde satış iptali yok
  // 1.1.5.3 / satış günü kuralı: void yalnız satışın yapıldığı raporlama
  // döneminde mümkündür. Sonrası iade işlemidir.
  if (!inCurrentReportingPeriod(t.issuedAt))
    throw new DomainError(
      `Bilet ${reportingPeriodId(t.issuedAt)} döneminde kesilmiş; void yalnız satış döneminde yapılabilir — iade (refund) kullanın.`,
    );
  // İnvariant: void için TÜM kuponlar O olmalı.
  const notOpen = t.coupons.filter((c) => c.status !== "O");
  if (notOpen.length)
    throw new DomainError(`Void için tüm kuponlar 'O' olmalı. Engel: kupon ${notOpen.map((c) => `#${c.seq}(${c.status})`).join(", ")}.`);
  t.coupons.forEach((c) => {
    c.status = applyTransition(c.status, "V");
    cascadeEmdA(t.ticketNumber, c.seq, "V"); // EMD-A senkronu (5.3)
  });
  stampSac(t.coupons); // 1.3.6: işlem başına TEK kod, tüm kuponlara aynısı
  emitStatusUpdate(t, undefined, "V");
  t.history.push(event("TicketVoided", {
    detail: input.reason || "Satış kaydı iptal edildi",
    status: "V",
    money: {
      currency: t.fare.total.currency,
      gross: t.fare.total.amount,
      ...(t.fare.vat ? { vat: t.fare.vat.amount, vatRate: t.fare.vat.rate } : {}),
    },
  }));
  opKeys.set(input.idempotencyKey, t.ticketNumber);
  return t;
}


// =====================================================================
// Handbook uyum yardımcıları (gap analizi 2026-07-06)
// =====================================================================
/**
 * SAC — Settlement Authorisation Code (1.3.6).
 *
 * Handbook birebir: kupon E, F, P, V veya X finaline geçtiğinde ve Refund-Cancel
 * mesajı işlendiğinde Validating Carrier üretir. **Bir işlemde yolcu başına TEK
 * kod** üretilir ve o işlemin etkilediği tüm kuponlara aynısı yazılır.
 * 14 karakterdir; 1–4. karakterler taşıyıcının muhasebe kodudur — kod 3
 * karakterliyse (TK = 235) **1. pozisyon boşluktur**.
 */
function newSac(accountingCode = "235"): string {
  const head = accountingCode.length === 3 ? " " + accountingCode : accountingCode.slice(0, 4);
  const rand = crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 10);
  return head + rand;
}

/** İşlemin etkilediği kuponlara tek SAC yazar (yalnız boş olanlara). */
function stampSac(coupons: { sac?: string }[], accountingCode = "235"): string {
  const sac = newSac(accountingCode);
  coupons.forEach((c) => { if (!c.sac) c.sac = sac; });
  return sac;
}

/**
 * Oturumun taşıyıcısı. Gerçekte kimlik doğrulamadan (Keycloak) gelir; burada
 * demo sabiti. Kontrol kapıları bu koda göre işler.
 */
export const SESSION_CARRIER = "TK";

/**
 * Raporlama dönemi (12.13.2 · 5.5 "V"). Void ve Refund-Cancel yalnız işlemin
 * yapıldığı dönem içinde mümkündür.
 * VARSAYIM: handbook dönem uzunluğunu tanımlamaz — takvim günü kullanıyoruz.
 */
export function reportingPeriodId(iso: string): string {
  return iso.slice(0, 10);
}
export function inCurrentReportingPeriod(iso: string): boolean {
  return reportingPeriodId(iso) === reportingPeriodId(new Date().toISOString());
}

/**
 * Kapatılan raporlama dönemleri. Dönem kapandıktan sonra o döneme ait satış
 * kaydı artık void edilemez ve iade geri alınamaz — kalemler settlement'a
 * gitmiştir. (Gerçekte bu, muhasebe kapanışının kilididir.)
 */
/**
 * Kapanış KALICIDIR: sayfa yenilendiğinde geri açılan bir muhasebe dönemi
 * kilidi kilit değildir. Mock veriler bellekte yaşasa da bu karar tarayıcıda
 * saklanır (gerçekte tabloda tutulur).
 */
const CLOSED_KEY = "troya.closedPeriods";
const closedPeriods = new Set<string>(readClosedPeriods());

function readClosedPeriods(): string[] {
  try {
    const raw = localStorage.getItem(CLOSED_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function persistClosedPeriods(): void {
  try {
    localStorage.setItem(CLOSED_KEY, JSON.stringify([...closedPeriods]));
  } catch {
    // depolama kapalıysa kilit yalnız oturum boyunca yaşar
  }
}

export function isPeriodClosed(periodId: string): boolean {
  return closedPeriods.has(periodId);
}

export async function closeReportingPeriod(periodId: string): Promise<string[]> {
  await delay(450);
  if (closedPeriods.has(periodId)) throw new DomainError(`${periodId} dönemi zaten kapatılmış.`);
  // Kapanış geri alınamaz; henüz gelmemiş bir günü kapatmak o günün tüm
  // satışlarını daha doğmadan void edilemez hâle getirirdi.
  if (periodId > reportingPeriodId(new Date().toISOString()))
    throw new DomainError(`${periodId} gelecek bir dönem — kapatılamaz.`);
  closedPeriods.add(periodId);
  persistClosedPeriods();
  return [...closedPeriods].sort();
}

export async function listClosedPeriods(): Promise<string[]> {
  await delay(120);
  return [...closedPeriods].sort();
}

/** Dönem kapalıysa para/statü değiştiren işlemi reddet. */
function assertPeriodOpen(iso: string, action: string): void {
  const pid = reportingPeriodId(iso);
  if (closedPeriods.has(pid))
    throw new DomainError(`${pid} raporlama dönemi kapatıldı — ${action} yapılamaz. Kalemler settlement'a iletildi.`);
}

/**
 * Kontrol süre limiti (1.1.4.1).
 *
 * A / C / L: kontrolü elinde tutan taşıyıcı, **planlanan kalkıştan itibaren 72
 * saat** içinde statü iletir ya da kontrolü Validating Carrier'a döndürür;
 * kalkış tarihi geçmişte kalan kuponlarda süre **kontrolün alındığı andan**
 * işler. I (IRROP): süre uzar ama **orijinal kalkıştan 7 günü aşamaz**.
 */
export function controlDeadline(departureIso: string, acquiredIso: string, status: CouponStatus): string {
  const dep = new Date(departureIso).getTime();
  const acq = new Date(acquiredIso).getTime();
  if (status === "I") return new Date(dep + 7 * 24 * 3600_000).toISOString();
  const base = dep >= acq ? dep : acq;
  return new Date(base + 72 * 3600_000).toISOString();
}

/** Kontrol süresi doldu mu? (gecikmiş kontrol = gelir koruma uyarısı) */
export function isControlOverdue(t: Ticket): boolean {
  return !!t.control.deadlineAt && new Date(t.control.deadlineAt).getTime() < Date.now();
}

/**
 * Kontrol kapısı (1.1.5.3): "değişiklik yapmak için acente kuponun elektronik
 * zilyetliğinde olmalı". Kontrol başka taşıyıcıdaysa işlem reddedilir ve
 * personel önce kontrolü istemeye yönlendirilir.
 */
function assertControl(t: Ticket, action: string): void {
  if (t.control.holder !== SESSION_CARRIER) {
    throw new DomainError(
      `${action} için kupon kontrolü ${SESSION_CARRIER}'da olmalı — şu an ${t.control.holder}'da (1.1.5.3). Önce kontrolü isteyin.`,
    );
  }
}

/**
 * Statü güncellemesi yayını (ETSU — 1.1.4.3 / 1.1.4.4).
 *
 * Marketing/Operating Carrier veritabanı Validating Carrier ile senkron
 * tutulur. Daha önce yalnız kontrol talebi mesaj üretiyordu; artık statü
 * değiştiren her komut interline kuyruğuna bir zarf bırakır.
 */
function emitStatusUpdate(t: Ticket, couponSeq: number | undefined, status: CouponStatus): void {
  const partner = t.control.holder !== t.validatingCarrier ? t.control.holder : t.coupons[0]?.segment.marketingCarrier;
  if (!partner || partner === SESSION_CARRIER) return; // kendi kendimize bildirim yok
  MOCK_MESSAGES.unshift({
    id: "m-" + crypto.randomUUID().slice(0, 8),
    standard: "EDIFACT",
    messageType: "ETSU",
    direction: "outbound",
    partnerCarrier: partner,
    ticketNumber: t.ticketNumber,
    occurredAt: new Date().toISOString(),
    status: "sent",
    summary: `Statü güncelleme · ${t.ticketNumber}${couponSeq != null ? ` kupon ${couponSeq}` : ""} → ${status}`,
    payloadPreview: `ETSU\nTKT:${t.ticketNumber}\nCPN:${couponSeq ?? "*"}\nSTS:${status}\nFROM:${SESSION_CARRIER}\nTO:${partner}`,
  });
}

/** İlgili bilateral anlaşma — kontrol devri için şart (1.1.5.1(b)). */
function agreementWith(carrier: string): BilateralAgreement | undefined {
  return MOCK_AGREEMENTS.find((a) => a.partnerCarrier === carrier);
}

export interface ControlInput {
  ticketNumber: string;
  toCarrier?: string;
  couponSeqs?: number[];
  reason?: string;
  idempotencyKey: string;
}

/**
 * Kontrolü devret (1.1.5.1(b)).
 * Yalnız Validating Carrier devredebilir; devir için taraflar arasında **aktif
 * ET bilateral interline anlaşması** ve anlaşmada control transfer yetkisi
 * şarttır. Kontrol verildiğinde ilgili kuponlar için "O" statüsü bildirilir.
 */
export async function grantControl(input: ControlInput): Promise<Ticket> {
  await delay(450);
  const t = store.find((x) => x.ticketNumber === input.ticketNumber);
  if (!t) throw new DomainError("Bilet bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) return t;
  const to = (input.toCarrier ?? "").toUpperCase();
  if (to.length !== 2) throw new DomainError("Devredilecek taşıyıcı kodu iki harf olmalı.");
  if (t.validatingCarrier !== SESSION_CARRIER)
    throw new DomainError(`Kontrolü yalnız Validating Carrier (${t.validatingCarrier}) devredebilir (1.1.5.1).`);
  if (t.control.holder !== t.validatingCarrier)
    throw new DomainError(
      `Kontrol şu an ${t.control.holder}'da. Validating Carrier önce kontrolü geri almalı, sonra başka taşıyıcıya verebilir (1.1.5.3).`,
    );
  if (to === t.validatingCarrier) throw new DomainError("Kontrol zaten Validating Carrier'da.");
  const ag = agreementWith(to);
  if (!ag || ag.status !== "active" || !ag.controlTransfer)
    throw new DomainError(`${to} ile aktif ve control transfer yetkili bir ET bilateral anlaşması yok (1.1.5.1(b)).`);

  const seqs = input.couponSeqs?.length ? input.couponSeqs : t.coupons.filter((c) => !isFinal(c.status)).map((c) => c.seq);
  if (!seqs.length) throw new DomainError("Devredilecek açık kupon yok.");
  const first = t.coupons.find((c) => c.seq === seqs[0])!;
  const now = new Date().toISOString();
  t.control = {
    holder: to,
    isValidatingCarrier: false,
    acquiredAt: now,
    deadlineAt: controlDeadline(first.segment.departure, now, "A"),
    leaseExpiresAt: controlDeadline(first.segment.departure, now, "A"),
    grantedUnderAgreement: `${ag.partnerCarrier} · ${ag.capabilities.join("/")}`,
  };
  t.history.push(event("ControlGranted", {
    couponSeq: seqs[0],
    detail: `Airport control ${to}'a verildi (kupon ${seqs.join(", ")}) · statü "O" bildirildi · süre ${t.control.deadlineAt!.slice(0, 16).replace("T", " ")}`,
    status: "O",
  }));
  opKeys.set(input.idempotencyKey, t.ticketNumber);
  return t;
}

/** Kontrolü Validating Carrier'a geri ver (1.1.5.1: kontrol yalnız VC'ye döner). */
export async function returnControl(input: ControlInput): Promise<Ticket> {
  await delay(400);
  const t = store.find((x) => x.ticketNumber === input.ticketNumber);
  if (!t) throw new DomainError("Bilet bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) return t;
  if (t.control.holder === t.validatingCarrier) throw new DomainError("Kontrol zaten Validating Carrier'da.");
  const from = t.control.holder;
  t.control = { holder: t.validatingCarrier, isValidatingCarrier: true };
  t.history.push(event("ControlReturned", { detail: `Kontrol ${from} → ${t.validatingCarrier} (Validating Carrier) iade edildi`, status: "O" }));
  opKeys.set(input.idempotencyKey, t.ticketNumber);
  return t;
}

/**
 * Kontrol talebi (Request Control Message, 12.13.2): kontrol başka taşıyıcıdayken
 * reissue/refund yapılabilmesi için Validating Carrier'dan kontrol istenir.
 * Talep interline kuyruğuna düşer; yanıt gelene kadar işlem açılmaz.
 */
export async function requestControl(input: ControlInput): Promise<Ticket> {
  await delay(400);
  const t = store.find((x) => x.ticketNumber === input.ticketNumber);
  if (!t) throw new DomainError("Bilet bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) return t;
  if (t.control.holder === SESSION_CARRIER) throw new DomainError("Kontrol zaten sizde.");
  MOCK_MESSAGES.unshift({
    id: "m-" + crypto.randomUUID().slice(0, 8),
    standard: "EDIFACT",
    messageType: "TKTREQ",
    direction: "outbound",
    partnerCarrier: t.control.holder,
    ticketNumber: t.ticketNumber,
    occurredAt: new Date().toISOString(),
    status: "sent",
    summary: `Request Control · ${t.ticketNumber} · ${input.reason ?? "reissue/refund"}`,
    payloadPreview: `TKTREQ\nTKT:${t.ticketNumber}\nREQ:CONTROL\nFROM:${SESSION_CARRIER}\nTO:${t.control.holder}`,
  });
  t.history.push(event("ControlRequested", {
    detail: `${t.control.holder}'dan kontrol talep edildi${input.reason ? " · " + input.reason : ""}`,
  }));
  opKeys.set(input.idempotencyKey, t.ticketNumber);
  return t;
}

/** EMD-A ↔ ET kupon statü senkronu (5.2.2/5.3): bağlı ET kuponu ilerledikçe EMD-A kuponu izler. */
function cascadeEmdA(ticketNumber: string, couponSeq: number, to: CouponStatus): void {
  for (const e of emdStore) {
    if (e.type !== "A" || e.associatedTicket !== ticketNumber || e.associatedCouponSeq !== couponSeq) continue;
    const ec = e.coupons[0];
    if (ec && canTransition(ec.status, to)) ec.status = to;
  }
}

export interface RefundInput {
  ticketNumber: string;
  couponSeqs: number[];
  refundAmount: Money;
  /** 12.7.3 / 15.3 — iade doğuran reissue bakiyesi; "For Refund Only" belge olarak kesilir. */
  residual?: Money;
  /** 15.1.1 — iadenin türü. Hesap kuralı buna göre değişir (15.1.2 vs 15.1.3.1). */
  refundType?: RefundType;
  /** 15.1.1.1 — involuntary iadenin sebebi. */
  involuntaryReason?: InvoluntaryReason;
  /** 15.1.3.1 — voluntary iadede düşülen kesintiler. */
  serviceCharge?: number;
  communicationExpenses?: number;
  /** Vefat/hastalık muafiyeti (Ch 13.9/13.10, 15.4) — iptal cezası muaf, validity uzatılabilir. */
  waiver?: "death" | "illness";
  /** Yalnız vergi (TFC) iadesi — iade edilemez fare'lerde kupon O→Y→R akışı (1.1.4.1/1.3.5). */
  taxOnly?: boolean;
  /** İade yöntemi: orijinal FOP (varsayılan) ya da voucher/travel-credit → EMD-S kesilir. */
  method?: "fop" | "voucher";
  /** 15.1.3.2 — belgeyi düzenleyen taşıyıcı biz değilsek onun onay/referansı. */
  issuerAuthorityRef?: string;
  /** Ciro "NON-REF" gibi bir kısıt taşıyorsa yetkili override'ı. */
  restrictionOverride?: string;
  idempotencyKey: string;
}

export async function refundTicket(input: RefundInput): Promise<Ticket> {
  await delay(700);
  const t = store.find((x) => x.ticketNumber === input.ticketNumber);
  if (!t) throw new DomainError("Bilet bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) return t;

  // 1.1.5.3 — iade için kuponun zilyetliği bizde olmalı.
  assertControl(t, "İade");

  // 15.1.3.2 — belgeyi düzenleyen taşıyıcıya başvurmadan iade yapılamaz.
  if (t.validatingCarrier !== SESSION_CARRIER && !input.issuerAuthorityRef?.trim())
    throw new DomainError(
      `Bu belgeyi ${t.validatingCarrier} düzenledi; iade için düzenleyen taşıyıcının onay/referansı zorunlu (15.1.3.2).`,
    );
  // 15.1.3.2 — FOP ya da ciro iadeyi kısıtlıyorsa engelle (yetkili override edebilir).
  const restricted = /NON[- ]?REF|NONREFUNDABLE|IADE EDILEMEZ/i.test(t.endorsement ?? "");
  if (restricted && !input.restrictionOverride?.trim())
    throw new DomainError(`Ciro/kısıtlama iadeyi engelliyor: "${t.endorsement}" — yetkili override gerekir (15.1.3.2).`);

  for (const seq of input.couponSeqs) {
    const c = t.coupons.find((x) => x.seq === seq);
    if (!c) throw new DomainError(`Kupon #${seq} yok.`);
    // İade uygunluğu: O, A veya Y (Handbook 1.3.5 / 15.1.7).
    if (!isRefundable(c.status))
      throw new DomainError(`Kupon #${seq} iadeye uygun değil (${c.status}) — O/A/Y olmalı (1.3.5).`);
  }

  const affected: Coupon[] = [];
  input.couponSeqs.forEach((seq) => {
    const c = t.coupons.find((x) => x.seq === seq)!;
    // Yalnız-TFC iadesi: kupon önce Y (Refund TFC) ile işaretlenir, sonra R (1.1.4.1).
    if (input.taxOnly && c.status === "O") c.status = applyTransition(c.status, "Y");
    c.status = applyTransition(c.status, "R");
    affected.push(c);
    cascadeEmdA(t.ticketNumber, seq, "R"); // EMD-A senkronu (5.3)
  });
  // 1.3.6 — iade de settlement doğurur: işlem başına tek SAC.
  const sac = stampSac(affected);

  // Parasal döküm: metinden ayrıştırılmaz, sunucu KENDİ hesabını yazar.
  // (Statüler yukarıda değişti; tarife hesabı kupon durumundan bağımsız
  // olduğu için aynı girdilerle yeniden üretilebilir.)
  const q = quoteRefund({
    ticket: t,
    couponSeqs: input.couponSeqs,
    refundType: input.refundType ?? "voluntary",
    reason: input.involuntaryReason,
    serviceCharge: input.serviceCharge,
    communicationExpenses: input.communicationExpenses,
    taxOnly: input.taxOnly,
  });
  const taxTotal = q.tfcLines.reduce((sum, l) => sum + l.amount, 0);
  const money = {
    currency: input.refundAmount.currency,
    gross: input.refundAmount.amount,
    // Sistemin hesabı da saklanır: gross ondan farklıysa elle müdahale var.
    quotedGross: q.amount.amount,
    penalty: q.penalty,
    noShowFee: q.noShowFee,
    serviceCharge: q.deductions,
    taxRefunded: q.tfcComponent,
    taxForfeited: Math.max(0, round2(taxTotal - q.tfcComponent)),
    refundType: input.refundType ?? "voluntary",
    // KDV: biletin TAMAMININ değil, iade edilen ÜCRETLE ORANTILI kısmı düzeltilir.
    // (Aksi hâlde kısmi iadelerde tahsil edilenden fazla KDV iade edilmiş görünürdü.)
    ...(t.fare.vat ? { vat: q.vatRefunded, vatRate: t.fare.vat.rate } : {}),
  };

  const waiverLabel = input.waiver === "death" ? "vefat (ceza muaf)" : input.waiver === "illness" ? "hastalık (ceza muaf)" : null;
  if (input.taxOnly) {
    t.history.push(event("CouponRefunded", { couponSeq: input.couponSeqs[0], detail: "Yalnız vergi (TFC) iadesi işaretlendi — O→Y (Refund TFC)", status: "Y" }));
  }
  const typeLabel = input.refundType === "involuntary" ? "Involuntary" : "Voluntary";
  t.history.push(
    event("CouponRefunded", {
      couponSeq: input.couponSeqs[0],
      detail: `${typeLabel} ${input.taxOnly ? "TFC " : ""}iade ${input.refundAmount.amount.toLocaleString("en-US")} ${input.refundAmount.currency}` +
        (input.involuntaryReason ? ` · ${input.involuntaryReason}` : "") +
        (input.serviceCharge ? ` · service charge ${input.serviceCharge}` : "") +
        (input.communicationExpenses ? ` · iletişim gideri ${input.communicationExpenses}` : "") +
        (input.residual ? ` · residual ${input.residual.amount.toLocaleString("en-US")} ${input.residual.currency} (For Refund Only)` : "") +
        (waiverLabel ? ` · waiver: ${waiverLabel}` : "") +
        (input.method === "voucher" ? " · voucher (EMD-S travel credit)" : "") +
        ` · SAC ${sac}`,
      status: "R",
      money,
    }),
  );

  // İade kaydı — Refund-Cancel (12.13.2) bunu geri alır.
  const record: RefundRecord = {
    id: "rf-" + crypto.randomUUID().slice(0, 8),
    at: new Date().toISOString(),
    couponSeqs: [...input.couponSeqs],
    amount: input.refundAmount,
    refundType: input.refundType ?? "voluntary",
    reason: input.involuntaryReason,
    sac,
  };
  t.refunds = [record, ...(t.refunds ?? [])];

  // Voucher/travel-credit iadesi: tutar EMD-S olarak kesilir; sonraki bilette FOP olarak kullanılır.
  if (input.method === "voucher") {
    const voucher: Emd = {
      emdNumber: buildTicketNumber("235", String(emdSerial++)),
      type: "S",
      passenger: t.passenger,
      issuingCarrier: t.validatingCarrier,
      issuedAt: new Date().toISOString(),
      associatedTicket: t.ticketNumber,
      coupons: [{ seq: 1, status: "O", rfisc: "99I", description: "İade voucher'ı / travel credit", value: input.refundAmount }],
      total: input.refundAmount,
    };
    emdStore.unshift(voucher);
    t.history.push(event("EmdIssued", { detail: `Voucher EMD-S ${voucher.emdNumber} · ${input.refundAmount.amount.toLocaleString("en-US")} ${input.refundAmount.currency}`, status: "O" }));
  }

  // 15.3 — iade doğuran bakiye "For Refund Only" belgesiyle iade edilir; belge
  // yalnız orijinal düzenleyen taşıyıcı tarafından iade edilebilir.
  if (input.residual && input.residual.amount > 0) {
    const mco: Emd = {
      emdNumber: buildTicketNumber("235", String(emdSerial++)),
      type: "S",
      passenger: t.passenger,
      issuingCarrier: t.validatingCarrier,
      issuedAt: new Date().toISOString(),
      associatedTicket: t.ticketNumber,
      forRefundOnly: true,
      coupons: [{ seq: 1, status: "O", rfisc: "98D", description: "Residual value — For Refund Only", value: input.residual }],
      total: input.residual,
      endorsement: `FOR REFUND ONLY / DRAWN ON ${t.validatingCarrier}`,
    };
    emdStore.unshift(mco);
    t.history.push(event("EmdIssued", {
      detail: `Residual "For Refund Only" belgesi ${mco.emdNumber} · ${input.residual.amount.toLocaleString("en-US")} ${input.residual.currency} (15.3)`,
      status: "O",
    }));
  }

  // 1.1.4.3 — iade edilen her kupon için partner veritabanına statü bildirilir.
  for (const seq of input.couponSeqs) emitStatusUpdate(t, seq, input.taxOnly ? "Y" : "R");

  opKeys.set(input.idempotencyKey, t.ticketNumber);
  return t;
}

/**
 * Refund-Cancel (12.13.2 · 1.3.6).
 *
 * Handbook birebir: acente bileti iade ettikten sonra **aynı raporlama dönemi
 * içinde** iadeyi geri alırsa kupon "open for use"a döner. İşlem yeni bir SAC
 * üretir. Dönem kapandıysa geri alınamaz — iade kesinleşmiştir.
 */
export interface RefundCancelInput {
  ticketNumber: string;
  refundId: string;
  reason?: string;
  idempotencyKey: string;
}
export async function refundCancel(input: RefundCancelInput): Promise<Ticket> {
  await delay(600);
  const t = store.find((x) => x.ticketNumber === input.ticketNumber);
  if (!t) throw new DomainError("Bilet bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) return t;
  const rec = t.refunds?.find((r) => r.id === input.refundId);
  if (!rec) throw new DomainError("İade kaydı bulunamadı.");
  if (rec.cancelledAt) throw new DomainError("Bu iade zaten geri alınmış.");
  if (!inCurrentReportingPeriod(rec.at))
    throw new DomainError(
      `İade ${reportingPeriodId(rec.at)} raporlama döneminde yapılmış; geri alma yalnız AYNI dönem içinde mümkündür (12.13.2).`,
    );
  assertPeriodOpen(rec.at, "iadeyi geri alma");
  assertControl(t, "İadeyi geri alma");

  const affected: Coupon[] = [];
  for (const seq of rec.couponSeqs) {
    const c = t.coupons.find((x) => x.seq === seq);
    if (!c) continue;
    c.status = applyRefundCancel(c.status); // R → O (yalnız bu komut)
    c.sac = undefined; // yeni settlement kodu üretilecek
    affected.push(c);
    cascadeEmdA(t.ticketNumber, seq, "O");
  }
  if (!affected.length) throw new DomainError("Geri alınacak kupon bulunamadı.");
  const sac = stampSac(affected);
  rec.cancelledAt = new Date().toISOString();
  // Ters kayıt: rapor motoru yalnız toplar, bu yüzden geri alma NEGATİF bir
  // iade satırı olarak yazılır — aksi hâlde gerçekleşmemiş para çıkışı dönem
  // netini kalıcı olarak düşürürdü.
  const reversal = {
    currency: rec.amount.currency,
    gross: -rec.amount.amount,
    refundType: rec.refundType,
  };
  t.history.push(event("RefundCancelled", {
    money: reversal,
    couponSeq: rec.couponSeqs[0],
    detail: `İade geri alındı (kupon ${rec.couponSeqs.join(", ")}) — kuponlar "open for use" · yeni SAC ${sac}` +
      (input.reason ? ` · ${input.reason}` : ""),
    status: "O",
  }));
  // 1.1.4.3 — kupon yeniden kullanılabilir; partner veritabanı bunu bilmeli.
  for (const c of affected) emitStatusUpdate(t, c.seq, "O");
  opKeys.set(input.idempotencyKey, t.ticketNumber);
  return t;
}

export interface ExchangeInput {
  oldTicketNumber: string;
  newSegments: Segment[];
  /** Eski akış: elle girilen ek tahsilat. Yeni fiyatlama verilirse KULLANILMAZ. */
  adc: Money;
  /** Yeni yolculuğun tarife çıktısı — verilirse ADC/ceza/bakiye SİSTEM hesaplar. */
  newBaseFare?: number;
  newTfcs?: TaxFeeCharge[];
  /** Vefat/hastalık vb. — kural izin veriyorsa değişiklik ücretini kaldırır. */
  waiver?: WaiverCode;
  /** 12.1.1 — sistemin çıkardığı değişiklik türü; kayda ve geçmişe yazılır. */
  changeType?: ChangeType;
  /** Reissue'nun gerekçesi başka bir işlemse (ad düzeltme) olay metnine o yazılır. */
  note?: string;
  idempotencyKey: string;
}
export async function exchangeTicket(input: ExchangeInput): Promise<{ oldTicket: Ticket; newTicket: Ticket }> {
  await delay(800);
  const old = store.find((x) => x.ticketNumber === input.oldTicketNumber);
  if (!old) throw new DomainError("Eski bilet bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) {
    const newTn = opKeys.get(input.idempotencyKey)!;
    return { oldTicket: old, newTicket: store.find((x) => x.ticketNumber === newTn)! };
  }
  // 1.1.5.3 / 12.2.2 — reissue için kuponların zilyetliği bizde olmalı.
  assertControl(old, "Exchange / reissue");
  const openCoupons = old.coupons.filter((c) => c.status === "O");
  if (!openCoupons.length) throw new DomainError("Değişim için 'O' statüde kupon yok.");
  // 12.9.1 — süresi dolan bilet yalnız iade edilir. 12.4.1 — yolculuk başladıysa
  // reissue orijinal geçerlilik sonunu aşamaz (kullanılmamış bilette yeni
  // yolculuktan itibaren yeniden 1 yıl işler, sınır yok).
  const expiredMsg = changeBlockedByValidity(old, demoNow());
  if (expiredMsg) throw new DomainError(expiredMsg);
  if (travelCommenced(old)) {
    for (const seg of input.newSegments) {
      const beyond = beyondValidity(old, seg.departure, demoNow());
      if (beyond) throw new DomainError(beyond);
    }
  }

  // 12.1.1 — değişiklik türü sistemce sınıflandırılır ve kayda geçer.
  // Yalnız rezervasyon değişikliğinde (REBOOKING) reissue ŞART DEĞİLDİR; bu
  // durumda arayüz personeli revalidation'a yönlendirir. Komut yine de
  // çalışır: yeni tarih farklı bir ücret taşıyorsa reissue meşrudur.
  const analysis = classifyChange(old, input.newSegments);

  const newTicketNumber = buildTicketNumber("235", String(serialCounter++));
  const now = new Date().toISOString();

  // Eski açık kuponlar → E (Exchanged)
  openCoupons.forEach((c) => {
    c.status = applyTransition(c.status, "E");
    cascadeEmdA(old.ticketNumber, c.seq, "E"); // EMD-A senkronu (5.3)
    emitStatusUpdate(old, c.seq, "E"); // 1.1.4.3 — partner veritabanı senkronu
  });
  stampSac(openCoupons); // 1.3.6: bu değişim işlemi için tek SAC
  old.history.push(event("CouponExchanged", {
    couponSeq: openCoupons[0].seq,
    detail: input.note
      ? `${input.note} — yeni bilete dönüştürüldü (eşit reissue)`
      : `${analysis.type.toUpperCase()} — yeni bilete dönüştürüldü · ${analysis.rationale}`,
    linkedTicketNumber: newTicketNumber,
    status: "E",
  }));

  // Para hesabı: yeni fiyatlama verildiyse SİSTEM hesaplar (12.5/12.11 + Cat 31),
  // verilmediyse elle girilen ADC kullanılır (eski akış).
  const cur = old.fare.total.currency;
  const quote = input.newBaseFare != null
    ? quoteReissue({
        ticket: old,
        newBaseFare: input.newBaseFare,
        newTfcs: input.newTfcs ?? old.fare.tfcs,
        newSegments: input.newSegments,
        waiver: input.waiver,
      })
    : null;
  const newBaseFare = quote ? quote.newFare : old.fare.baseFare.amount + input.adc.amount;
  const newTfcs = quote ? (input.newTfcs ?? old.fare.tfcs) : old.fare.tfcs;
  const newTotalTfc = newTfcs.reduce((sum, t) => sum + t.amount.amount, 0);
  const baseTotal = newBaseFare + newTotalTfc;
  const newTicket: Ticket = {
    ticketNumber: newTicketNumber,
    pnr: old.pnr,
    passenger: old.passenger,
    validatingCarrier: old.validatingCarrier,
    issuedAt: now,
    formOfPayment: old.formOfPayment,
    control: { holder: old.validatingCarrier, isValidatingCarrier: true },
    coupons: input.newSegments.map((segment, i) => ({ seq: i + 1, status: "O" as const, segment })),
    fare: {
      baseFare: { amount: newBaseFare, currency: cur },
      totalTfc: { amount: newTotalTfc, currency: cur },
      total: { amount: baseTotal, currency: cur },
      // 12.5(c): önceki biletten taşınan kalemler "PD" işaretiyle gelir; yeniden tahsil edilmez.
      tfcs: newTfcs.map((t) => ({ ...t, paid: true })),
      fareCalcString: old.fare.fareCalcString,
      nuc: old.fare.nuc,
      roe: old.fare.roe,
    },
    history: [
      event("TicketReissued", {
        detail: `Issued in exchange for ${old.ticketNumber} · ${input.note ?? analysis.type.toUpperCase()}` +
          ` · fiyatlama ${analysis.partiallyUsed ? "orijinal kesim tarihi (12.1.1 REISSUE)" : "güncel tarife (12.1.1 EXCHANGE)"}` +
          (quote
            ? ` · ücret farkı ${quote.fareDiff.toLocaleString("en-US")} · artan vergi ${quote.tfcAdditional.toLocaleString("en-US")}` +
              (quote.penalty ? ` · değişiklik ücreti ${quote.penalty.toLocaleString("en-US")}` : "") +
              ` · ${quote.totalBoxText}`
            : ` · ${input.adc.amount >= 0 ? "ADC" : "residual"} ${Math.abs(input.adc.amount).toLocaleString("en-US")} ${input.adc.currency}` +
              (input.adc.amount === 0 ? " (NO ADC)" : "")),
        money: quote
          ? {
              currency: cur,
              adc: quote.adc,
              penalty: quote.penalty,
              taxRefunded: quote.tfcRefunded,
              taxForfeited: quote.tfcForfeited,
              residual: quote.residual?.amount ?? 0,
              gross: baseTotal,
            }
          : { currency: cur, adc: Math.max(0, input.adc.amount), gross: baseTotal },
        linkedTicketNumber: old.ticketNumber,
        status: "O",
      }),
      ...input.newSegments.map((s, i) =>
        event("CouponAdded", { couponSeq: i + 1, detail: `${s.origin}→${s.destination} ${s.marketingCarrier}${s.flightNumber.replace(/^\D+/, "")}`, status: "O" }),
      ),
    ],
  };
  store.unshift(newTicket);

  // 12.11.2.1 — bakiye ADC ile netlenmez; ayrı belgeyle dışarı çıkar.
  // İade edilebilir bilette MCO (For Refund Only), değilse yalnız gelecekteki
  // seyahat için EMD-S (residual value).
  if (quote?.residual) {
    const r = quote.residual;
    const doc: Emd = {
      emdNumber: buildTicketNumber("235", String(emdSerial++)),
      type: "S",
      passenger: old.passenger,
      issuingCarrier: old.validatingCarrier,
      issuedAt: now,
      associatedTicket: newTicketNumber,
      forRefundOnly: r.refundable,
      coupons: [{
        // 98D = Residual Value (refund) · 996 = RSVR residual value EMD-S (sektör kodu)
        seq: 1, status: "O", rfisc: r.refundable ? "98D" : "996",
        description: r.refundable ? "Residual value — For Refund Only" : "Residual value — yalnız gelecekteki seyahat",
        value: { amount: r.amount, currency: r.currency },
      }],
      total: { amount: r.amount, currency: r.currency },
      endorsement: r.refundable
        ? `FOR REFUND ONLY / DRAWN ON ${old.validatingCarrier}`
        : `NONREF / VALID ${old.validatingCarrier} ONLY / NOT TRANSFERABLE`,
    };
    emdStore.unshift(doc);
    newTicket.history.push(event("EmdIssued", {
      detail: `Bakiye belgesi ${doc.emdNumber} · ${r.amount.toLocaleString("en-US")} ${r.currency}` +
        (r.penaltyDeducted ? ` (değişiklik ücreti ${r.penaltyDeducted.toLocaleString("en-US")} düşüldü)` : "") +
        ` · ${r.note}`,
      status: "O",
    }));
  }

  opKeys.set(input.idempotencyKey, newTicketNumber);
  return { oldTicket: old, newTicket };
}

// =====================================================================
// FE-5/6/7 getter'lar
// =====================================================================
// Demo için birkaç EMD tohumla (mock store'daki biletlerden deterministik) — /emds arama
// sayfasının anlamlı veriyle dolması için. Gerçekte EMD'ler kesim akışıyla oluşur.
const EMD_PRESETS = [
  { rfisc: "0CC", desc: "Fazla Bagaj 23kg", amount: 1200 },
  { rfisc: "0B5", desc: "Ekstra Koltuk (ön sıra)", amount: 850 },
  { rfisc: "0DF", desc: "Lounge erişimi", amount: 600 },
  { rfisc: "0G6", desc: "Evcil hayvan (kabin, PETC)", amount: 1500 },
  { rfisc: "0IK", desc: "Wi-Fi paketi", amount: 350 },
];
function seedEmds(tickets: Ticket[]): Emd[] {
  const out: Emd[] = [];
  tickets.forEach((t, i) => {
    if (i % 3 !== 0) return; // her 3. bilete bir EMD
    const p = EMD_PRESETS[i % EMD_PRESETS.length];
    const type: EmdType = i % 6 === 0 ? "A" : "S";
    out.push({
      emdNumber: buildTicketNumber("235", String(900000 + i * 7)),
      type,
      passenger: t.passenger,
      issuingCarrier: t.validatingCarrier,
      issuedAt: t.issuedAt,
      associatedTicket: t.ticketNumber,
      associatedCouponSeq: type === "A" ? 1 : undefined,
      coupons: [{ seq: 1, status: "O", rfisc: p.rfisc, description: p.desc, value: { amount: p.amount, currency: "TRY" } }],
      total: { amount: p.amount, currency: "TRY" },
    });
  });
  return out;
}
const emdStore: Emd[] = [...MOCK_EMDS, ...seedEmds(store)];
let emdSerial = 200300400;

export async function listEmdsForTicket(ticketNumber: string): Promise<Emd[]> {
  await delay(200);
  return emdStore.filter((e) => e.associatedTicket === ticketNumber);
}

// ===== EMD retrieval (Handbook Ch 5) — bağımsız arama/açma (Amadeus EWD muadili) =====
export async function listEmds(): Promise<Emd[]> {
  await delay(220);
  return [...emdStore];
}
export async function getEmd(emdNumber: string): Promise<Emd | undefined> {
  await delay(220);
  return emdStore.find((e) => e.emdNumber === emdNumber.trim());
}
export async function searchEmds(query: string): Promise<Emd[]> {
  await delay(200);
  const q = query.trim().toUpperCase();
  if (!q) return [...emdStore];
  return emdStore.filter(
    (e) =>
      e.emdNumber.includes(q) ||
      e.passenger.surname.toUpperCase().includes(q) ||
      e.passenger.givenName.toUpperCase().includes(q) ||
      e.associatedTicket?.includes(q) ||
      e.coupons.some((c) => c.rfisc.toUpperCase().includes(q) || c.description.toUpperCase().includes(q)),
  );
}

// ===== Satış / İşlem sorgu raporu (Amadeus TJQ muadili) =====
// Event-sourcing gücü: her biletin history[]'sinden çapraz-belge audit raporu türetilir.
// "Bugünkü tüm void'ler", "01-31 Tem iadeler", "personel X'in işlemleri" gibi sorgular.
export type TxCategory = "issue" | "void" | "refund" | "exchange" | "emd" | "checkin" | "other";
export interface TransactionRow {
  id: string;
  ticketNumber: string;
  passengerName: string;
  category: TxCategory;
  type: LifecycleEventType;
  occurredAt: string;
  actor: string;
  detail?: string;
  carrier: string;
  amount?: Money; // kesimde bilet toplamı
  status?: CouponStatus;
  /** Parasal döküm — mali rapor ve dönem kapanışı bunu okur. */
  money?: EventMoney;
  /** Ait olduğu raporlama dönemi (gün). */
  periodId: string;
}
export interface TransactionQuery {
  text?: string;
  category?: TxCategory | "all";
  from?: string; // yyyy-mm-dd
  to?: string;
  carrier?: string;
}
function txCategory(type: LifecycleEventType): TxCategory {
  switch (type) {
    case "TicketIssued": case "PtaIssued": return "issue";
    case "TicketVoided": return "void";
    case "CouponRefunded": return "refund";
    // Refund-Cancel ve EMD iadesi de iade kovasına düşer; ters kayıt negatif gross taşır.
    case "RefundCancelled": case "EmdRefunded": return "refund";
    case "EmdVoided": return "void";
    case "CouponExchanged": case "TicketReissued": return "exchange";
    case "EmdIssued": return "emd";
    case "CouponCheckedIn": case "CouponLifted": case "CouponFlown": return "checkin";
    default: return "other";
  }
}
export async function queryTransactions(qc: TransactionQuery = {}): Promise<TransactionRow[]> {
  await delay(240);
  let rows: TransactionRow[] = store.flatMap((t) =>
    t.history.map((h) => ({
      id: t.ticketNumber + h.id,
      ticketNumber: t.ticketNumber,
      passengerName: `${t.passenger.surname}/${t.passenger.givenName}`,
      category: txCategory(h.type),
      type: h.type,
      occurredAt: h.occurredAt,
      actor: h.actor,
      detail: h.detail,
      carrier: t.validatingCarrier,
      amount: h.money?.gross != null
        ? { amount: h.money.gross, currency: h.money.currency }
        : h.type === "TicketIssued" ? t.fare.total : undefined,
      status: h.status,
      money: h.money,
      periodId: reportingPeriodId(h.occurredAt),
    })),
  );
  if (qc.category && qc.category !== "all") rows = rows.filter((x) => x.category === qc.category);
  if (qc.carrier?.trim()) rows = rows.filter((x) => x.carrier.toUpperCase().includes(qc.carrier!.trim().toUpperCase()));
  if (qc.from?.trim()) rows = rows.filter((x) => new Date(x.occurredAt) >= new Date(qc.from!));
  if (qc.to?.trim()) rows = rows.filter((x) => new Date(x.occurredAt) <= new Date(qc.to! + "T23:59:59"));
  if (qc.text?.trim()) {
    const q = qc.text.trim().toUpperCase();
    rows = rows.filter((x) => x.ticketNumber.includes(q) || x.passengerName.toUpperCase().includes(q) || x.actor.toUpperCase().includes(q) || (x.detail?.toUpperCase().includes(q) ?? false));
  }
  return rows.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

export interface AddEmdInput {
  ticketNumber: string;
  couponSeq?: number;
  type: "A" | "S";
  rfisc: string;
  description: string;
  value: Money;
  idempotencyKey: string;
}
export async function addEmd(input: AddEmdInput): Promise<Emd> {
  await delay(600);
  // Idempotency: aynı key → tam olarak aynı EMD (fuzzy find değil; standalone'da undefined dönüp crash etmesin).
  const priorEmd = opKeys.get(input.idempotencyKey);
  if (priorEmd) return emdStore.find((e) => e.emdNumber === priorEmd)!;
  const t = store.find((x) => x.ticketNumber === input.ticketNumber);
  if (!t) throw new DomainError("Bilet bulunamadı.");
  // EMD-A doğrulaması (Ch 5.8): bağlanılan ET kuponu var olmalı ve FINAL statüde OLMAMALI.
  if (input.type === "A") {
    const target = t.coupons.find((c) => c.seq === input.couponSeq);
    if (!target) throw new DomainError(`Kupon #${input.couponSeq ?? "?"} bu bilette yok — EMD-A bağlanamaz (Ch 5).`);
    if (isFinal(target.status)) throw new DomainError(`Kupon #${target.seq} final statüde (${target.status}) — EMD-A kesilemez (5.8).`);
  }
  const emd: Emd = {
    emdNumber: buildTicketNumber("235", String(emdSerial++)),
    type: input.type,
    passenger: t.passenger,
    issuingCarrier: t.validatingCarrier,
    issuedAt: new Date().toISOString(),
    // EMD-A kupona bağlı; EMD-S bu biletle "in connection with" — her iki halde de bilete iliştir ki
    // EmdSection'da görünsün (aksi halde standalone EMD kesilince "kayboluyor"). couponSeq sadece EMD-A'da.
    associatedTicket: input.ticketNumber,
    associatedCouponSeq: input.type === "A" ? input.couponSeq : undefined,
    coupons: [{ seq: 1, status: "O", rfisc: input.rfisc, description: input.description, value: input.value }],
    total: input.value,
  };
  emdStore.unshift(emd);
  t.history.push(event("EmdIssued", {
    detail: `EMD-${input.type} ${input.rfisc} · ${input.description}`,
    status: "O",
    money: { currency: input.value.currency, gross: input.value.amount },
  }));
  opKeys.set(input.idempotencyKey, emd.emdNumber);
  return emd;
}

// =====================================================================
// Ch 5.5 — EMD void ve iade
// V (Void) = "Validating Carrier'ın raporlama dönemi içinde TÜM EMD satış
// işleminin iptali". R (Refund) = kullanılmayan değerin yolcuya iadesi.
// =====================================================================
export interface EmdOpInput {
  emdNumber: string;
  reason?: string;
  idempotencyKey: string;
}

function emdEvent(e: Emd, ev: LifecycleEvent): void {
  e.history = [...(e.history ?? []), ev];
}

export async function voidEmd(input: EmdOpInput): Promise<Emd> {
  await delay(550);
  const e = emdStore.find((x) => x.emdNumber === input.emdNumber);
  if (!e) throw new DomainError("EMD bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) return e;
  // 5.5 "V": TÜM satış işleminin iptali → tüm kuponlar açık olmalı.
  const notOpen = e.coupons.filter((c) => c.status !== "O");
  if (notOpen.length)
    throw new DomainError(`Void için EMD'nin tüm kuponları 'O' olmalı. Engel: ${notOpen.map((c) => `#${c.seq}(${c.status})`).join(", ")} (5.5).`);
  assertPeriodOpen(e.issuedAt, "EMD void"); // kapanmış dönemde belge statüsü değişmez
  // 5.5 "V": yalnız Validating Carrier'ın raporlama dönemi içinde.
  if (!inCurrentReportingPeriod(e.issuedAt))
    throw new DomainError(
      `EMD ${reportingPeriodId(e.issuedAt)} döneminde kesilmiş; void yalnız kesim döneminde mümkündür — iade (refund) kullanın (5.5).`,
    );
  e.coupons.forEach((c) => { c.status = applyTransition(c.status, "V"); });
  const voidMoney = { currency: e.total.currency, gross: e.total.amount };
  emdEvent(e, event("EmdVoided", { detail: `EMD void edildi${input.reason ? " · " + input.reason : ""}`, status: "V", money: voidMoney }));
  const t = e.associatedTicket ? store.find((x) => x.ticketNumber === e.associatedTicket) : undefined;
  t?.history.push(event("EmdVoided", { detail: `EMD ${e.emdNumber} void edildi`, status: "V", money: voidMoney }));
  opKeys.set(input.idempotencyKey, e.emdNumber);
  return e;
}

export async function refundEmd(input: EmdOpInput): Promise<Emd> {
  await delay(550);
  const e = emdStore.find((x) => x.emdNumber === input.emdNumber);
  if (!e) throw new DomainError("EMD bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) return e;
  const eligible = e.coupons.filter((c) => isRefundable(c.status));
  if (!eligible.length)
    throw new DomainError(`İadeye uygun EMD kuponu yok — kuponlar O/A/Y olmalı (5.5).`);
  eligible.forEach((c) => { c.status = applyTransition(c.status, "R"); });
  const refundedValue = eligible.reduce((sum, c) => sum + c.value.amount, 0);
  const refundMoney = { currency: e.total.currency, gross: refundedValue, refundType: "voluntary" as const };
  emdEvent(e, event("EmdRefunded", { detail: `EMD iadesi · ${refundedValue.toLocaleString("en-US")} ${e.total.currency}${input.reason ? " · " + input.reason : ""}`, status: "R", money: refundMoney }));
  const t = e.associatedTicket ? store.find((x) => x.ticketNumber === e.associatedTicket) : undefined;
  t?.history.push(event("EmdRefunded", { detail: `EMD ${e.emdNumber} iade edildi`, status: "R", money: refundMoney }));
  opKeys.set(input.idempotencyKey, e.emdNumber);
  return e;
}

export async function listMessages(): Promise<InterlineMessage[]> {
  await delay(220);
  return [...MOCK_MESSAGES].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

export async function listAgreements(): Promise<BilateralAgreement[]> {
  await delay(180);
  return [...MOCK_AGREEMENTS];
}

/**
 * Order görünümü CANLI belgelerden türer.
 *
 * Order "system of record" iddiasındadır; oysa kalem statüleri sabit yazılmıştı
 * ve bilet void/iade edildiğinde order hâlâ "Fulfilled · O" görünüyordu — yani
 * kaydın kendisi yalan söylüyordu. Artık her kalem bağlı ET/EMD'den okunur,
 * order statüsü de kalemlerden çıkar:
 *   · hepsi iptal/void            → Cancelled
 *   · hepsi final (uçuldu/kapandı)→ Closed
 *   · en az biri kullanıldı       → Fulfilled
 *   · aksi                        → Confirmed
 */
function projectOrder(o: Order): Order {
  const items = o.items.map((it) => {
    if (it.kind === "ticket") {
      const t = store.find((x) => x.ticketNumber === it.reference);
      // Temsili statü: ilk açık kupon, yoksa ilk kuponun (final) statüsü.
      const rep = t && (t.coupons.find((c) => !isFinal(c.status))?.status ?? t.coupons[0]?.status);
      return rep ? { ...it, statusSummary: rep } : it;
    }
    const e = emdStore.find((x) => x.emdNumber === it.reference);
    return e?.coupons[0] ? { ...it, statusSummary: e.coupons[0].status } : it;
  });

  const codes = items.map((i) => i.statusSummary);
  const dead: CouponStatus[] = ["V", "R"];
  const used: CouponStatus[] = ["C", "L", "F"];
  const status: OrderStatus =
    codes.every((c) => dead.includes(c)) ? "Cancelled"
      : codes.every((c) => isFinal(c)) ? "Closed"
        : codes.some((c) => used.includes(c)) ? "Fulfilled"
          : "Confirmed";

  return { ...o, items, status };
}

export async function listOrders(): Promise<Order[]> {
  await delay(240);
  return MOCK_ORDERS.map(projectOrder);
}

export async function getOrder(orderId: string): Promise<Order | undefined> {
  await delay(220);
  const o = MOCK_ORDERS.find((x) => x.orderId === orderId);
  return o && projectOrder(o);
}

/**
 * Kupon statü güncelle (FSM ile). QuickCheck-in modülü buradan Troya kuponunu ilerletir
 * (O→A→C→L→F). Cross-modül "tek motor" linkage örneği. Bilet/kupon yoksa sessiz geçer.
 */
export async function advanceCouponStatus(ticketNumber: string, couponSeq: number, to: CouponStatus): Promise<void> {
  await delay(120);
  const t = store.find((x) => x.ticketNumber === ticketNumber);
  const c = t?.coupons.find((x) => x.seq === couponSeq);
  if (!t || !c) return;
  // Sıralı kullanım (1.1.4.4/2.4.2): önceki kupon hâlâ O iken sonraki kupon kullanılamaz.
  if (to === "C" || to === "L" || to === "F") {
    const openBefore = t.coupons.filter((x) => x.seq < couponSeq && x.status === "O");
    if (openBefore.length) {
      throw new DomainError(`Kuponlar sırayla kullanılır (out of sequence) — önce kupon #${openBefore[0].seq} (O) işlem görmeli.`);
    }
  }
  // 1.1.4.1 "F": Flown statüsünü YALNIZ kontrolü elinde tutan taşıyıcı yazabilir.
  if (to === "F" && t.control.holder !== SESSION_CARRIER)
    throw new DomainError(`Flown statüsünü yalnız kontrolü elinde tutan taşıyıcı yazabilir — kontrol ${t.control.holder}'da (1.1.4.1).`);

  c.status = applyTransition(c.status, to);
  // 1.1.4.1: A/C/L/I kontrol süresini başlatır ya da uzatır.
  if (to === "A" || to === "C" || to === "L" || to === "I") {
    const acquired = t.control.acquiredAt ?? new Date().toISOString();
    t.control = {
      ...t.control,
      acquiredAt: acquired,
      deadlineAt: controlDeadline(c.segment.departure, acquired, to),
    };
  }
  if (to === "F") {
    stampSac([c]); // SAC (1.3.6): F finaline geçişte üretilir
    // Kupon uçtu → kontrol Validating Carrier'a döner (1.1.4.1).
    if (t.coupons.every((x) => isFinal(x.status) || x.status === "O")) {
      t.control = { holder: t.validatingCarrier, isValidatingCarrier: true };
    }
  }
  cascadeEmdA(ticketNumber, couponSeq, to); // EMD-A senkronu (5.2.2)
  t.history.push(event("CouponCheckedIn", { couponSeq, detail: `QuickCheck-in → ${to}`, status: to }));
  emitStatusUpdate(t, couponSeq, to); // 1.1.4.3 interline senkronu
}

/**
 * Havalimanı kontrolü al (O→A, Handbook 1.1.4.1 "A").
 *
 * Operating Carrier kalkıştan önce kuponu havalimanı kontrolüne alır; böylece
 * statüyü link izni beklemeden yerelde günceller. Kupon zincirinin ilk halkası
 * buydu ve hiçbir ekrandan yazılamıyordu.
 */
export async function takeAirportControl(ticketNumber: string, couponSeq: number): Promise<void> {
  await delay(150);
  const t = store.find((x) => x.ticketNumber === ticketNumber);
  const c = t?.coupons.find((x) => x.seq === couponSeq);
  if (!t || !c) return;
  if (c.status !== "O") return; // zaten kontrolde ya da ilerlemiş
  c.status = applyTransition(c.status, "A");
  const now = new Date().toISOString();
  t.control = {
    ...t.control,
    acquiredAt: t.control.acquiredAt ?? now,
    deadlineAt: controlDeadline(c.segment.departure, t.control.acquiredAt ?? now, "A"),
  };
  t.history.push(event("ControlGranted", {
    couponSeq,
    detail: `Havalimanı kontrolü alındı — statü "O" bildirildi (1.1.4.1 A)`,
    status: "A",
  }));
  emitStatusUpdate(t, couponSeq, "A");
}

// =====================================================================
// Askıya alma / serbest bırakma — "S" (Suspended, 1.1.4).
//
// "S" statüsü tanımlıydı ama hiçbir komut onu yazamıyordu: sistemde şüpheli
// bir belge (chargeback, sahtecilik incelemesi, ödeme itirazı) donduralamıyordu.
// Askıdaki kupon KULLANILAMAZ ama biletin değeri de yok olmaz — inceleme
// bitince O'ya geri döner (FSM: O/A→S, S→O|V).
// =====================================================================
export interface SuspendInput {
  ticketNumber: string;
  couponSeqs: number[];
  reason: string;
  idempotencyKey: string;
}

export async function suspendCoupons(input: SuspendInput): Promise<Ticket> {
  await delay(400);
  const t = store.find((x) => x.ticketNumber === input.ticketNumber);
  if (!t) throw new DomainError("Bilet bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) return t; // idempotent
  assertControl(t, "Askıya alma");
  if (!input.reason.trim()) throw new DomainError("Askıya alma gerekçesi zorunlu (denetim kaydı).");

  const targets = t.coupons.filter((c) => input.couponSeqs.includes(c.seq));
  if (!targets.length) throw new DomainError("Askıya alınacak kupon seçilmedi.");
  const bad = targets.find((c) => !canTransition(c.status, "S"));
  if (bad) throw new DomainError(`Kupon #${bad.seq} (${bad.status}) askıya alınamaz — yalnız "O" ve "A" kuponlar askıya alınır.`);

  for (const c of targets) {
    c.status = applyTransition(c.status, "S");
    t.history.push(event("CouponSuspended", {
      couponSeq: c.seq,
      detail: `Askıya alındı — ${input.reason}`,
      status: "S",
    }));
    emitStatusUpdate(t, c.seq, "S");
  }
  opKeys.set(input.idempotencyKey, t.ticketNumber);
  return t;
}

/** Askıdan çıkar (S→O) — inceleme kapandı, kupon yeniden kullanılabilir. */
export async function releaseCoupons(input: SuspendInput): Promise<Ticket> {
  await delay(400);
  const t = store.find((x) => x.ticketNumber === input.ticketNumber);
  if (!t) throw new DomainError("Bilet bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) return t;
  assertControl(t, "Askıdan çıkarma");

  const targets = t.coupons.filter((c) => input.couponSeqs.includes(c.seq));
  if (!targets.length) throw new DomainError("Serbest bırakılacak kupon seçilmedi.");
  const bad = targets.find((c) => c.status !== "S");
  if (bad) throw new DomainError(`Kupon #${bad.seq} askıda değil (${bad.status}).`);

  for (const c of targets) {
    c.status = applyTransition(c.status, "O");
    t.history.push(event("CouponSuspended", {
      couponSeq: c.seq,
      detail: `Askıdan çıkarıldı — ${input.reason || "inceleme kapandı"}`,
      status: "O",
    }));
    emitStatusUpdate(t, c.seq, "O");
  }
  opKeys.set(input.idempotencyKey, t.ticketNumber);
  return t;
}

// =====================================================================
// Ch 14.4 — Bagaj girişleri (PCS / WT)
// Hak ücretten gelir; kabul edilen bagaj check-in'de kupona yazılır.
// Hakkı aşan bagaj için EMD-S kesilir (14.5) ve numarası kupona iliştirilir.
// =====================================================================
export interface BaggageInput {
  ticketNumber: string;
  couponSeq: number;
  checkedPieces?: number;
  checkedWeight?: number;
  weightUnit?: "K" | "L";
  /** Hakkı elle düzeltmek gerekirse (tarife dışı anlaşma). */
  allowance?: { type: "piece" | "weight"; value: number; unit?: "K" | "L" };
  excessEmd?: string;
  idempotencyKey: string;
}

export async function recordBaggage(input: BaggageInput): Promise<Ticket> {
  await delay(400);
  const t = store.find((x) => x.ticketNumber === input.ticketNumber);
  if (!t) throw new DomainError("Bilet bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) return t; // idempotent
  const c = t.coupons.find((x) => x.seq === input.couponSeq);
  if (!c) throw new DomainError(`Kupon #${input.couponSeq} yok.`);
  if (isFinal(c.status)) throw new DomainError(`Kupon #${c.seq} final statüde (${c.status}); bagaj yazılamaz.`);

  c.baggage = {
    ...c.baggage,
    ...(input.allowance ? { allowance: input.allowance } : {}),
    ...(input.checkedPieces != null ? { checkedPieces: input.checkedPieces } : {}),
    ...(input.checkedWeight != null ? { checkedWeight: input.checkedWeight } : {}),
    ...(input.weightUnit ? { weightUnit: input.weightUnit } : {}),
    ...(input.excessEmd ? { excessEmd: input.excessEmd } : {}),
  };
  opKeys.set(input.idempotencyKey, t.ticketNumber);

  const parts: string[] = [];
  if (input.checkedPieces != null) parts.push(`${input.checkedPieces} PCS`);
  if (input.checkedWeight != null) parts.push(`${input.checkedWeight} ${input.weightUnit ?? "K"}`);
  t.history.push(event("CouponAdded", {
    couponSeq: c.seq,
    detail: `Bagaj kaydı: ${parts.join(" · ") || "hak güncellendi"}`,
    status: c.status,
  }));
  return t;
}

// =====================================================================
// Ch 13 — IRROP / Involuntary Rerouting + FIM (Flight Interruption Manifest)
// Aksayan kupon(lar) O/A → I → G; başka carrier'a ciro (endorsement); FIM referansı.
// =====================================================================
export interface IrropInput {
  ticketNumber: string;
  couponSeqs: number[];
  reason: string; // weather / technical / atc / strike …
  endorseTo: string; // reaccommodating carrier (2 harf)
  newFlight: { carrier: string; flightNumber: string; date: string };
  idempotencyKey: string;
}
export async function irropReroute(input: IrropInput): Promise<{ ticket: Ticket; fim: string }> {
  await delay(750);
  const t = store.find((x) => x.ticketNumber === input.ticketNumber);
  if (!t) throw new DomainError("Bilet bulunamadı.");
  const prevFim = opKeys.get(input.idempotencyKey);
  if (prevFim) return { ticket: t, fim: prevFim };
  if (!input.couponSeqs.length) throw new DomainError("En az bir kupon seç.");
  for (const seq of input.couponSeqs) {
    const c = t.coupons.find((x) => x.seq === seq);
    if (!c) throw new DomainError(`Kupon #${seq} yok.`);
    if (!["O", "A", "I"].includes(c.status))
      throw new DomainError(`Kupon #${seq} (${c.status}) IRROP'a uygun değil — O/A/I olmalı.`);
  }
  const fim = "FIM-" + crypto.randomUUID().slice(0, 6).toUpperCase();
  const flight = `${input.endorseTo}${input.newFlight.flightNumber.replace(/^\D+/, "")}`;
  input.couponSeqs.forEach((seq) => {
    const c = t.coupons.find((x) => x.seq === seq)!;
    if (c.status === "O" || c.status === "A") c.status = applyTransition(c.status, "I"); // önce IRROP
    c.status = applyTransition(c.status, "G"); // FIM ile reaccommodate (final)
    emitStatusUpdate(t, c.seq, "G"); // 1.1.4.3 — yönlendiren taşıyıcıya bildirim
  });
  t.endorsement = `INVOL ${input.reason.toUpperCase()} / RTG ${input.endorseTo} ${flight} / ${fim}`;
  t.history.push(
    event("IrregularOpsApplied", {
      couponSeq: input.couponSeqs[0],
      detail: `IRROP (${input.reason}) · ${input.endorseTo}'a ciro · yeni uçuş ${flight} · ${fim}`,
      status: "G",
    }),
  );
  opKeys.set(input.idempotencyKey, fim);
  return { ticket: t, fim };
}

// =====================================================================
// Ch 13 — No-show: yolcu uçuşa gelmedi. Kupon O kalır (fare rule'a göre rebook/refund'a
// uygun olabilir) ama operasyonel olarak işaretlenir. Sonraki adım: exchange (yeniden rez.) veya refund.
// =====================================================================
export interface NoShowInput {
  ticketNumber: string;
  couponSeqs: number[];
  idempotencyKey: string;
}
export async function markNoShow(input: NoShowInput): Promise<Ticket> {
  await delay(500);
  const t = store.find((x) => x.ticketNumber === input.ticketNumber);
  if (!t) throw new DomainError("Bilet bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) return t; // idempotent
  if (!input.couponSeqs.length) throw new DomainError("En az bir kupon seç.");
  for (const seq of input.couponSeqs) {
    const c = t.coupons.find((x) => x.seq === seq);
    if (!c) throw new DomainError(`Kupon #${seq} yok.`);
    if (c.status !== "O" && c.status !== "A")
      throw new DomainError(`Kupon #${seq} (${c.status}) no-show işaretine uygun değil — O/A olmalı.`);
  }
  input.couponSeqs.forEach((seq) => {
    const c = t.coupons.find((x) => x.seq === seq)!;
    c.noShow = true; // statü O kalır; rebook/refund fare rule'a tabi
  });
  const segs = input.couponSeqs
    .map((seq) => t.coupons.find((x) => x.seq === seq)!)
    .map((c) => `#${c.seq} ${c.segment.origin}→${c.segment.destination}`)
    .join(", ");
  t.history.push(event("NoShowRecorded", { couponSeq: input.couponSeqs[0], detail: `Yolcu uçuşa gelmedi: ${segs}`, status: "O" }));
  opKeys.set(input.idempotencyKey, t.ticketNumber);
  return t;
}

// =====================================================================
// Ch 1.3.1 / 12.3 — Revalidation (Reservations Change): kupon uçuş/saat güncellenir,
// rota/fiyat DEĞİŞMEZ, reissue yok. Kupon statüsü O kalır (exchange'den hafif işlem).
// =====================================================================
export interface RevalidateInput {
  ticketNumber: string;
  couponSeq: number;
  newFlightNumber: string; // örn. "TK1982"
  newDeparture: string; // ISO
  newArrival?: string; // ISO (ops.)
  idempotencyKey: string;
}
export async function revalidateCoupon(input: RevalidateInput): Promise<Ticket> {
  await delay(550);
  const t = store.find((x) => x.ticketNumber === input.ticketNumber);
  if (!t) throw new DomainError("Bilet bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) return t; // idempotent
  const c = t.coupons.find((x) => x.seq === input.couponSeq);
  if (!c) throw new DomainError(`Kupon #${input.couponSeq} yok.`);
  if (c.status !== "O" && c.status !== "A")
    throw new DomainError(`Kupon #${input.couponSeq} (${c.status}) revalidation'a uygun değil — O/A olmalı.`);
  // Revalidation bileti yeniden kesmez: geçerlilik sonu olduğu gibi kalır.
  const expiredMsg = changeBlockedByValidity(t, demoNow()) ?? beyondValidity(t, input.newDeparture, demoNow());
  if (expiredMsg) throw new DomainError(expiredMsg);
  const flight = input.newFlightNumber.trim().toUpperCase();
  const old = `${c.segment.flightNumber} ${c.segment.departure.slice(0, 16).replace("T", " ")}`;
  // Rota/fiyat değişmez — yalnızca uçuş no + tarih/saat güncellenir; statü O korunur.
  c.segment = { ...c.segment, flightNumber: flight, departure: input.newDeparture, arrival: input.newArrival ?? c.segment.arrival };
  t.history.push(
    event("CouponRevalidated", {
      couponSeq: input.couponSeq,
      detail: `Revalidation · ${c.segment.origin}→${c.segment.destination}: ${old} → ${flight} ${input.newDeparture.slice(0, 16).replace("T", " ")}`,
      status: "O",
    }),
  );
  opKeys.set(input.idempotencyKey, t.ticketNumber);
  return t;
}

// =====================================================================
// Ch 1.3.3 — Carrier Print to Paper: elektronik kupon kağıda bastırılır → statü P (Printed).
// Interline anlaşması yoksa / IRROP'ta başka carrier'a teslimde kullanılır.
// =====================================================================
export interface PrintToPaperInput {
  ticketNumber: string;
  couponSeqs: number[];
  reason?: string;
  idempotencyKey: string;
}
export async function printToPaper(input: PrintToPaperInput): Promise<Ticket> {
  await delay(600);
  const t = store.find((x) => x.ticketNumber === input.ticketNumber);
  if (!t) throw new DomainError("Bilet bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) return t; // idempotent
  if (!input.couponSeqs.length) throw new DomainError("En az bir kupon seç.");
  assertControl(t, "Kağıda basma"); // 1.3.3/1.3.4: basan taşıyıcı kuponun kontrolünde olmalı
  for (const seq of input.couponSeqs) {
    const c = t.coupons.find((x) => x.seq === seq);
    if (!c) throw new DomainError(`Kupon #${seq} yok.`);
    // Handbook 1.3.3: print işlemi için kupon "open for use" olmalı — YALNIZ O.
    if (c.status !== "O")
      throw new DomainError(`Kupon #${seq} (${c.status}) kağıda basıma uygun değil — O olmalı (1.3.3).`);
  }
  const printed: Coupon[] = [];
  input.couponSeqs.forEach((seq) => {
    const c = t.coupons.find((x) => x.seq === seq)!;
    c.status = applyTransition(c.status, "P"); // O → P (final)
    emitStatusUpdate(t, c.seq, "P");
    printed.push(c);
    // 1.1.5.3 "Print to Paper": kağıt belge ORİJİNAL ET NUMARASINI taşır.
    t.paperDocuments = [
      ...(t.paperDocuments ?? []),
      { couponSeq: seq, documentNumber: t.ticketNumber, kind: "print", at: new Date().toISOString() },
    ];
  });
  stampSac(printed); // SAC (1.3.6)
  const segs = input.couponSeqs.join(", ");
  t.history.push(event("CouponPrinted", { couponSeq: input.couponSeqs[0], detail: `Kağıda basıldı — ETKT ${t.ticketNumber} (kupon ${segs})${input.reason ? " · " + input.reason : ""}`, status: "P" }));
  opKeys.set(input.idempotencyKey, t.ticketNumber);
  return t;
}

/**
 * Print Exchange (Handbook 1.3.4).
 *
 * Kupon(lar) kağıda basılırken **kağıt stoğun numarası ET numarasından
 * FARKLIYSA** print exchange yapılır. İki ön koşul: basan taşıyıcı kuponun
 * kontrolünde olmalı ve kuponlar "open for use" olmalı. Kağıt belgeye ETKT
 * basılır; kuponlar X (Print Exchange) finaline geçer ve settlement doğar.
 */
export interface PrintExchangeInput {
  ticketNumber: string;
  couponSeqs: number[];
  /** Kağıt stoğun kendi belge numarası — ET numarasından farklı olmalıdır. */
  paperDocumentNumber: string;
  reason?: string;
  idempotencyKey: string;
}
export async function printExchange(input: PrintExchangeInput): Promise<Ticket> {
  await delay(650);
  const t = store.find((x) => x.ticketNumber === input.ticketNumber);
  if (!t) throw new DomainError("Bilet bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) return t;
  if (!input.couponSeqs.length) throw new DomainError("En az bir kupon seç.");
  const doc = input.paperDocumentNumber.trim();
  if (doc.length < 6) throw new DomainError("Kağıt belge numarası eksik.");
  if (doc === t.ticketNumber)
    throw new DomainError("Kağıt belge numarası ET numarasıyla AYNI — bu print exchange değil, print to paper'dır (1.3.3/1.3.4).");
  assertControl(t, "Print exchange");
  for (const seq of input.couponSeqs) {
    const c = t.coupons.find((x) => x.seq === seq);
    if (!c) throw new DomainError(`Kupon #${seq} yok.`);
    if (c.status !== "O")
      throw new DomainError(`Kupon #${seq} (${c.status}) print exchange'e uygun değil — "open for use" olmalı (1.3.4).`);
  }
  const affected: Coupon[] = [];
  input.couponSeqs.forEach((seq) => {
    const c = t.coupons.find((x) => x.seq === seq)!;
    c.status = applyTransition(c.status, "X"); // O → X (final)
    emitStatusUpdate(t, c.seq, "X");
    affected.push(c);
    t.paperDocuments = [
      ...(t.paperDocuments ?? []),
      { couponSeq: seq, documentNumber: doc, kind: "print_exchange", at: new Date().toISOString() },
    ];
    cascadeEmdA(t.ticketNumber, seq, "X");
  });
  const sac = stampSac(affected);
  t.history.push(event("CouponPrintExchanged", {
    couponSeq: input.couponSeqs[0],
    detail: `Print exchange — kağıt belge ${doc} (ETKT ${t.ticketNumber}) · kupon ${input.couponSeqs.join(", ")} · SAC ${sac}` +
      (input.reason ? ` · ${input.reason}` : ""),
    status: "X",
  }));
  opKeys.set(input.idempotencyKey, t.ticketNumber);
  return t;
}

// =====================================================================
// 2.19 / 12.2 — Endorsement / Restrictions (ciro notu, carrier değişimi)
// =====================================================================
export interface EndorseInput {
  ticketNumber: string;
  endorsement: string;
  endorseToCarrier?: string;
  idempotencyKey: string;
}
export async function endorseTicket(input: EndorseInput): Promise<Ticket> {
  await delay(500);
  const t = store.find((x) => x.ticketNumber === input.ticketNumber);
  if (!t) throw new DomainError("Bilet bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) return t;
  t.endorsement = input.endorsement + (input.endorseToCarrier ? ` / ${input.endorseToCarrier}` : "");
  t.history.push(
    event("EndorsementApplied", {
      detail: t.endorsement + (input.endorseToCarrier ? ` (${input.endorseToCarrier}'a ciro)` : ""),
    }),
  );
  opKeys.set(input.idempotencyKey, t.ticketNumber);
  return t;
}

// =====================================================================
// 13.10 — Hastalık nedeniyle geçerlilik uzatması
// =====================================================================
export interface ExtendValidityInput extends IllnessInput {
  ticketNumber: string;
  idempotencyKey: string;
}
export async function extendValidity(input: ExtendValidityInput): Promise<Ticket> {
  await delay(450);
  const t = store.find((x) => x.ticketNumber === input.ticketNumber);
  if (!t) throw new DomainError("Bilet bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) return t;
  // Hesap sunucuda yeniden yapılır — arayüzün önizlemesine güvenilmez.
  const r = illnessExtension(t, input, demoNow());
  if ("error" in r) throw new DomainError(r.error);
  const before = ticketValidity(t, demoNow()).until.slice(0, 10);
  t.validityExtension = {
    reason: "illness",
    certificateDate: input.certificateDate,
    fitToTravelDate: input.fitToTravelDate,
    fareKind: input.fareKind,
    until: r.until,
    grantedAt: new Date().toISOString(),
  };
  t.history.push(event("ValidityExtended", {
    detail: `Hastalık uzatması (13.10) · rapor ${input.certificateDate} · ${before} → ${r.until.slice(0, 10)}`,
  }));
  opKeys.set(input.idempotencyKey, t.ticketNumber);
  return t;
}

// =====================================================================
// Ad düzeltme — eşit reissue (Handbook Giriş 10, 2.3)
// =====================================================================
export interface NameCorrectionInput {
  ticketNumber: string;
  surname: string;
  givenName: string;
  title?: string;
  reason: NameCorrectionReason;
  legalDocRef?: string;
  idempotencyKey: string;
}
/**
 * Ad düzeltme — biletin açık kuponları EŞİT reissue ile yeni bilete taşınır
 * (ücret aynı, ek tahsilat yok), yeni bilet düzeltilmiş adı ve "NAME
 * CORRECTION" cirosunu taşır, PNR'daki ad da güncellenir. Devir (başka
 * yolcu) reddedilir. Kontrol, geçerlilik ve kupon kuralları exchange
 * komutunun kapılarından geçer.
 */
export async function correctName(input: NameCorrectionInput): Promise<{ oldTicket: Ticket; newTicket: Ticket }> {
  const t = store.find((x) => x.ticketNumber === input.ticketNumber);
  if (!t) throw new DomainError("Bilet bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) {
    const tn = opKeys.get(input.idempotencyKey)!;
    return { oldTicket: t, newTicket: store.find((x) => x.ticketNumber === tn)! };
  }
  const to = { surname: input.surname.trim().toUpperCase(), givenName: input.givenName.trim().toUpperCase(), title: input.title };
  const verdict = classifyNameChange(t.passenger, to, input.reason, input.legalDocRef);
  if (!verdict.allowed) throw new DomainError(verdict.message);
  const open = t.coupons.filter((c) => c.status === "O");
  if (!open.length) throw new DomainError("Ad düzeltme için açık (O) kupon yok — kullanılmış belgenin adı değiştirilemez.");

  const from = t.passenger;
  const note = `NAME CORRECTION · ${from.surname}/${from.givenName} → ${to.surname}/${to.givenName}`;
  const { oldTicket, newTicket } = await exchangeTicket({
    oldTicketNumber: t.ticketNumber,
    newSegments: open.map((c) => c.segment),
    adc: { amount: 0, currency: t.fare.total.currency },
    note,
    idempotencyKey: `${input.idempotencyKey}:reissue`,
  });
  newTicket.passenger = { ...from, ...to, title: to.title ?? from.title };
  newTicket.endorsement = t.endorsement ? `${t.endorsement} / NAME CORRECTION` : "NAME CORRECTION";
  const detail = `${from.surname}/${from.givenName}${from.title ? ` ${from.title}` : ""} → ${to.surname}/${to.givenName}${to.title ? ` ${to.title}` : ""} · ${verdict.message}`;
  newTicket.history.push(event("NameCorrected", { detail, linkedTicketNumber: t.ticketNumber }));
  oldTicket.history.push(event("NameCorrected", { detail, linkedTicketNumber: newTicket.ticketNumber }));
  if (t.pnr) renamePnrPassenger(t.pnr, from, newTicket.passenger);
  opKeys.set(input.idempotencyKey, newTicket.ticketNumber);
  return { oldTicket, newTicket };
}

// =====================================================================
// Kuyruklar — kayıtlardan türeyen iş listesi (okuma modeli)
// =====================================================================
export async function listQueueItems(): Promise<QueueItem[]> {
  await delay(240);
  const [pnrs, messages] = await Promise.all([listPnrs(), listMessages()]);
  return buildQueueItems({ tickets: store, pnrs, messages, alerts: scanRevenueAlerts(store) }, demoNow());
}

// =====================================================================
// Yolcu hakları — hak ediş kaydı (EU261 · SHY-YOLCU · UK261)
// =====================================================================
export interface RightsInput {
  ticketNumber: string;
  couponSeq: number;
  disruption: Omit<DisruptionInput, "origin" | "destination" | "operatingCarrier">;
  idempotencyKey: string;
}
/**
 * Hak edişi bilet kaydına yazar — ödeme DEĞİL, denetlenebilir karar izi.
 * Hesap sunucuda kuponun kendi rotası ve işleten taşıyıcısıyla yeniden
 * yapılır; arayüzün gönderdiği tutara güvenilmez.
 */
export async function recordRightsAssessment(input: RightsInput): Promise<{ ticket: Ticket; assessment: RightsAssessment }> {
  await delay(400);
  const t = store.find((x) => x.ticketNumber === input.ticketNumber);
  if (!t) throw new DomainError("Bilet bulunamadı.");
  const c = t.coupons.find((x) => x.seq === input.couponSeq);
  if (!c) throw new DomainError(`Kupon #${input.couponSeq} yok.`);
  const assessment = assessRights({
    ...input.disruption,
    origin: c.segment.origin,
    destination: c.segment.destination,
    operatingCarrier: c.segment.operatingCarrier ?? c.segment.marketingCarrier,
  });
  if (opKeys.has(input.idempotencyKey)) return { ticket: t, assessment };
  const pay = payableRegime(assessment);
  const kind = { cancellation: "iptal", delay: "rötar", denied_boarding: "biniş reddi" }[input.disruption.kind];
  t.history.push(event("RightsAssessed", {
    couponSeq: c.seq,
    detail: pay
      ? `Hak ediş · ${pay.regime === "SHY" ? "SHY-YOLCU" : pay.regime} ${pay.amount} ${pay.currency}${pay.reduced ? " (%50)" : ""} · ${kind} · ${assessment.distanceKm ?? "?"} km`
      : `Hak ediş yok · ${kind}${input.disruption.extraordinary ? " · olağanüstü hâl" : ""} · ${assessment.distanceKm ?? "?"} km`,
  }));
  opKeys.set(input.idempotencyKey, t.ticketNumber);
  return { ticket: t, assessment };
}

// =====================================================================
// Ch 9 — PTA (Prepaid Ticket Advice)
// =====================================================================
const ptaStore: Pta[] = [...MOCK_PTAS];
let ptaSerial = 5530;

export async function listPtas(): Promise<Pta[]> {
  await delay(200);
  return [...ptaStore].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export interface CreatePtaInput {
  sponsorName: string;
  sponsorLocation: string;
  beneficiaryName: string;
  pickupLocation: string;
  route: string;
  amount: Money;
  formOfPayment: Pta["formOfPayment"];
  idempotencyKey: string;
}
export async function createPta(input: CreatePtaInput): Promise<Pta> {
  await delay(600);
  const prev = opKeys.get(input.idempotencyKey);
  if (prev) return ptaStore.find((p) => p.ptaReference === prev)!;
  const pta: Pta = {
    ptaReference: "PTA" + ptaSerial++,
    sponsorName: input.sponsorName,
    sponsorLocation: input.sponsorLocation,
    beneficiaryName: input.beneficiaryName.toUpperCase(),
    pickupLocation: input.pickupLocation.toUpperCase(),
    route: input.route.toUpperCase(),
    amount: input.amount,
    formOfPayment: input.formOfPayment,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  ptaStore.unshift(pta);
  opKeys.set(input.idempotencyKey, pta.ptaReference);
  return pta;
}

export interface IssueAgainstPtaInput {
  ptaReference: string;
  idempotencyKey: string;
}
export async function issueAgainstPta(input: IssueAgainstPtaInput): Promise<{ pta: Pta; ticket: Ticket }> {
  const pta = ptaStore.find((p) => p.ptaReference === input.ptaReference);
  if (!pta) throw new DomainError("PTA bulunamadı.");
  if (pta.status !== "open") throw new DomainError(`PTA durumu '${pta.status}' — bilet kesilemez.`);

  const [origin, destination] = pta.route.split(/\s*→\s*/);
  const [surname, givenName] = pta.beneficiaryName.split("/");
  const dep = new Date(Date.now() + 7 * 86400000);
  const arr = new Date(dep.getTime() + 3 * 3600000);
  const ticket = await issueTicket({
    passenger: { surname: surname || pta.beneficiaryName, givenName: givenName || "" },
    validatingCarrier: "TK",
    segments: [
      {
        origin: origin || "IST",
        destination: destination || "IST",
        marketingCarrier: "TK",
        flightNumber: "TK1",
        rbd: "Y",
        departure: dep.toISOString(),
        arrival: arr.toISOString(),
        fareBasis: "YPTA",
        reservationStatus: "HK",
      },
    ],
    fare: { baseFare: pta.amount, totalTfc: { amount: 0, currency: pta.amount.currency }, total: pta.amount, tfcs: [] },
    formOfPayment: { type: "other", detail: `PTA ${pta.ptaReference}` },
    idempotencyKey: input.idempotencyKey + "-tkt",
  });
  pta.status = "used";
  pta.issuedTicketNumber = ticket.ticketNumber;
  ticket.history.push(
    event("PtaIssued", {
      detail: `Issued against ${pta.ptaReference} · sponsor ${pta.sponsorName} (${pta.sponsorLocation})`,
      status: "O",
    }),
  );
  return { pta, ticket };
}

/**
 * PTA teslim teyidi (9.2.2): "The receiving office is required to acknowledge
 * receipt of the PTA." Teyit edilmemiş PTA'ya karşı kesim engellenmez ama
 * ekranda uyarı olarak görünür.
 */
export async function acknowledgePta(input: { ptaReference: string; by?: string; idempotencyKey: string }): Promise<Pta> {
  await delay(350);
  const pta = ptaStore.find((p) => p.ptaReference === input.ptaReference);
  if (!pta) throw new DomainError("PTA bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) return pta;
  if (pta.acknowledgedAt) throw new DomainError("PTA zaten teslim alındı olarak işaretli.");
  pta.acknowledgedAt = new Date().toISOString();
  pta.acknowledgedBy = input.by ?? `${pta.pickupLocation} ofisi`;
  opKeys.set(input.idempotencyKey, pta.ptaReference);
  return pta;
}

/**
 * PTA iadesi (Handbook 9.3).
 *
 * Fazla tahsilat sonradan tespit edilirse ya da PTA değerinin yalnız bir kısmı
 * kullanılırsa, **biletleme havayolu MCO (veya MCO olarak düzenlenmiş MPD)**
 * keser; bileti acente kesmişse **Agents Refund Voucher** düzenlenir. Fark
 * **orijinal ödemenin para biriminde** iade edilir ve satan ofise refund
 * authority iletilir.
 */
export interface RefundPtaInput {
  ptaReference: string;
  /** Kullanılan değer (kısmi kullanımda). Boşsa hiç kullanılmamış sayılır. */
  usedValue?: number;
  /** İade edilecek fark. Verilmezse tutar − kullanılan değer. */
  amount?: number;
  documentType?: "MCO" | "AgentsRefundVoucher";
  reason?: string;
  idempotencyKey: string;
}
export async function refundPta(input: RefundPtaInput): Promise<Pta> {
  await delay(600);
  const pta = ptaStore.find((p) => p.ptaReference === input.ptaReference);
  if (!pta) throw new DomainError("PTA bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) return pta;
  if (pta.refund) throw new DomainError("Bu PTA için zaten iade belgesi düzenlenmiş.");
  if (pta.status === "refunded") throw new DomainError("PTA zaten iade edilmiş.");

  const used = Math.max(0, input.usedValue ?? 0);
  if (used > pta.amount.amount) throw new DomainError("Kullanılan değer PTA tutarını aşamaz.");
  const diff = input.amount != null ? input.amount : pta.amount.amount - used;
  if (diff <= 0) throw new DomainError("İade edilecek fark yok.");
  if (diff > pta.amount.amount - used)
    throw new DomainError(`İade farkı kalan değeri aşamaz (kalan ${pta.amount.amount - used} ${pta.amount.currency}).`);

  const documentType = input.documentType ?? "MCO";
  pta.refund = {
    documentType,
    documentNumber: (documentType === "MCO" ? "MCO" : "ARV") + buildTicketNumber("235", String(ptaSerial++)).slice(3),
    // 9.3: fark ORİJİNAL ÖDEME para biriminde iade edilir.
    amount: { amount: diff, currency: pta.amount.currency },
    usedValue: used > 0 ? { amount: used, currency: pta.amount.currency } : undefined,
    refundAuthorityTo: pta.sponsorLocation,
    at: new Date().toISOString(),
  };
  // Hiç kullanılmadıysa PTA tamamen iade edilmiştir; kısmi kullanımda "used" kalır.
  if (used === 0 && !pta.issuedTicketNumber) pta.status = "refunded";

  const t = pta.issuedTicketNumber ? store.find((x) => x.ticketNumber === pta.issuedTicketNumber) : undefined;
  t?.history.push(event("PtaRefunded", {
    detail: `${documentType} ${pta.refund.documentNumber} · ${diff.toLocaleString("en-US")} ${pta.amount.currency} · refund authority → ${pta.sponsorLocation}`,
  }));
  opKeys.set(input.idempotencyKey, pta.ptaReference);
  return pta;
}

// =====================================================================
// 14.7 — Revenue Protection (anomali bayrakları)
// =====================================================================
/**
 * Anomali taraması — CANLI.
 *
 * Uyarılar artık sabit bir listeden değil, store'daki gerçek biletlerden
 * türetilir; ekranda gördüğü bayrağa tıklayan personel gerçekten o durumdaki
 * bileti bulur. Üç kural doğrudan handbook invariant'larının ihlalidir:
 *   · sıra dışı kullanım (1.1.4.4) — önceki kupon "O" iken sonraki honor edilmiş
 *   · gecikmiş kontrol (1.1.4.1) — kontrol süresi dolmuş, kupon hâlâ dışarıda
 *   · mükerrer kesim — aynı FOID + aynı güzergâh ile ikinci canlı belge
 * Askıya alınan kupon (S) ayrıca "inceleme altında" olarak bayraklanır.
 */
export function scanRevenueAlerts(tickets: Ticket[] = store): RevenueAlert[] {
  const out: RevenueAlert[] = [];
  const USED: CouponStatus[] = ["C", "L", "F"];

  for (const t of tickets) {
    for (const c of t.coupons) {
      if (USED.includes(c.status) && t.coupons.some((x) => x.seq < c.seq && x.status === "O")) {
        out.push({
          id: `seq-${t.ticketNumber}-${c.seq}`, kind: "out_of_sequence", severity: "high",
          ticketNumber: t.ticketNumber,
          detail: `Kupon #${c.seq} (${c.segment.origin}→${c.segment.destination}) kendinden önceki açık kupondan önce honor edilmiş.`,
          detailEn: `Coupon #${c.seq} (${c.segment.origin}→${c.segment.destination}) was honoured before an earlier open coupon.`,
          detectedAt: t.history[t.history.length - 1]?.occurredAt ?? t.issuedAt,
        });
      }
      if (c.status === "S") {
        out.push({
          id: `susp-${t.ticketNumber}-${c.seq}`, kind: "status_mismatch", severity: "medium",
          ticketNumber: t.ticketNumber,
          detail: `Kupon #${c.seq} askıda (S) — inceleme kapanana kadar kullanılamaz.`,
          detailEn: `Coupon #${c.seq} is suspended (S) — not usable until the review is closed.`,
          detectedAt: [...t.history].reverse().find((h) => h.type === "CouponSuspended")?.occurredAt ?? t.issuedAt,
        });
      }
    }

    if (isControlOverdue(t) && t.coupons.some((c) => !isFinal(c.status))) {
      out.push({
        id: `ctl-${t.ticketNumber}`, kind: "control_overdue", severity: "medium",
        ticketNumber: t.ticketNumber,
        detail: `Kontrol ${t.control.holder}'da ve süresi ${formatDeadline(t.control.deadlineAt!)} doldu (1.1.4.1 lease aşımı).`,
        detailEn: `Control is held by ${t.control.holder} and the time limit expired on ${formatDeadline(t.control.deadlineAt!)} (1.1.4.1 lease overrun).`,
        detectedAt: t.control.deadlineAt!,
      });
    }
  }

  // Mükerrer kesim: aynı kimlik belgesi + aynı güzergâh ile ikinci canlı bilet.
  const byKey = new Map<string, Ticket[]>();
  for (const t of tickets) {
    if (!t.passenger.foid || t.coupons.every((c) => isFinal(c.status))) continue;
    const key = `${t.passenger.foid}|${t.coupons.map((c) => c.segment.origin + c.segment.destination).join(">")}`;
    byKey.set(key, [...(byKey.get(key) ?? []), t]);
  }
  for (const [, group] of byKey) {
    if (group.length < 2) continue;
    for (const t of group.slice(1)) {
      out.push({
        id: `dup-${t.ticketNumber}`, kind: "duplicate", severity: "high",
        ticketNumber: t.ticketNumber,
        detail: `Aynı FOID (${t.passenger.foid}) ve güzergâh ile ${group.length} canlı belge — olası mükerrer kesim.`,
        detailEn: `${group.length} live documents share the same FOID (${t.passenger.foid}) and routing — possible duplicate issue.`,
        detectedAt: t.issuedAt,
      });
    }
  }
  return out;
}

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export async function listRevenueAlerts(): Promise<RevenueAlert[]> {
  await delay(220);
  // Canlı tarama + tarihî örnek kayıtlar (demo verisinde geçmiş vakalar).
  const live = scanRevenueAlerts();
  const liveTickets = new Set(live.map((a) => a.ticketNumber + a.kind));
  const seeded = MOCK_REVENUE_ALERTS.filter((a) => !liveTickets.has(a.ticketNumber + a.kind));
  return [...live, ...seeded].sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
}

// Statü pill rengi için yardımcı (read-only kullanım)
export type { CouponStatus };
