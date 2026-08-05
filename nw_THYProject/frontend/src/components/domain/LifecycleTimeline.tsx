import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import type { LifecycleEvent, Ticket } from "@/domain/types";
import { STATUS_META } from "@/domain/couponStatus";
import { STATUS_TONE } from "@/components/domain/statusTone";
import { StatusPill } from "@/components/domain/StatusPill";
import { formatDateTime, cn } from "@/lib/utils";

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

const EVENT_LABEL: Record<string, string> = {
  TicketIssued: "Bilet kesildi", CouponAdded: "Kupon eklendi", ControlGranted: "Kontrol devredildi",
  ControlReturned: "Kontrol iade edildi", CouponCheckedIn: "Check-in yapıldı", CouponLifted: "Uçağa alındı",
  CouponFlown: "Uçuş tamamlandı", TicketVoided: "Bilet void edildi", CouponExchanged: "Kupon değiştirildi",
  TicketReissued: "Yeniden kesim", CouponRefunded: "İade edildi", CouponSuspended: "Askıya alındı",
  IrregularOpsApplied: "Olağandışı operasyon (IRROP)", EndorsementApplied: "Ciro / kısıtlama",
  PtaIssued: "PTA'ya karşı kesildi", EmdIssued: "EMD kesildi", NoShowRecorded: "No-show",
  CouponRevalidated: "Revalidation", CouponPrinted: "Kağıda basıldı",
  ControlRequested: "Kontrol talep edildi", CouponPrintExchanged: "Print exchange",
  RefundCancelled: "İade geri alındı", EmdVoided: "EMD void edildi", EmdRefunded: "EMD iade edildi",
  PtaAcknowledged: "PTA teslim alındı", PtaRefunded: "PTA iadesi",
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
  label: string;
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

  const rows = useMemo(() => build(ticket.history), [ticket.history]);
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
          {all ? "Daha azını göster" : `${rows.length - INITIAL} olay daha`}
        </button>
      )}
    </div>
  );
}

function TimelineRow({ row, first, last }: { row: Row; first: boolean; last: boolean }) {
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
            {row.label}
          </span>
          {onCoupon && (
            <span className="num rounded-[5px] bg-inset px-1.5 py-px text-[11px] text-ink-2">
              kupon #{row.couponSeq}
            </span>
          )}
          {row.coupons != null && row.coupons > 0 && (
            <span className="num rounded-[5px] bg-inset px-1.5 py-px text-[11px] text-ink-2">
              {row.coupons} kupon
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
  const n = (v?: number) => (v == null ? null : v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const parts: string[] = [];
  if (money.gross != null) parts.push(`Brüt ${n(money.gross)} ${money.currency}`);
  if (money.penalty) parts.push(`ceza ${n(money.penalty)}`);
  if (money.noShowFee) parts.push(`no-show ${n(money.noShowFee)}`);
  if (money.serviceCharge) parts.push(`service charge ${n(money.serviceCharge)}`);
  if (money.taxRefunded) parts.push(`iade edilen vergi ${n(money.taxRefunded)}`);
  if (money.taxForfeited) parts.push(`yanan vergi ${n(money.taxForfeited)}`);
  if (money.adc) parts.push(`ADC ${n(money.adc)}`);
  if (money.residual) parts.push(`bakiye ${n(money.residual)}`);
  if (money.vat != null) parts.push(`KDV ${n(money.vat)} (toplama dâhil)`);
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
      label: EVENT_LABEL[ev.type] ?? ev.type,
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
        else pendingBurst = { ...base, label: EVENT_LABEL.TicketIssued, couponSeq: undefined, detail: undefined, coupons: 1 };
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
export const eventLabel = (type: string) => EVENT_LABEL[type] ?? type;
export const statusLabel = (s: keyof typeof STATUS_META) => STATUS_META[s].label;
