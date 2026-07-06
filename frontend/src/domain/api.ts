// Mock API — backend hazır olunca TanStack Query çağrıları aynı kalır, sadece
// fetch implementasyonu gerçek REST'e (OpenAPI client) döner. İş kuralı YOK (CLAUDE.md §8).
import {
  MOCK_TICKETS, MOCK_EMDS, MOCK_MESSAGES, MOCK_AGREEMENTS, MOCK_ORDERS, MOCK_PTAS, MOCK_REVENUE_ALERTS, toSummary,
} from "./mockData";
import type {
  Ticket, TicketSummary, LifecycleEvent, Emd, InterlineMessage, BilateralAgreement, Order,
  Segment, Money, CouponStatus, Pta, RevenueAlert, Passenger,
} from "./types";
import { buildTicketNumber } from "./ticketNumber";
import { applyTransition, canTransition } from "./couponStatusMachine";
import { isFinal } from "./couponStatus";

// Prototip durumu: bellek içi store (kesilen biletler eklenir).
const store: Ticket[] = [...MOCK_TICKETS];
let serialCounter = 100200300;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
        t.coupons.some((c) => c.segment.origin === q || c.segment.destination === q),
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
  /** Çift-submit koruması — frontend üretir (CLAUDE.md §9). */
  idempotencyKey: string;
}

const issuedKeys = new Map<string, string>(); // idempotencyKey → ticketNumber

