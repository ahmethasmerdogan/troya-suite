import type { InterlineMessage, RevenueAlert, Ticket } from "./types";
import type { PnrSummary } from "./reservation";
import { ttlState } from "./reservation";
import { ticketValidity } from "./validity";
import type { Permission } from "./auth";

/* ====================================================================
   Kuyruklar — gişenin iş listesi.

   Amadeus/Sabre gişelerinde personelin günü kuyrukla başlar: süresi dolan
   rezervasyonlar (Amadeus Q8), tarife değişiklikleri (Q7), partner
   mesajları… Burada kuyruk AYRI bir tablo değildir: kayıtların şu anki
   hâlinden TÜRETİLİR (CQRS okuma modeli). Kayıt düzelince — PNR biletlenir,
   kontrol geri gelir, kupon iade edilir — iş kuyruktan kendiliğinden düşer.
   Personelin "bitti / ertele" işaretleri ayrı bir çalışma durumudur
   (`store/queueWork`), kaydın kendisini değiştirmez.
   ==================================================================== */

export type QueueId = "ttl" | "irrop" | "validity" | "unused" | "control" | "revenue" | "interline";
export type QueuePriority = "high" | "medium" | "low";

export interface QueueDef {
  id: QueueId;
  /** Gişe numarası — Amadeus alışkanlığıyla (Q8 TTL, Q7 tarife değişikliği). */
  no: number;
  perm?: Permission;
}

export const QUEUES: QueueDef[] = [
  { id: "ttl", no: 8 },
  { id: "irrop", no: 7, perm: "ticket.irrop" },
  { id: "validity", no: 20 },
  { id: "unused", no: 21 },
  { id: "control", no: 30, perm: "ticket.exchange" },
  { id: "revenue", no: 40, perm: "revenue.view" },
  { id: "interline", no: 50, perm: "messages.view" },
];

export interface QueueItem {
  /** Kararlı kimlik: aynı koşul her taramada aynı işi üretir. */
  id: string;
  queue: QueueId;
  priority: QueuePriority;
  ref: string;
  refKind: "ticket" | "pnr" | "message";
  /** Kısa başlık (TR/EN) ve ne yapılacağı. */
  title: string;
  titleEn: string;
  detail: string;
  detailEn: string;
  /** Son tarih — sıralama ve "x saat kaldı" için. */
  dueAt?: string;
  createdAt: string;
}

export interface QueueSources {
  tickets: Ticket[];
  pnrs: PnrSummary[];
  messages: InterlineMessage[];
  alerts: RevenueAlert[];
}

const UNUSED = new Set(["O", "A"]);
const ALERT_LABEL: Record<RevenueAlert["kind"], [string, string]> = {
  out_of_sequence: ["sıra dışı kullanım", "out of sequence"],
  duplicate: ["olası mükerrer kesim", "possible duplicate"],
  status_mismatch: ["statü uyumsuzluğu", "status mismatch"],
  control_overdue: ["gecikmiş kontrol iadesi", "control overdue"],
};
const RANK: Record<QueuePriority, number> = { high: 0, medium: 1, low: 2 };
const DAY = 86_400_000;
const hours = (ms: number) => Math.max(0, Math.round(ms / 3_600_000));

