import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import type { LifecycleEvent, Ticket } from "@/domain/types";
import { STATUS_META } from "@/domain/couponStatus";
import { STATUS_TONE } from "@/components/domain/statusTone";
import { StatusPill } from "@/components/domain/StatusPill";
import { translate, useT, type Key } from "@/i18n";
import { formatDateTime, cn, locale } from "@/lib/utils";

/* ====================================================================
   Yaşam döngüsü — belgenin denetim kaydı.

   Önceki sürüm git commit grafiğiydi ve metafor tutmuyordu: "dal = kupon"
   deniyordu ama şerit yalnız 0|1 olduğu için TÜM kuponlar tek dala biniyordu,
   dal eğrisi tuvalin dışında başlayıp dışında bittiği için ilk ve son olayda
   kırpılıyor, üstelik olayın asıl kanıtı (tutar, SAC, bağlı belge) satıra hiç
   yazılmadan atılıyordu.

   Buradaki model daha dürüst: TEK ray, üstünde zamana göre olaylar. Kupon
   olayı içeri girintilenir ve hangi kupona ait olduğunu kendi çipinde söyler.
   Her satır iki katmanlıdır — üstte NE OLDU, altta KANIT.
   ==================================================================== */

const EVENT_KEY: Record<string, Key> = {
  TicketIssued: "ticket.event.TicketIssued", CouponAdded: "ticket.event.CouponAdded",
  ControlGranted: "ticket.event.ControlGranted", ControlReturned: "ticket.event.ControlReturned",
  CouponCheckedIn: "ticket.event.CouponCheckedIn", CouponLifted: "ticket.event.CouponLifted",
  CouponFlown: "ticket.event.CouponFlown", TicketVoided: "ticket.event.TicketVoided",
  CouponExchanged: "ticket.event.CouponExchanged", TicketReissued: "ticket.event.TicketReissued",
  CouponRefunded: "ticket.event.CouponRefunded", CouponSuspended: "ticket.event.CouponSuspended",
  IrregularOpsApplied: "ticket.event.IrregularOpsApplied", EndorsementApplied: "ticket.event.EndorsementApplied",
  PtaIssued: "ticket.event.PtaIssued", EmdIssued: "ticket.event.EmdIssued",
  NoShowRecorded: "ticket.event.NoShowRecorded", CouponRevalidated: "ticket.event.CouponRevalidated",
  CouponPrinted: "ticket.event.CouponPrinted", ControlRequested: "ticket.event.ControlRequested",
  CouponPrintExchanged: "ticket.event.CouponPrintExchanged", RefundCancelled: "ticket.event.RefundCancelled",
  EmdVoided: "ticket.event.EmdVoided", EmdRefunded: "ticket.event.EmdRefunded",
  PtaAcknowledged: "ticket.event.PtaAcknowledged", PtaRefunded: "ticket.event.PtaRefunded",
  ValidityExtended: "ticket.event.ValidityExtended", RightsAssessed: "ticket.event.RightsAssessed",
};

/** Olumsuz olaylar rayda kırmızı halka taşır — göz taramada önce bunları bulur. */
const NEGATIVE = new Set([
  "TicketVoided", "CouponRefunded", "NoShowRecorded", "CouponSuspended",
  "EmdVoided", "EmdRefunded", "RefundCancelled",
]);

/** Kesim patlaması: bilet kesildiğinde kupon sayısı kadar CouponAdded düşer. */
const BURST = new Set(["TicketIssued", "CouponAdded"]);

interface Row {
  id: string;
  /** Olay tipi — etiketi RENDER anında çevrilir, satır dil değişiminde tazelensin. */
  type: string;
  detail?: string;
  at: string;
  actor: string;
  couponSeq?: number;
  status?: LifecycleEvent["status"];
  money?: LifecycleEvent["money"];
  linked?: string;
  negative: boolean;
  /** Kesim patlaması tek satıra toplandığında kaç kupon açıldığı. */
  coupons?: number;
}

const INITIAL = 12;