export async function issueTicket(input: IssueTicketInput): Promise<Ticket> {
  await delay(700); // para işlemi: optimistic UI yok, sunucu beklenir
  // Idempotency: aynı key → aynı sonuç, yeni yan etki yok.
  const existing = issuedKeys.get(input.idempotencyKey);
  if (existing) return store.find((t) => t.ticketNumber === existing)!;

  const ticketNumber = buildTicketNumber("235", String(serialCounter++));
  const now = new Date().toISOString();
  const history: LifecycleEvent[] = [
    { id: "h1", type: "TicketIssued", occurredAt: now, actor: `${input.validatingCarrier} / Web`, detail: "Bilet kesildi", status: "O" },
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
    coupons: input.segments.map((segment, i) => ({ seq: i + 1, status: "O" as const, segment })),
    fare: input.fare,
    history,
  };

  store.unshift(ticket);
  issuedKeys.set(input.idempotencyKey, ticketNumber);
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
  // İnvariant: void için TÜM kuponlar O olmalı.
  const notOpen = t.coupons.filter((c) => c.status !== "O");
  if (notOpen.length)
    throw new DomainError(`Void için tüm kuponlar 'O' olmalı. Engel: kupon ${notOpen.map((c) => `#${c.seq}(${c.status})`).join(", ")}.`);
  t.coupons.forEach((c) => {
    c.status = applyTransition(c.status, "V");
    assignSac(c); // SAC (1.3.6)
    cascadeEmdA(t.ticketNumber, c.seq, "V"); // EMD-A senkronu (5.3)
  });
  t.history.push(event("TicketVoided", { detail: input.reason || "Satış kaydı iptal edildi", status: "V" }));
  opKeys.set(input.idempotencyKey, t.ticketNumber);
  return t;
}


// =====================================================================
// Handbook uyum yardımcıları (gap analizi 2026-07-06)
// =====================================================================
/** SAC (1.3.6): kupon E/F/P/V/X finaline geçince üretilen 14 karakterlik
 *  Settlement Authorisation Code — ilk 4 karakter carrier accounting code (TK=235+kontrol). */
function assignSac(c: { sac?: string }): void {
  if (c.sac) return;
  const rand = crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 10);
  c.sac = `2350${rand}`;
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
  residual?: Money;
  /** Vefat/hastalık muafiyeti (Ch 13.9/13.10, 15.4) — iptal cezası muaf, validity uzatılabilir. */
  waiver?: "death" | "illness";
  /** Yalnız vergi (TFC) iadesi — iade edilemez fare'lerde kupon O→Y→R akışı (1.1.4.1/1.3.5). */
  taxOnly?: boolean;
  /** İade yöntemi: orijinal FOP (varsayılan) ya da voucher/travel-credit → EMD-S kesilir. */
  method?: "fop" | "voucher";
  idempotencyKey: string;
}
export async function refundTicket(input: RefundInput): Promise<Ticket> {
  await delay(700);
  const t = store.find((x) => x.ticketNumber === input.ticketNumber);
  if (!t) throw new DomainError("Bilet bulunamadı.");
  if (opKeys.has(input.idempotencyKey)) return t;
  for (const seq of input.couponSeqs) {
    const c = t.coupons.find((x) => x.seq === seq);
    if (!c) throw new DomainError(`Kupon #${seq} yok.`);
    // İade uygunluğu: O, A veya Y (Handbook 1.3.5).
    if (c.status !== "O" && c.status !== "A" && c.status !== "Y")
      throw new DomainError(`Kupon #${seq} iadeye uygun değil (${c.status}) — O/A/Y olmalı (1.3.5).`);
  }
  input.couponSeqs.forEach((seq) => {
    const c = t.coupons.find((x) => x.seq === seq)!;
    // Yalnız-TFC iadesi: kupon önce Y (Refund TFC) ile işaretlenir, sonra R (1.1.4.1).
    if (input.taxOnly && c.status === "O") c.status = applyTransition(c.status, "Y");
    c.status = applyTransition(c.status, "R");
    cascadeEmdA(t.ticketNumber, seq, "R"); // EMD-A senkronu (5.3)
  });
  const waiverLabel = input.waiver === "death" ? "vefat (ceza muaf)" : input.waiver === "illness" ? "hastalık (ceza muaf)" : null;
  if (input.taxOnly) {
    t.history.push(event("CouponRefunded", { couponSeq: input.couponSeqs[0], detail: "Yalnız vergi (TFC) iadesi işaretlendi — O→Y (Refund TFC)", status: "Y" }));
  }
  t.history.push(
    event("CouponRefunded", {
      couponSeq: input.couponSeqs[0],
      detail: (input.taxOnly ? "Yalnız TFC iadesi " : "İade ") + `${input.refundAmount.amount.toLocaleString("en-US")} ${input.refundAmount.currency}` +
        (input.residual ? ` · residual ${input.residual.amount.toLocaleString("en-US")} ${input.residual.currency} (EMD-S)` : "") +
        (waiverLabel ? ` · waiver: ${waiverLabel}` : "") +
        (input.method === "voucher" ? " · voucher (EMD-S travel credit)" : ""),
      status: "R",
    }),
  );
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
  opKeys.set(input.idempotencyKey, t.ticketNumber);
  return t;
}

export interface ExchangeInput {
  oldTicketNumber: string;
  newSegments: Segment[];
  adc: Money; // ek tahsilat (Additional Collection); negatif = residual
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
  const openCoupons = old.coupons.filter((c) => c.status === "O");
  if (!openCoupons.length) throw new DomainError("Değişim için 'O' statüde kupon yok.");

  const newTicketNumber = buildTicketNumber("235", String(serialCounter++));
  const now = new Date().toISOString();

  // Eski açık kuponlar → E (Exchanged)
  openCoupons.forEach((c) => {
    c.status = applyTransition(c.status, "E");
    assignSac(c); // SAC (1.3.6)
    cascadeEmdA(old.ticketNumber, c.seq, "E"); // EMD-A senkronu (5.3)
  });
  old.history.push(event("CouponExchanged", { couponSeq: openCoupons[0].seq, detail: "Yeni bilete dönüştürüldü", linkedTicketNumber: newTicketNumber, status: "E" }));

