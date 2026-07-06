import { Lock, Check } from "lucide-react";
import type { CouponStatus } from "@/domain/types";
import { STATUS_META } from "@/domain/couponStatus";
import { cn } from "@/lib/utils";

// StatusBadge — DESIGN_SYSTEM §8.2 pill + §9.1 mapping.
// Final statülere kilit ikonu; Flown (F) için ✓.
export function StatusBadge({
  status,
  showCode = false,
  className,
}: {
  status: CouponStatus;
  showCode?: boolean;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(`pill pill--${meta.variant}`, className)}
      title={`${status} — ${meta.label}`}
    >
      {status === "F" && <Check size={13} strokeWidth={2} className="-ml-0.5" />}
      {meta.final && status !== "F" && <Lock size={11} strokeWidth={1.75} className="-ml-0.5 opacity-70" />}
      {showCode && <span className="font-mono text-[11px] opacity-70">{status}</span>}
      {meta.short}
    </span>
  );
}
