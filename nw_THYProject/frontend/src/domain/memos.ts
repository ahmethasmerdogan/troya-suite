/**
 * ADM / ACM — acente borç ve alacak dekontları (IATA Resolution 850m, BSP).
 *
 * ADM (Agency Debit Memo): havayolu, acentenin kestiği bilette bir kural
 * ihlali ya da tutar hatası bulduğunda farkı acenteye BORÇ yazar — yanlış
 * ücret/kural, eksik vergi, fazla komisyon, rezervasyon suistimali
 * (churning, hayali ad, pasif segment), hatalı iade.
 * ACM (Agency Credit Memo): tersi — havayolu acenteye ALACAK yazar
 * (iade farkı, komisyon düzeltmesi, geri alınan ADM).
 *
 * Kurallar (850m'nin gişeye düşen özü):
 *   · Dekont yalnız ACENTE satışına kesilir; havayolunun kendi satışına yok.
 *   · ADM, son uçuş tarihinden (iade edilmişse iade tarihinden) en geç
 *     9 ay içinde kesilir.
 *   · ADM kesildikten sonra acentenin en az 15 günlük inceleme süresi
 *     vardır; bu sürede BSPlink üzerinden itiraz edebilir. Süre dolmadan ya
 *     da itiraz açıkken ADM faturaya (BSP billing) giremez.
 *   · İtiraz kabul edilirse ADM geri çekilir; reddedilirse faturalanabilir.
 *   · Aynı bilet için aynı gerekçeyle ikinci ADM (açık ya da faturalanmış) kesilmez.
 *
 * Tutar dökümü: ücret farkı + vergi farkı + komisyon farkı + işlem ücreti.
 * Tutarlar biletin para biriminde tutulur.
 */
import { getTicket } from "./api";
import { DEMO_NOW } from "./demoClock";
import { MOCK_TICKETS } from "./mockData";
import type { Money, Ticket } from "./types";

export type MemoType = "ADM" | "ACM";
export type MemoStatus = "issued" | "disputed" | "billed" | "withdrawn";

export type AdmReason = "FARE" | "TAX" | "COMM" | "ABUSE" | "REFUND" | "TTL" | "OTHER";
export type AcmReason = "REFUND_ADJ" | "COMM_ADJ" | "ADM_REVERSAL" | "OTHER";
export type MemoReason = AdmReason | AcmReason;

export const MEMO_REASONS: Record<MemoType, { code: MemoReason; tr: string; en: string }[]> = {
  ADM: [
    { code: "FARE", tr: "Yanlış ücret / ücret kuralı ihlali", en: "Incorrect fare / fare rule violation" },
    { code: "TAX", tr: "Eksik ya da hatalı vergi", en: "Missing or incorrect tax" },
    { code: "COMM", tr: "Fazla komisyon", en: "Excess commission" },
    { code: "ABUSE", tr: "Rezervasyon suistimali (churning, hayali ad, pasif segment)", en: "Booking abuse (churning, fictitious name, passive segment)" },
    { code: "REFUND", tr: "Hatalı iade tutarı", en: "Incorrect refund amount" },
    { code: "TTL", tr: "Kesim süresi (TTL) ihlali", en: "Ticketing time limit violation" },
    { code: "OTHER", tr: "Diğer", en: "Other" },
  ],
  ACM: [
    { code: "REFUND_ADJ", tr: "İade farkı (acente lehine)", en: "Refund adjustment (in agent's favour)" },
    { code: "COMM_ADJ", tr: "Komisyon düzeltmesi", en: "Commission correction" },
    { code: "ADM_REVERSAL", tr: "Faturalanmış ADM'nin geri alınması", en: "Reversal of a billed ADM" },
    { code: "OTHER", tr: "Diğer", en: "Other" },
  ],
};

export function memoReasonText(type: MemoType, code: MemoReason, lang: "tr" | "en" = "tr"): string {
  return MEMO_REASONS[type].find((r) => r.code === code)?.[lang] ?? code;
}

export interface MemoAmounts {
  fare: number;
  tax: number;
  commission: number;
  /** Havayolunun ADM işlem ücreti — yalnız ADM'de. */
  adminFee: number;
}

