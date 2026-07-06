import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight, TicketPlus, PlusCircle, ArrowLeftRight, Undo2, CheckCheck, PlaneTakeoff, PlaneLanding,
  Ban, RefreshCw, PauseCircle, AlertTriangle, FileText, Stamp, Banknote, UserX, CalendarClock, FileOutput, type LucideIcon,
} from "lucide-react";
import type { LifecycleEvent } from "@/domain/types";
import { STATUS_META } from "@/domain/couponStatus";
import { formatDateTime, cn } from "@/lib/utils";

const EVENT_LABELS: Record<string, string> = {
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
const EVENT_ICON: Record<string, LucideIcon> = {
  TicketIssued: TicketPlus, CouponAdded: PlusCircle, ControlGranted: ArrowLeftRight, ControlReturned: Undo2,
  CouponCheckedIn: CheckCheck, CouponLifted: PlaneTakeoff, CouponFlown: PlaneLanding, TicketVoided: Ban,
  CouponExchanged: ArrowLeftRight, TicketReissued: RefreshCw, CouponRefunded: Undo2, CouponSuspended: PauseCircle,
  IrregularOpsApplied: AlertTriangle, EndorsementApplied: Stamp, PtaIssued: Banknote, EmdIssued: FileText,
  NoShowRecorded: UserX, CouponRevalidated: CalendarClock, CouponPrinted: FileOutput,
};

// Lifecycle timeline — DESIGN_SYSTEM §9.3 + DESIGN_ROADMAP §3.4.
// Dikey, status-renkli dot + connector; event+aktör+zaman(mono). Exchange linkage kartı.
// Event sourcing'in vitrini — geçmiş soluk, güncel opak.
export function CouponTimeline({ events }: { events: LifecycleEvent[] }) {
  const sorted = [...events].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  return (
    <ol className="flex flex-col">
      {sorted.map((ev, i) => {
        const variant = ev.status ? STATUS_META[ev.status].variant : "neutral";
        const dotColor: Record<string, string> = {
          success: "var(--success-dot)",
          info: "var(--info-dot)",
          warning: "var(--warning-dot)",
          danger: "var(--danger-dot)",
          neutral: "var(--text-tertiary)",
        };
        const isLatest = i === 0;
        const Icon = EVENT_ICON[ev.type] ?? PlusCircle;
        return (
          <li key={ev.id} className="relative flex gap-3 pb-5 last:pb-0">
            {/* connector */}
            {i < sorted.length - 1 && (
              <span className="absolute left-[13px] top-7 h-full w-px bg-[var(--border-subtle)]" aria-hidden />
            )}
            {/* ikonlu dot */}
            <span
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white ring-4 ring-surface"
              style={{ background: dotColor[variant] }}
              aria-hidden
            >
              <Icon size={14} strokeWidth={2} />
            </span>
            <div className={cn("pt-0.5", isLatest ? "opacity-100" : "opacity-75")}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium text-primary">{EVENT_LABELS[ev.type] ?? ev.type}</span>
                {ev.couponSeq != null && (
                  <span className="font-mono text-[11px] text-tertiary">kupon #{ev.couponSeq}</span>
                )}
              </div>
              {ev.detail && <div className="mt-0.5 text-[13px] text-secondary">{ev.detail}</div>}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-tertiary">
                <span className="font-mono">{formatDateTime(ev.occurredAt)}</span>
                <span>· {ev.actor}</span>
              </div>
              {/* Exchange linkage kartı — accent-soft */}
              {ev.linkedTicketNumber && (
                <Link
                  to="/tickets/$ticketNumber"
                  params={{ ticketNumber: ev.linkedTicketNumber }}
                  className="mt-2 inline-flex items-center gap-1.5 rounded border border-[var(--accent-soft)] bg-[var(--accent-soft)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--accent)] transition-colors hover:border-accent"
                >
                  <ArrowUpRight size={13} strokeWidth={1.75} />
                  Bağlı bilet: <span className="font-mono">{ev.linkedTicketNumber}</span>
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