export function LifecycleTimeline({ ticket, className }: { ticket: Ticket; className?: string }) {
  const [all, setAll] = useState(false);
  const t = useT();

  // Olay deposu yalnız EKLENİR (event sourcing) ve komutlar diziye yerinde
  // ekler: dizi referansı değişmediği için bağımlılık uzunluğu da içerir —
  // önceden işlem sonrası yeni olay çizelgede görünmüyordu (sayfa yenilenene dek).
  const rows = useMemo(() => build(ticket.history), [ticket.history, ticket.history.length]);
  const shown = all ? rows : rows.slice(0, INITIAL);

  return (
    <div className={className}>
      <ol className="flex flex-col">
        {shown.map((r, i) => (
          <TimelineRow key={r.id} row={r} first={i === 0} last={i === shown.length - 1} />
        ))}
      </ol>

      {rows.length > INITIAL && (
        <button
          onClick={() => setAll((a) => !a)}
          className="mt-2 flex items-center gap-1.5 rounded-[10px] px-2 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-inset hover:text-ink"
        >
          <ChevronDown size={14} strokeWidth={2} className={cn("transition-transform", all && "rotate-180")} />
          {all ? t("ticket.timeline.showLess") : t("ticket.timeline.more", { n: rows.length - INITIAL })}
        </button>
      )}
    </div>
  );
}

function TimelineRow({ row, first, last }: { row: Row; first: boolean; last: boolean }) {
  const t = useT();
  const tone = row.status ? STATUS_TONE[row.status] : null;
  const onCoupon = row.couponSeq != null;

  return (
    <li className="relative flex gap-3 py-2.5 pl-0">
      {/* Ray parçası satır başına çizilir: son satırda çizilmediği için
          çizgi tam olarak son düğümde biter, tuvalden taşamaz. */}
      {!last && (
        <span aria-hidden className="absolute left-[7px] top-[22px] bottom-0 w-px bg-line-strong" />
      )}
      {/* Düğüm — rengi statü ailesinden */}
      <span aria-hidden className="relative z-10 mt-[5px] flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center">
        <span
          className={cn(
            "rounded-full ring-2 ring-[var(--surface)]",
            onCoupon ? "h-[9px] w-[9px]" : "h-[13px] w-[13px]",
          )}
          style={{
            background: tone ? tone.dot : "var(--line-strong)",
            outline: row.negative ? "1.5px solid var(--t-red-d)" : undefined,
            outlineOffset: "2px",
          }}
        />
      </span>

      <div className={cn("min-w-0 flex-1", onCoupon && "pl-2")}>
        {/* Katman 1 — ne oldu */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("text-[13.5px]", first ? "font-semibold text-ink" : "font-medium text-ink")}>
            {eventLabel(row.type)}
          </span>
          {onCoupon && (
            <span className="num rounded-[5px] bg-inset px-1.5 py-px text-[11px] text-ink-2">
              {t("ticket.timeline.coupon", { n: row.couponSeq! })}
            </span>
          )}
          {row.coupons != null && row.coupons > 0 && (
            <span className="num rounded-[5px] bg-inset px-1.5 py-px text-[11px] text-ink-2">
              {t("ticket.timeline.coupons", { n: row.coupons })}
            </span>
          )}
          {row.status && <StatusPill status={row.status} />}
          {row.linked && (
            <Link
              to="/tickets/$ticketNumber" params={{ ticketNumber: row.linked }}
              className="num rounded-[5px] border border-line px-1.5 py-px text-[11px] font-medium text-ink-2 transition-colors hover:border-[var(--brand)] hover:text-brand"
            >
              → {row.linked}
            </Link>
          )}
        </div>

        {/* Katman 2 — kanıt: açıklama, tutar, zaman, aktör */}
        {row.detail && (
          <p className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{row.detail}</p>
        )}
        {row.money && <MoneyLine money={row.money} />}
        <div className="num mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] text-ink-3">
          <span>{formatDateTime(row.at)}</span>
          <span aria-hidden>·</span>
          <span>{row.actor}</span>
        </div>
      </div>
    </li>
  );
}

