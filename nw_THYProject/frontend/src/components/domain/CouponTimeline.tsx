import { Link } from "@tanstack/react-router";
import {
  AlertTriangle, ArrowLeftRight, ArrowUpRight, Ban, Banknote, CalendarClock, CheckCheck,
  FileOutput, FileText, PauseCircle, PlaneLanding, PlaneTakeoff, PlusCircle, RefreshCw,
  Stamp, TicketPlus, Undo2, UserX, type LucideIcon,
} from "lucide-react";
import type { LifecycleEvent } from "@/domain/types";
import { STATUS_TONE } from "./statusTone";
import { formatDateTime, cn } from "@/lib/utils";

/**
 * Kupon yaşam döngüsü — event sourcing'in görünen yüzü.
 *
 * En yeni üstte, geçmiş soluklaşır. Her olayın noktası, ima ettiği kupon
 * statüsünün ailesinden renk alır; böylece zaman çizgisi ile listedeki
 * rozetler aynı dili konuşur.
 */
const LABEL: Record<string, string> = {
  TicketIssued: "Bilet kesildi",
  CouponAdded: "Kupon eklendi",
  ControlGranted: "Kontrol devredildi",
  ControlReturned: "Kontrol iade edildi",
  CouponCheckedIn: "Check-in yapıldı",
  CouponLifted: "Uçağa alındı (lifted)",
  CouponFlown: "Uçuş tamamlandı",
  TicketVoided: "Bilet void edildi",
  CouponExchanged: "Kupon değiştirildi (exchange)",
  TicketReissued: "Yeniden kesim (reissue)",
  CouponRefunded: "İade edildi (refund)",
  CouponSuspended: "Askıya alındı",
  IrregularOpsApplied: "Olağandışı operasyon (IRROP / FIM)",
  EndorsementApplied: "Ciro / kısıtlama (endorsement)",
  PtaIssued: "PTA'ya karşı kesildi",
  EmdIssued: "EMD kesildi",
  NoShowRecorded: "No-show — yolcu gelmedi",
  CouponRevalidated: "Revalidation — uçuş güncellendi",
  CouponPrinted: "Kağıda basıldı (Printed)",
};

const ICON: Record<string, LucideIcon> = {
  TicketIssued: TicketPlus, CouponAdded: PlusCircle, ControlGranted: ArrowLeftRight, ControlReturned: Undo2,
  CouponCheckedIn: CheckCheck, CouponLifted: PlaneTakeoff, CouponFlown: PlaneLanding, TicketVoided: Ban,
  CouponExchanged: ArrowLeftRight, TicketReissued: RefreshCw, CouponRefunded: Undo2, CouponSuspended: PauseCircle,
  IrregularOpsApplied: AlertTriangle, EndorsementApplied: Stamp, PtaIssued: Banknote, EmdIssued: FileText,
  NoShowRecorded: UserX, CouponRevalidated: CalendarClock, CouponPrinted: FileOutput,
};

export function CouponTimeline({ events }: { events: LifecycleEvent[] }) {
  const sorted = [...events].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  return (
    <ol className="flex flex-col">
      {sorted.map((ev, i) => {
        const dot = ev.status ? STATUS_TONE[ev.status].hex : "var(--ink-3)";
        const Icon = ICON[ev.type] ?? PlusCircle;
        const latest = i === 0;
        return (
          <li key={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < sorted.length - 1 && <span aria-hidden className="absolute left-[13px] top-7 h-full w-px bg-line" />}
            <span
              aria-hidden
              className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-white ring-4 ring-[var(--panel)]"
              style={{ background: dot }}
            >
              <Icon size={13} strokeWidth={2.25} />
            </span>
            <div className={cn("min-w-0 pt-0.5", latest ? "opacity-100" : "opacity-70")}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[13.5px] font-medium text-ink">{LABEL[ev.type] ?? ev.type}</span>
                {ev.couponSeq != null && <span className="num text-[11px] text-ink-3">kupon #{ev.couponSeq}</span>}
              </div>
              {ev.detail && <div className="mt-0.5 text-[13px] leading-snug text-ink-2">{ev.detail}</div>}
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 text-[12px] text-ink-3">
                <span className="num">{formatDateTime(ev.occurredAt)}</span>
                <span>· {ev.actor}</span>
              </div>
              {ev.linkedTicketNumber && (
                <Link
                  to="/tickets/$ticketNumber"
                  params={{ ticketNumber: ev.linkedTicketNumber }}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-brand-wash px-2.5 py-1.5 text-[12px] font-medium text-brand transition-opacity hover:opacity-80"
                >
                  <ArrowUpRight size={13} strokeWidth={2} />
                  Bağlı bilet: <span className="num">{ev.linkedTicketNumber}</span>
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
