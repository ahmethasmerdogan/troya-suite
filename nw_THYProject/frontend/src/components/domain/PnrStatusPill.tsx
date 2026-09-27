import type { Pnr } from "@/domain/reservation";
import { Pill, type Tone } from "@/components/ui/pill";
import { useT, type Key } from "@/i18n";

const TONE: Record<Pnr["status"], Tone> = { active: "blue", ticketed: "green", cancelled: "red" };
const LABEL: Record<Pnr["status"], Key> = {
  active: "chat.res.status.active", ticketed: "chat.res.status.ticketed", cancelled: "chat.res.status.cancelled",
};

/**
 * PNR durumu — ham kod ("ticketed") yerine gişenin dili. Çok yolculu
 * rezervasyonda kısmi kesim ayrıca söylenir: "Kısmen biletlendi · 1/2".
 */
export function PnrStatusPill({ status, done, total }: { status: Pnr["status"]; done: number; total: number }) {
  const t = useT();
  if (status === "active" && done > 0) {
    return <Pill tone="amber">{t("chat.res.status.partial", { n: done, m: total })}</Pill>;
  }
  return <Pill tone={TONE[status]}>{t(LABEL[status])}</Pill>;
}
