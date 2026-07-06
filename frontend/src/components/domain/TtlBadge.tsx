import { ttlState, type PnrStatus } from "@/domain/reservation";
import { cn } from "@/lib/utils";

// Ticketing Time Limit rozeti — sektör standardı (SSR ADTK): süresinde bilet
// kesilmeyen rezervasyon uyarıya düşer, sonra iptal edilir. Yalnız 'active' PNR'da görünür.
export function TtlBadge({ status, ttl, className }: { status: PnrStatus; ttl?: string; className?: string }) {
  const st = ttlState({ status, ttl });
  if (st.kind === "none") return <span className={cn("text-[12px] text-tertiary", className)}>—</span>;
  if (st.kind === "expired") return <span className={cn("pill pill--danger", className)} title={`TTL: ${new Date(st.ttl).toLocaleString("tr-TR")}`}>TTL doldu</span>;
  if (st.kind === "warning") return <span className={cn("pill pill--warning", className)} title={`TTL: ${new Date(st.ttl).toLocaleString("tr-TR")}`}>TTL {st.hoursLeft} sa</span>;
  return <span className={cn("pill pill--neutral", className)} title={`TTL: ${new Date(st.ttl).toLocaleString("tr-TR")}`}>TTL {Math.max(1, Math.round(st.hoursLeft / 24))} gün</span>;
}