  // ADC (fare farkı) yeni biletin base fare'ına yansır → baseFare + totalTfc == total (tutarlı).
  const cur = old.fare.total.currency;
  const newBaseFare = old.fare.baseFare.amount + input.adc.amount;
  const baseTotal = newBaseFare + old.fare.totalTfc.amount;
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
      totalTfc: old.fare.totalTfc,
      total: { amount: baseTotal, currency: cur },
      tfcs: old.fare.tfcs,
      fareCalcString: old.fare.fareCalcString,
      nuc: old.fare.nuc,
      roe: old.fare.roe,
    },
    history: [
      event("TicketReissued", {
        detail: `Issued in exchange for ${old.ticketNumber} · ${input.adc.amount >= 0 ? "ADC" : "residual"} ${Math.abs(input.adc.amount).toLocaleString("en-US")} ${input.adc.currency}`,
        linkedTicketNumber: old.ticketNumber,
        status: "O",
      }),
      ...input.newSegments.map((s, i) =>
        event("CouponAdded", { couponSeq: i + 1, detail: `${s.origin}→${s.destination} ${s.marketingCarrier}${s.flightNumber.replace(/^\D+/, "")}`, status: "O" }),
      ),
    ],
  };
  store.unshift(newTicket);
  opKeys.set(input.idempotencyKey, newTicketNumber);
  return { oldTicket: old, newTicket };
}

// =====================================================================
// FE-5/6/7 getter'lar
// =====================================================================
const emdStore: Emd[] = [...MOCK_EMDS];
let emdSerial = 200300400;

export async function listEmdsForTicket(ticketNumber: string): Promise<Emd[]> {
  await delay(200);
  return emdStore.filter((e) => e.associatedTicket === ticketNumber);
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
  t.history.push(event("EmdIssued", { detail: `EMD-${input.type} ${input.rfisc} · ${input.description}`, status: "O" }));
  opKeys.set(input.idempotencyKey, emd.emdNumber);
  return emd;
}

export async function listMessages(): Promise<InterlineMessage[]> {
  await delay(220);
  return [...MOCK_MESSAGES].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

export async function listAgreements(): Promise<BilateralAgreement[]> {
  await delay(180);
  return [...MOCK_AGREEMENTS];
}

export async function listOrders(): Promise<Order[]> {
  await delay(240);
  return [...MOCK_ORDERS];
}

export async function getOrder(orderId: string): Promise<Order | undefined> {
  await delay(220);
  return MOCK_ORDERS.find((o) => o.orderId === orderId);
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
  c.status = applyTransition(c.status, to);
  if (to === "F") assignSac(c); // SAC (1.3.6): F finaline geçişte üretilir
  cascadeEmdA(ticketNumber, couponSeq, to); // EMD-A senkronu (5.2.2)
  t.history.push(event("CouponCheckedIn", { couponSeq, detail: `QuickCheck-in → ${to}`, status: to }));
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
  for (const seq of input.couponSeqs) {
    const c = t.coupons.find((x) => x.seq === seq);
    if (!c) throw new DomainError(`Kupon #${seq} yok.`);
    // Handbook 1.3.3: print işlemi için kupon "open for use" olmalı — YALNIZ O.
    if (c.status !== "O")
      throw new DomainError(`Kupon #${seq} (${c.status}) kağıda basıma uygun değil — O olmalı (1.3.3).`);
  }
  input.couponSeqs.forEach((seq) => {
    const c = t.coupons.find((x) => x.seq === seq)!;
    c.status = applyTransition(c.status, "P"); // O → P (final)
    assignSac(c); // SAC (1.3.6)
  });
  const segs = input.couponSeqs.join(", ");
  t.history.push(event("CouponPrinted", { couponSeq: input.couponSeqs[0], detail: `Kağıda basıldı (kupon ${segs})${input.reason ? " · " + input.reason : ""}`, status: "P" }));
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

// =====================================================================
// 14.7 — Revenue Protection (anomali bayrakları)
// =====================================================================
export async function listRevenueAlerts(): Promise<RevenueAlert[]> {
  await delay(220);
  return [...MOCK_REVENUE_ALERTS].sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
}

// Statü pill rengi için yardımcı (read-only kullanım)
export type { CouponStatus };
