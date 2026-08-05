import { ttlState, type PnrStatus } from "@/domain/reservation";
import { Pill } from "@/components/ui/pill";
import { useT } from "@/i18n";
import { cn, locale } from "@/lib/utils";

/**
 * Ticketing Time Limit (SSR ADTK) — süresinde bilet kesilmeyen rezervasyon
 * önce uyarıya düşer, sonra iptal edilir. Yalnız 'active' PNR'da görünür.
 */
export function TtlBadge({ status, ttl, className }: { status: PnrStatus; ttl?: string; className?: string }) {
  const t = useT();
  const st = ttlState({ status, ttl });
  if (st.kind === "none") return <span className={cn("text-[12px] text-ink-3", className)}>—</span>;
  const when = new Date(st.ttl).toLocaleString(locale());
  if (st.kind === "expired") return <Pill tone="red" title={`TTL: ${when}`} className={className}>{t("chat.ttl.expired")}</Pill>;
  if (st.kind === "warning") return <Pill tone="amber" title={`TTL: ${when}`} className={className}>{t("chat.ttl.hours", { n: st.hoursLeft })}</Pill>;
  return <Pill tone="gray" title={`TTL: ${when}`} className={className}>{t("chat.ttl.days", { n: Math.max(1, Math.round(st.hoursLeft / 24)) })}</Pill>;
}
