import { ArrowLeftRight, ShieldCheck } from "lucide-react";
import type { ControlAuthority } from "@/domain/types";
import { Pill } from "@/components/ui/pill";
import { formatDateTime } from "@/lib/utils";

/**
 * "Şu an kontrol kimde" — kupon control invariant'ının görünen yüzü.
 * Validating carrier'daysa sessiz gri; devredildiyse mavi ve lease süreli,
 * lease bitmek üzereyse amber.
 */
export function ControlIndicator({ control }: { control: ControlAuthority }) {
  if (control.isValidatingCarrier) {
    return (
      <Pill tone="gray" title="Kontrol Validating Carrier'da" icon={<ShieldCheck size={12} strokeWidth={2} className="-ml-0.5" />}>
        Kontrol: {control.holder}
      </Pill>
    );
  }
  const expires = control.leaseExpiresAt ? new Date(control.leaseExpiresAt).getTime() : 0;
  const hoursLeft = expires ? (expires - Date.now()) / 36e5 : Infinity;
  const soon = hoursLeft < 12;
  return (
    <Pill
      tone={soon ? "amber" : "blue"}
      title={control.leaseExpiresAt ? `Lease bitiş: ${formatDateTime(control.leaseExpiresAt)}` : undefined}
      icon={<ArrowLeftRight size={12} strokeWidth={2} className="-ml-0.5" />}
    >
      Kontrol: {control.holder}
      {Number.isFinite(hoursLeft) && ` · ${Math.max(0, Math.round(hoursLeft))} sa`}
    </Pill>
  );
}
