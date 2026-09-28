import { ArrowLeftRight, ShieldCheck } from "lucide-react";
import type { ControlAuthority } from "@/domain/types";
import { Pill } from "@/components/ui/pill";
import { formatDateTime } from "@/lib/utils";
import { useT } from "@/i18n";

/**
 * "Şu an kontrol kimde" — kupon control invariant'ının görünen yüzü.
 * Validating carrier'daysa sessiz gri; devredildiyse mavi ve lease süreli,
 * lease bitmek üzereyse amber.
 */
export function ControlIndicator({ control }: { control: ControlAuthority }) {
  const t = useT();
  if (control.isValidatingCarrier) {
    return (
      <Pill tone="gray" title={t("ticket.control.atVc")} icon={<ShieldCheck size={12} strokeWidth={2} className="-ml-0.5" />}>
        {t("ticket.control.holder", { holder: control.holder })}
      </Pill>
    );
  }
  const expires = control.leaseExpiresAt ? new Date(control.leaseExpiresAt).getTime() : 0;
  const hoursLeft = expires ? (expires - Date.now()) / 36e5 : Infinity;
  const soon = hoursLeft < 12;
  return (
    <Pill
      tone={soon ? "amber" : "blue"}
      title={control.leaseExpiresAt ? t("ticket.control.leaseEnd", { at: formatDateTime(control.leaseExpiresAt) }) : undefined}
      icon={<ArrowLeftRight size={12} strokeWidth={2} className="-ml-0.5" />}
    >
      {t("ticket.control.holder", { holder: control.holder })}
      {Number.isFinite(hoursLeft) && t("ticket.control.hoursLeft", { n: Math.max(0, Math.round(hoursLeft)) })}
    </Pill>
  );
}