export interface MemoEvent {
  at: string;
  by: string;
  action: "issued" | "disputed" | "dispute_accepted" | "dispute_rejected" | "billed" | "withdrawn";
  text: string;
  textEn: string;
}

export interface Memo {
  id: string;
  number: string;
  type: MemoType;
  ticketNumber: string;
  passengerName: string;
  agent: { iata: string; name: string; city: string };
  reason: MemoReason;
  note?: string;
  amounts: MemoAmounts;
  total: Money;
  status: MemoStatus;
  issuedAt: string;
  /** Acentenin itiraz edebileceği son gün (ADM). */
  reviewUntil?: string;
  dispute?: { at: string; reason: string; resolution?: "accepted" | "rejected"; resolvedAt?: string; note?: string };
  /** Faturalandığı BSP dönemi — "2026-10 P2". */
  billingPeriod?: string;
  history: MemoEvent[];
}

export const REVIEW_DAYS = 15;
export const ISSUE_LIMIT_MONTHS = 9;

const DAY = 86_400_000;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MemoError extends Error {}

/**
 * BSP fatura dönemi — ayı dört döneme böler (1–7, 8–15, 16–23, 24–son).
 * Pek çok BSP'nin haftalık/dört dönemli takvimine denk düşer.
 */
export function billingPeriodOf(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const p = day <= 7 ? 1 : day <= 15 ? 2 : day <= 23 ? 3 : 4;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")} P${p}`;
}

function sum(a: MemoAmounts): number {
  return Math.round((a.fare + a.tax + a.commission + a.adminFee) * 100) / 100;
}

/**
 * Biletin son uçuş ya da iade tarihi — 9 aylık kesim sınırı buradan sayılır.
 * İkisinin SONRAKİSİ alınır ve geri alınmış iade sayılmaz: erken bir kuponun
 * iadesi, sonradan uçulan yolculuğun ADM süresini kısaltmamalı.
 */
export function memoAnchorDate(t: Ticket): string {
  const refunds = t.refunds
    ? t.refunds.filter((r) => !r.cancelledAt).map((r) => r.at)
    : t.history.filter((h) => h.type === "CouponRefunded").map((h) => h.occurredAt);
  const departures = t.coupons.map((c) => c.segment.departure);
  return [...refunds, ...departures].sort().at(-1) ?? t.issuedAt;
}