/** Parasal döküm — olayın `money` alanından; metinden ayrıştırma YOK. */
function MoneyLine({ money }: { money: NonNullable<LifecycleEvent["money"]> }) {
  const t = useT();
  const n = (v: number) => v.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const parts: string[] = [];
  if (money.gross != null) parts.push(t("ticket.timeline.gross", { v: n(money.gross), cur: money.currency }));
  if (money.penalty) parts.push(t("ticket.timeline.penalty", { v: n(money.penalty) }));
  if (money.noShowFee) parts.push(t("ticket.timeline.noShowFee", { v: n(money.noShowFee) }));
  if (money.serviceCharge) parts.push(t("ticket.timeline.serviceCharge", { v: n(money.serviceCharge) }));
  if (money.taxRefunded) parts.push(t("ticket.timeline.taxRefunded", { v: n(money.taxRefunded) }));
  if (money.taxForfeited) parts.push(t("ticket.timeline.taxForfeited", { v: n(money.taxForfeited) }));
  if (money.adc) parts.push(t("ticket.timeline.adc", { v: n(money.adc) }));
  if (money.residual) parts.push(t("ticket.timeline.residual", { v: n(money.residual) }));
  if (money.vat != null) parts.push(t("ticket.timeline.vat", { v: n(money.vat) }));
  if (!parts.length) return null;
  return (
    <p className="num mt-1 rounded-md bg-inset px-2 py-1 text-[11.5px] text-ink-2">{parts.join(" · ")}</p>
  );
}

/**
 * Olay listesini satırlara çevir.
 *
 * İki iş yapar: (1) sıralamayı DETERMİNİSTİK yapar — aynı damgayı taşıyan
 * olaylarda kayıt sırası bozulmasın diye ikincil anahtar kullanılır, yoksa
 * "Bilet kesildi" kendi kuponlarının arasında kalıyordu; (2) kesim patlamasını
 * tek satırda toplar — 4 kuponlu bilette 5 satır yerine 1 satır.
 */
function build(history: LifecycleEvent[]): Row[] {
  const idx = new Map(history.map((h, i) => [h.id, i]));
  const sorted = [...history].sort((a, b) => {
    const d = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
    return d !== 0 ? d : (idx.get(b.id) ?? 0) - (idx.get(a.id) ?? 0);
  });

  const out: Row[] = [];
  let pendingBurst: Row | null = null;

  for (const ev of sorted) {
    const base: Row = {
      id: ev.id,
      type: ev.type,
      detail: ev.detail,
      at: ev.occurredAt,
      actor: ev.actor,
      couponSeq: ev.couponSeq,
      status: ev.status,
      money: ev.money,
      linked: ev.linkedTicketNumber,
      negative: NEGATIVE.has(ev.type),
    };

    if (BURST.has(ev.type)) {
      if (ev.type === "CouponAdded") {
        // Kuponları biriktir; kesim satırı gelince oraya sayı olarak yazılır.
        if (pendingBurst) pendingBurst.coupons = (pendingBurst.coupons ?? 0) + 1;
        else pendingBurst = { ...base, type: "TicketIssued", couponSeq: undefined, detail: undefined, coupons: 1 };
        continue;
      }
      // TicketIssued: birikmiş kuponları bu satıra topla.
      out.push({ ...base, coupons: pendingBurst?.coupons });
      pendingBurst = null;
      continue;
    }

    if (pendingBurst) { out.push(pendingBurst); pendingBurst = null; }
    out.push(base);
  }
  if (pendingBurst) out.push(pendingBurst);
  return out;
}

/** Statü etiketini dışarıya da açıyoruz (aynı sözlük iki yerde yazılmasın). */
export const eventLabel = (type: string) => (EVENT_KEY[type] ? translate(EVENT_KEY[type]) : type);
export const statusLabel = (s: keyof typeof STATUS_META) => STATUS_META[s].label;