export function buildQueueItems(src: QueueSources, now: number): QueueItem[] {
  const out: QueueItem[] = [];

  // Q8 — bilet kesim süresi (TTL / ADTK)
  for (const p of src.pnrs) {
    const st = ttlState({ status: p.status, ttl: p.ttl }, now);
    if (st.kind !== "warning" && st.kind !== "expired" && st.kind !== "ok") continue;
    if (st.kind === "ok" && Date.parse(st.ttl) - now > 2 * DAY) continue; // 48 saatten uzağı iş değil
    const expired = st.kind === "expired";
    const left = hours(Date.parse(st.ttl) - now);
    out.push({
      id: `ttl:${p.recordLocator}`, queue: "ttl", ref: p.recordLocator, refKind: "pnr",
      priority: expired || left <= 24 ? "high" : "medium",
      title: expired ? `${p.recordLocator} · TTL doldu` : `${p.recordLocator} · TTL ${left} sa`,
      titleEn: expired ? `${p.recordLocator} · TTL expired` : `${p.recordLocator} · TTL ${left} h`,
      detail: `${p.passengerName} · ${p.route}. ${expired ? "Süre doldu: yolcuyla görüşüp biletleyin ya da rezervasyonu iptal edin." : "Süresinde kesilmezse koltuk bırakılır."}`,
      detailEn: `${p.passengerName} · ${p.route}. ${expired ? "Expired: contact the passenger and ticket, or cancel the booking." : "If not ticketed in time the seat is released."}`,
      dueAt: st.ttl, createdAt: p.createdAt,
    });
  }

  for (const t of src.tickets) {
    const pax = `${t.passenger.surname}/${t.passenger.givenName}`;
    const route = t.coupons.map((c) => c.segment.origin).concat(t.coupons.at(-1)?.segment.destination ?? []).join("-");

    // Q7 — IRROP / tarife değişikliği takibi
    const irr = t.coupons.filter((c) => c.status === "I");
    if (irr.length) {
      out.push({
        id: `irrop:${t.ticketNumber}`, queue: "irrop", ref: t.ticketNumber, refKind: "ticket", priority: "high",
        title: `${t.ticketNumber} · IRROP kupon`, titleEn: `${t.ticketNumber} · IRROP coupon`,
        detail: `${pax} · ${route}. Kupon ${irr.map((c) => c.seq).join(", ")} düzensiz operasyonda — yeniden düzenleme (reissue) ya da FIM ile yolcuyu taşıyın; hak edişi kontrol edin.`,
        detailEn: `${pax} · ${route}. Coupon ${irr.map((c) => c.seq).join(", ")} in irregular operations — carry the passenger by reissue or FIM; check the entitlement.`,
        createdAt: t.issuedAt,
      });
    }

    // Q20 — geçerlilik (12.4 / 12.9.1)
    const v = ticketValidity(t, now);
    const hasUnused = t.coupons.some((c) => UNUSED.has(c.status));
    if (hasUnused && (v.state === "expiring" || v.state === "expired")) {
      out.push({
        id: `validity:${t.ticketNumber}`, queue: "validity", ref: t.ticketNumber, refKind: "ticket",
        priority: v.state === "expired" ? "medium" : v.daysLeft <= 7 ? "high" : "medium",
        title: v.state === "expired" ? `${t.ticketNumber} · geçerlilik doldu` : `${t.ticketNumber} · ${v.daysLeft} gün kaldı`,
        titleEn: v.state === "expired" ? `${t.ticketNumber} · validity expired` : `${t.ticketNumber} · ${v.daysLeft} days left`,
        detail: v.state === "expired"
          ? `${pax} · ${route}. Kullanılmamış kupon var; bilet artık yalnız iade edilebilir (12.9.1). Yolcuyu iadeye yönlendirin.`
          : `${pax} · ${route}. Kullanılmamış kupon süre dolmadan uçulmalı ya da değiştirilmeli; hastalık varsa uzatma (13.10).`,
        detailEn: v.state === "expired"
          ? `${pax} · ${route}. Unused coupons remain; the ticket can now only be refunded (12.9.1). Direct the passenger to a refund.`
          : `${pax} · ${route}. Unused coupons must be flown or changed before expiry; extend for illness if applicable (13.10).`,
        dueAt: v.until, createdAt: t.issuedAt,
      });
      continue; // aynı bilet "kullanılmamış kupon" kuyruğuna ayrıca düşmesin
    }

    // Q21 — kalkışı geçmiş kullanılmamış kupon (no-show ya da takip edilmemiş)
    const missed = t.coupons.filter((c) => c.status === "O" && Date.parse(c.segment.departure) < now);
    if (missed.length) {
      const ns = missed.some((c) => c.noShow);
      out.push({
        id: `unused:${t.ticketNumber}`, queue: "unused", ref: t.ticketNumber, refKind: "ticket", priority: ns ? "medium" : "low",
        title: `${t.ticketNumber} · uçulmamış kupon`, titleEn: `${t.ticketNumber} · unflown coupon`,
        detail: `${pax} · ${route}. Kupon ${missed.map((c) => c.seq).join(", ")} kalkışı geçti${ns ? " (no-show)" : ""} — yeniden rezervasyon (revalidation/exchange) ya da iade.`,
        detailEn: `${pax} · ${route}. Coupon ${missed.map((c) => c.seq).join(", ")} is past departure${ns ? " (no-show)" : ""} — rebook (revalidation/exchange) or refund.`,
        dueAt: v.until, createdAt: missed[0].segment.departure,
      });
    }

    // Q30 — kupon kontrolü başka taşıyıcıda (1.1.5)
    if (!t.control.isValidatingCarrier) {
      const overdue = !!t.control.deadlineAt && Date.parse(t.control.deadlineAt) < now;
      out.push({
        id: `control:${t.ticketNumber}`, queue: "control", ref: t.ticketNumber, refKind: "ticket", priority: overdue ? "high" : "low",
        title: `${t.ticketNumber} · kontrol ${t.control.holder}'da`, titleEn: `${t.ticketNumber} · control with ${t.control.holder}`,
        detail: overdue
          ? `${pax}. Kontrol süresi (1.1.4.1) doldu ama kupon ${t.control.holder}'dan geri gelmedi — iade isteyin.`
          : `${pax}. Değişiklik için önce kontrolü geri alın.`,
        detailEn: overdue
          ? `${pax}. The control deadline (1.1.4.1) has passed but the coupon is still with ${t.control.holder} — request it back.`
          : `${pax}. Take control back before any change.`,
        dueAt: t.control.deadlineAt, createdAt: t.issuedAt,
      });
    }
  }

  // Q40 — gelir koruma bulguları
  for (const a of src.alerts) {
    out.push({
      id: `revenue:${a.id}`, queue: "revenue", ref: a.ticketNumber, refKind: "ticket",
      priority: a.severity === "high" ? "high" : a.severity === "medium" ? "medium" : "low",
      title: `${a.ticketNumber} · ${ALERT_LABEL[a.kind]?.[0] ?? a.kind}`, titleEn: `${a.ticketNumber} · ${ALERT_LABEL[a.kind]?.[1] ?? a.kind}`,
      detail: a.detail, detailEn: a.detailEn ?? a.detail,
      createdAt: new Date(now).toISOString(),
    });
  }

  // Q50 — yanıt bekleyen ya da düşmüş interline mesajları
  for (const m of src.messages) {
    if (m.status !== "received" && m.status !== "failed") continue;
    out.push({
      id: `interline:${m.id}`, queue: "interline", ref: m.id, refKind: "message",
      priority: m.status === "failed" ? "high" : "medium",
      title: `${m.partnerCarrier} · ${m.messageType}${m.status === "failed" ? " · HATA" : ""}`,
      titleEn: `${m.partnerCarrier} · ${m.messageType}${m.status === "failed" ? " · FAILED" : ""}`,
      detail: `${m.summary}${m.ticketNumber ? ` · ${m.ticketNumber}` : ""}. ${m.status === "failed" ? "Mesaj iletilemedi — yeniden gönderin." : "Gelen mesaj işlenmeyi bekliyor."}`,
      detailEn: `${m.summary}${m.ticketNumber ? ` · ${m.ticketNumber}` : ""}. ${m.status === "failed" ? "Delivery failed — resend." : "Incoming message awaits processing."}`,
      createdAt: m.occurredAt,
    });
  }

  // Önce öncelik, sonra son tarih (yakın olan önde), sonra oluşturma.
  return out.sort((a, b) =>
    RANK[a.priority] - RANK[b.priority]
    || (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity)
    || Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