/** n ay sonrası; ay sonu hedef ayın son gününe sıkıştırılır (31 Mayıs + 9 ay = 28 Şubat). */
function addMonths(iso: string, n: number): number {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const day = Math.min(d.getUTCDate(), new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
  return Date.UTC(y, m, day, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
}

/* ===================================================================
   Kayıt — bellek içi; gerçek sistemde BSPlink/muhasebe servisine gider.
   =================================================================== */

const MEMOS: Memo[] = [];
let counter = 140;
const keys = new Map<string, string>(); // idempotencyKey → memo id

function ev(action: MemoEvent["action"], by: string, text: string, textEn: string, at = new Date().toISOString()): MemoEvent {
  return { at, by, action, text, textEn };
}

export interface RaiseMemoInput {
  type: MemoType;
  ticketNumber: string;
  reason: MemoReason;
  amounts: MemoAmounts;
  note?: string;
  by: string;
  idempotencyKey: string;
  /** Test ve tohum veri için — verilmezse şimdi. */
  at?: string;
}

/** Aynı anahtarla uçuştaki istek aynı sözü alır — çift tıklama iki dekont kesmez. */
const inflight = new Map<string, Promise<Memo>>();
export function raiseMemo(input: RaiseMemoInput): Promise<Memo> {
  const cur = inflight.get(input.idempotencyKey);
  if (cur) return cur;
  const p = raiseMemoRun(input).finally(() => inflight.delete(input.idempotencyKey));
  inflight.set(input.idempotencyKey, p);
  return p;
}
async function raiseMemoRun(input: RaiseMemoInput): Promise<Memo> {
  await delay(420);
  const prior = keys.get(input.idempotencyKey);
  if (prior) return MEMOS.find((m) => m.id === prior)!;
  const t = await getTicket(input.ticketNumber);
  if (!t) throw new MemoError("Bilet bulunamadı.");
  return raiseCore(t, input);
}

/** Kesimin kendisi — senkron; tohum veri de buradan geçer (aynı kurallar). */
function raiseCore(t: Ticket, input: RaiseMemoInput): Memo {
  const prior = keys.get(input.idempotencyKey);
  if (prior) return MEMOS.find((m) => m.id === prior)!;
  if (!t.agent) throw new MemoError("Bu bilet havayolunun kendi kanalından satılmış — ADM/ACM yalnız acente satışına kesilir.");
  if (!MEMO_REASONS[input.type].some((r) => r.code === input.reason)) throw new MemoError("Gerekçe bu dekont türüne ait değil.");
  if (input.reason === "OTHER" && !input.note?.trim()) throw new MemoError("\"Diğer\" gerekçesinde açıklama zorunlu.");
  const a = input.amounts;
  if ([a.fare, a.tax, a.commission, a.adminFee].some((x) => !Number.isFinite(x) || x < 0))
    throw new MemoError("Tutar kalemleri sıfır ya da pozitif olmalı.");
  if (input.type === "ACM" && a.adminFee > 0) throw new MemoError("ACM'de işlem ücreti olmaz — işlem ücreti yalnız ADM'de alınır.");
  const total = sum(a);
  if (total <= 0) throw new MemoError("Dekont tutarı sıfırdan büyük olmalı.");

  const now = input.at ?? new Date().toISOString();
  if (input.type === "ADM") {
    const limit = addMonths(memoAnchorDate(t), ISSUE_LIMIT_MONTHS);
    if (Date.parse(now) > limit)
      throw new MemoError(`ADM süresi geçti — son uçuş/iade tarihinden itibaren ${ISSUE_LIMIT_MONTHS} ay içinde kesilir (Res. 850m).`);
    const dup = MEMOS.find((m) => m.type === "ADM" && m.ticketNumber === t.ticketNumber && m.reason === input.reason && m.status !== "withdrawn");
    // Faturalanmış ADM de sayılır: aynı usulsüzlük iki kez tahsil edilmez.
    if (dup) throw new MemoError(`Bu bilet için aynı gerekçeyle bir ADM zaten var (${dup.number}) — mükerrer dekont kesilmez.`);
  }

  counter += 1;
  const number = `235-${input.type}-${String(counter).padStart(6, "0")}`;
  const memo: Memo = {
    id: number,
    number,
    type: input.type,
    ticketNumber: t.ticketNumber,
    passengerName: `${t.passenger.surname}/${t.passenger.givenName}`,
    agent: { ...t.agent },
    reason: input.reason,
    note: input.note?.trim() || undefined,
    amounts: { ...a, adminFee: input.type === "ADM" ? a.adminFee : 0 },
    total: { amount: total, currency: t.fare.total.currency },
    status: "issued",
    issuedAt: now,
    ...(input.type === "ADM" ? { reviewUntil: new Date(Date.parse(now) + REVIEW_DAYS * DAY).toISOString() } : {}),
    history: [ev("issued", input.by,
      `${input.type} kesildi · ${t.agent.name} (${t.agent.iata})`,
      `${input.type} issued · ${t.agent.name} (${t.agent.iata})`, now)],
  };
  MEMOS.unshift(memo);
  keys.set(input.idempotencyKey, memo.id);
  return memo;
}

function find(id: string): Memo {
  const m = MEMOS.find((x) => x.id === id);
  if (!m) throw new MemoError("Dekont bulunamadı.");
  return m;
}

/**
 * Acentenin itirazı — gerçekte BSPlink üzerinden gelir; demoda gişe kaydeder.
 * Yalnız ADM'ye ve inceleme süresi içinde yapılır.
 */
export async function disputeMemo(id: string, reason: string, nowMs = Date.now()): Promise<Memo> {
  await delay(300);
  return disputeCore(id, reason, nowMs);
}
function disputeCore(id: string, reason: string, nowMs: number): Memo {
  const m = find(id);
  if (m.type !== "ADM") throw new MemoError("ACM'ye itiraz edilmez — acente lehine bir kayıttır.");
  if (m.status !== "issued") throw new MemoError("Yalnız kesilmiş, faturalanmamış ADM'ye itiraz edilir.");
  if (m.dispute) throw new MemoError("Bu ADM'ye bir kez itiraz edildi.");
  if (m.reviewUntil && nowMs > Date.parse(m.reviewUntil)) throw new MemoError(`${REVIEW_DAYS} günlük inceleme süresi doldu — itiraz kabul edilmez.`);
  if (reason.trim().length < 5) throw new MemoError("İtiraz gerekçesi yazılmalı.");
  const at = new Date(nowMs).toISOString();
  m.status = "disputed";
  m.dispute = { at, reason: reason.trim() };
  m.history.push(ev("disputed", `${m.agent.name} (BSPlink)`, `Acente itiraz etti · ${reason.trim()}`, `Agent disputed · ${reason.trim()}`, at));
  return m;
}

/** Havayolu itirazı karara bağlar: kabul → ADM geri çekilir; ret → faturalanabilir. */
export async function resolveDispute(id: string, accept: boolean, by: string, note?: string): Promise<Memo> {
  await delay(300);
  const m = find(id);
  if (m.status !== "disputed" || !m.dispute) throw new MemoError("Karara bağlanacak açık itiraz yok.");
  const at = new Date().toISOString();
  m.dispute = { ...m.dispute, resolution: accept ? "accepted" : "rejected", resolvedAt: at, note: note?.trim() || undefined };
  if (accept) {
    m.status = "withdrawn";
    m.history.push(ev("dispute_accepted", by, "İtiraz kabul edildi — ADM geri çekildi", "Dispute accepted — ADM withdrawn", at));
  } else {
    m.status = "issued";
    m.history.push(ev("dispute_rejected", by, `İtiraz reddedildi${note ? ` · ${note.trim()}` : ""}`, `Dispute rejected${note ? ` · ${note.trim()}` : ""}`, at));
  }
  return m;
}

/** Bu dekont şimdi faturaya (BSP billing) alınabilir mi? Hayırsa nedeni. */
export function billingBlock(m: Memo, nowMs = Date.now()): string | null {
  if (m.status !== "issued") return m.status === "disputed" ? "İtiraz açık — karara bağlanmadan faturalanmaz." : "Bu dekont faturalanamaz.";
  if (m.type === "ADM" && !m.dispute?.resolution && m.reviewUntil && nowMs <= Date.parse(m.reviewUntil))
    return `Acentenin ${REVIEW_DAYS} günlük inceleme süresi ${m.reviewUntil.slice(0, 10)} tarihinde dolar — önce faturalanmaz.`;
  return null;
}

export async function billMemo(id: string, by: string, nowMs = Date.now()): Promise<Memo> {
  await delay(300);
  return billCore(id, by, nowMs);
}
function billCore(id: string, by: string, nowMs: number): Memo {
  const m = find(id);
  const block = billingBlock(m, nowMs);
  if (block) throw new MemoError(block);
  const at = new Date(nowMs).toISOString();
  m.status = "billed";
  m.billingPeriod = billingPeriodOf(at);
  m.history.push(ev("billed", by, `BSP faturasına alındı · ${m.billingPeriod}`, `Included in BSP billing · ${m.billingPeriod}`, at));
  return m;
}

/** Havayolu dekontu faturalanmadan geri çeker. */
export async function withdrawMemo(id: string, by: string, reason: string): Promise<Memo> {
  await delay(260);
  return withdrawCore(id, by, reason);
}
function withdrawCore(id: string, by: string, reason: string): Memo {
  const m = find(id);
  if (m.status === "billed") throw new MemoError("Faturalanmış dekont geri çekilmez — ters kayıt için ACM kesilir.");
  if (m.status === "withdrawn") throw new MemoError("Dekont zaten geri çekilmiş.");
  if (reason.trim().length < 3) throw new MemoError("Geri çekme gerekçesi yazılmalı.");
  const at = new Date().toISOString();
  // İtirazdaki ADM'yi geri çekmek itirazı kabul etmektir — itiraz açık kalmaz.
  if (m.dispute && !m.dispute.resolution) m.dispute = { ...m.dispute, resolution: "accepted", resolvedAt: at, note: reason.trim() };
  m.status = "withdrawn";
  m.history.push(ev("withdrawn", by, `Geri çekildi · ${reason.trim()}`, `Withdrawn · ${reason.trim()}`, at));
  return m;
}

export async function listMemos(): Promise<Memo[]> {
  ensureSeed();
  await delay(200);
  return MEMOS.map((m) => ({ ...m, history: [...m.history] }));
}

export async function memosForTicket(ticketNumber: string): Promise<Memo[]> {
  ensureSeed();
  await delay(120);
  return MEMOS.filter((m) => m.ticketNumber === ticketNumber);
}

/** Özet — açık borç (ADM), itirazda olan, faturalanan net. Para birimi bazında. */
export interface MemoTotals { currency: string; admOpen: number; admBilled: number; acmBilled: number; net: number }
export function memoTotals(list: Memo[]): MemoTotals[] {
  const by = new Map<string, MemoTotals>();
  for (const m of list) {
    const c = m.total.currency;
    const row = by.get(c) ?? { currency: c, admOpen: 0, admBilled: 0, acmBilled: 0, net: 0 };
    if (m.type === "ADM" && (m.status === "issued" || m.status === "disputed")) row.admOpen += m.total.amount;
    if (m.status === "billed") {
      if (m.type === "ADM") row.admBilled += m.total.amount;
      else row.acmBilled += m.total.amount;
    }
    row.net = row.admBilled - row.acmBilled;
    by.set(c, row);
  }
  return [...by.values()];
}

/* ===================================================================
   Tohum — demo panosu boş açılmasın. Tarihler demo saatine göre.
   =================================================================== */

let seeded = false;
function ensureSeed(): void {
  if (seeded) return;
  seeded = true;
  seedMemos(MOCK_TICKETS);
}

function seedMemos(tickets: Ticket[]): void {
  const agentTickets = tickets.filter((t) => t.agent);
  const at = (daysAgo: number) => new Date(DEMO_NOW - daysAgo * DAY).toISOString();
  const plan: { type: MemoType; reason: MemoReason; days: number; amounts: MemoAmounts; after?: "dispute" | "bill" | "withdraw" }[] = [
    { type: "ADM", reason: "FARE", days: 4, amounts: { fare: 1250, tax: 0, commission: 0, adminFee: 150 } },
    { type: "ADM", reason: "TAX", days: 9, amounts: { fare: 0, tax: 410, commission: 0, adminFee: 150 }, after: "dispute" },
    { type: "ADM", reason: "ABUSE", days: 22, amounts: { fare: 0, tax: 0, commission: 0, adminFee: 750 }, after: "bill" },
    { type: "ACM", reason: "REFUND_ADJ", days: 12, amounts: { fare: 640, tax: 120, commission: 0, adminFee: 0 }, after: "bill" },
    { type: "ADM", reason: "COMM", days: 30, amounts: { fare: 0, tax: 0, commission: 380, adminFee: 150 }, after: "withdraw" },
  ];
  // Her plan satırı, kurala uyan ilk acente biletine kesilir (9 ay sınırına takılan atlanır).
  let ti = 0;
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    let m: Memo | null = null;
    while (!m && ti < agentTickets.length) {
      const t = agentTickets[ti++];
      try {
        m = raiseCore(t, { type: p.type, ticketNumber: t.ticketNumber, reason: p.reason, amounts: p.amounts, by: "Gelir Muhasebesi", idempotencyKey: `seed-memo-${i}`, at: at(p.days) });
      } catch { /* bu bilet uygun değil — sıradakini dene */ }
    }
    if (!m) break;
    try {
      if (p.after === "dispute") disputeCore(m.id, "Ücret kuralı kesim anında geçerliydi; ekran görüntüsü ekte.", Date.parse(at(p.days - 3)));
      if (p.after === "bill") billCore(m.id, "Gelir Muhasebesi", Date.parse(at(Math.max(0, p.days - REVIEW_DAYS - 1))));
      if (p.after === "withdraw") withdrawCore(m.id, "Gelir Muhasebesi", "Komisyon anlaşması teyit edildi");
    } catch {
      /* tohum verisi kurala takılırsa (ör. 9 ay sınırı) o kayıt atlanır */
    }
  }
}
