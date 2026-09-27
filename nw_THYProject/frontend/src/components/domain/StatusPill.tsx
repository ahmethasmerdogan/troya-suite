import { Check, Lock } from "lucide-react";
import type { CouponStatus } from "@/domain/types";
import { STATUS_META } from "@/domain/couponStatus";
import { Pill } from "@/components/ui/pill";
import { STATUS_TONE } from "./statusTone";

/**
 * Kupon statüsü rozeti. Renk aileyi, etiket kimliği anlatır; final
 * statüler ayrıca kilit ikonu taşır — renkten bağımsız ikinci sinyal.
 */
export function StatusPill({ status, code, className }: { status: CouponStatus; code?: boolean; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <Pill tone={STATUS_TONE[status].tone} title={`${status} — ${meta.label}`} className={className}
      icon={
        status === "F" ? <Check size={12} strokeWidth={2.5} className="-ml-0.5" />
          : meta.final ? <Lock size={10} strokeWidth={2} className="-ml-0.5 opacity-70" />
            : undefined
      }
    >
      {code && <span className="num text-[11px] opacity-70">{status}</span>}
      {meta.short}
    </Pill>
  );
}
