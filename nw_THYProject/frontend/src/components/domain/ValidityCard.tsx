import { CalendarRange, HeartPulse } from "lucide-react";
import { ticketValidity } from "@/domain/validity";
import { demoNow } from "@/domain/demoClock";
import type { Ticket } from "@/domain/types";
import { Pill } from "@/components/ui/pill";
import { Tip } from "@/components/tips/Tip";
import { useT } from "@/i18n";
import { formatDate } from "@/lib/utils";

/**
 * Bilet geçerliliği (Handbook 2.8 / 12.4.1 / 12.9.1 / 13.10).
 *
 * Personel "bu bilet ne zamana kadar kullanılabilir" sorusunu hesap yapmadan
 * görsün: sürenin neyden başladığı (kesim mi ilk uçuş mu), bitiş günü, kalan
 * gün, ücret kuralının kuponu daha erken sınırladığı yer ve süresi dolan
 * bilette yapılabilecek tek işlem (iade).
 */
export function ValidityCard({ ticket, onExtend, canExtend }: { ticket: Ticket; onExtend: () => void; canExtend: boolean }) {
  const t = useT();
  const v = ticketValidity(ticket, demoNow());
  const tone = v.state === "expired" ? "red" : v.state === "expiring" ? "amber" : "green";
  const label =
    v.state === "expired" ? t("ticket.validity.expired")
      : v.state === "expiring" ? t("ticket.validity.expiring", { n: v.daysLeft })
        : t("ticket.validity.valid", { n: v.daysLeft });
  const UNUSED = ["O", "A", "C", "S", "I"];
  const unusedSeqs = new Set(ticket.coupons.filter((c) => UNUSED.includes(c.status)).map((c) => c.seq));
  // Yalnız kullanılabilir kuponlar: uçulmuş kuponun NVA'sı artık bir şey söylemez.
  const limited = v.coupons.filter((c) => unusedSeqs.has(c.seq) && (c.fareLimited || c.expired || c.tooEarly));
  const unusedLeft = unusedSeqs.size > 0;

  return (
    <div data-tour="ticket.validity" className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center gap-1.5">
        <span className="microlabel">{t("ticket.validity.title")}</span>
        <Tip id="ticket.validity" />
        <Pill tone={tone} className="ml-auto">{label}</Pill>
      </div>
      <div className="flex items-baseline gap-2">
        <CalendarRange size={16} strokeWidth={1.75} className="self-center text-ink-3" />
        <span className="num text-[20px] font-semibold tracking-[-0.02em] text-ink">{formatDate(v.until)}</span>
        <span className="text-[12.5px] text-ink-3">{t("ticket.validity.untilSuffix")}</span>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-snug text-ink-2">
        {v.basis === "travel"
          ? t("ticket.validity.fromTravel", { d: formatDate(v.from) })
          : t("ticket.validity.fromIssue", { d: formatDate(v.from) })}
      </p>

      {v.extended && ticket.validityExtension && (
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-[var(--t-violet-i)]">
          <HeartPulse size={14} strokeWidth={1.75} />
          {t("ticket.validity.extended", { d: ticket.validityExtension.certificateDate })}
        </p>
      )}

      {limited.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 border-t border-line pt-3">
          {limited.map((c) => (
            <li key={c.seq} className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className="text-ink-2">{t("ticket.validity.coupon", { n: c.seq })}</span>
              <span className={c.expired ? "num font-medium text-[var(--t-red-i)]" : "num text-ink-2"}>
                {c.tooEarly && c.notBefore
                  ? t("ticket.validity.nvb", { d: formatDate(c.notBefore) })
                  : c.expired
                    ? t("ticket.validity.couponExpired", { d: formatDate(c.until) })
                    : t("ticket.validity.nva", { d: formatDate(c.until) })}
              </span>
            </li>
          ))}
        </ul>
      )}

      {v.refundOnly && (
        <p className="mt-3 rounded-md bg-[var(--t-red-w)] px-3 py-2 text-[12.5px] leading-snug text-[var(--t-red-i)]">
          {t("ticket.validity.refundOnly")}
        </p>
      )}

      {unusedLeft && !v.extended && v.basis === "travel" && (
        <button
          type="button"
          onClick={onExtend}
          disabled={!canExtend}
          className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:text-ink-4 disabled:no-underline"
        >
          <HeartPulse size={14} strokeWidth={1.75} /> {t("ticket.validity.extend")}
        </button>
      )}
    </div>
  );
}
