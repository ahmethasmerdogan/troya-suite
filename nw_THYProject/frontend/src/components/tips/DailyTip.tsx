import { useState } from "react";
import { ArrowRight, Lightbulb, X } from "lucide-react";
import { useT } from "@/i18n";
import { useTips } from "@/store/tips";
import { DAILY_TIPS } from "./catalog";

/**
 * "Biliyor muydunuz?" — Panel'de tek satırlık verimlilik notu.
 *
 * Güne göre döner (her gün başka bir not), "Sonraki ipucu" ile elle de
 * ilerler. Gizlenince bir daha çıkmaz; profil sayfasından geri açılır.
 */
export function DailyTip() {
  const t = useT();
  const hidden = useTips((s) => s.dailyHidden);
  const setHidden = useTips((s) => s.setDailyHidden);
  const day = Math.floor(Date.now() / 86_400_000);
  const [k, setK] = useState(day % DAILY_TIPS.length);
  if (hidden) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-line bg-panel px-4 py-3">
      <span className="mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-md bg-brand-wash text-brand">
        <Lightbulb size={16} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="microlabel">{t("tips.daily.title")}</div>
        <p key={k} className="anim-fade mt-0.5 text-[13.5px] leading-relaxed text-ink">{t(DAILY_TIPS[k])}</p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        <button type="button" onClick={() => setK((k + 1) % DAILY_TIPS.length)}
          className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12.5px] font-medium text-brand hover:bg-brand-wash">
          {t("tips.daily.next")} <ArrowRight size={13} strokeWidth={2} />
        </button>
        <button type="button" onClick={() => setHidden(true)} aria-label={t("tips.daily.hide")} title={t("tips.daily.hide")}
          className="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink">
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
