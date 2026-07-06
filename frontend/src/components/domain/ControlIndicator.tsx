import { ShieldCheck, ArrowRightLeft, Clock } from "lucide-react";
import type { ControlAuthority } from "@/domain/types";
import { formatDateTime, cn } from "@/lib/utils";

// Control indicator — DESIGN_SYSTEM §9.4. "Şu an kimde kontrol var".
// Validating'deyse neutral; devredildiyse info + lease süresi; lease yaklaşıyorsa warning.
export function ControlIndicator({ control }: { control: ControlAuthority }) {
  if (control.isValidatingCarrier) {
    return (
      <span className="pill pill--neutral" title="Kontrol Validating Carrier'da">
        <ShieldCheck size={13} strokeWidth={1.75} className="-ml-0.5" />
        Kontrol: {control.holder}
      </span>
    );
  }

  const expiresSoon =
    control.leaseExpiresAt && new Date(control.leaseExpiresAt).getTime() - Date.now() < 24 * 3600 * 1000;

  return (
    <span
      className={cn("pill", expiresSoon ? "pill--warning" : "pill--info")}
      title="Kontrol başka carrier'a devredildi (interline)"
    >
      <ArrowRightLeft size={13} strokeWidth={1.75} className="-ml-0.5" />
      Kontrol → {control.holder}
      {control.leaseExpiresAt && (
        <span className="ml-1 inline-flex items-center gap-1 font-mono text-[11px] opacity-80">
          <Clock size={11} strokeWidth={1.75} />
          {formatDateTime(control.leaseExpiresAt)}
        </span>
      )}
    </span>
  );
}
