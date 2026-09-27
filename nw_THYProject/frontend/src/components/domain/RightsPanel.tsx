import { Check, Minus } from "lucide-react";
import { payableRegime, type RightsAssessment, type RegimeResult } from "@/domain/passengerRights";
import { convert } from "@/domain/fx";
import { Pill } from "@/components/ui/pill";
import { useT } from "@/i18n";
import { useUI } from "@/store/ui";
import { cn, locale } from "@/lib/utils";

const REGIME_LABEL: Record<RegimeResult["regime"], string> = {
  EU261: "EU261", SHY: "SHY-YOLCU", UK261: "UK261",
};

const money = (n: number, cur: string) =>
  `${n.toLocaleString(locale(), { maximumFractionDigits: 0 })} ${cur === "EUR" ? "€" : cur === "GBP" ? "£" : cur}`;

/**
 * Hak ediş dökümü — rejim başına kapsam/tutar/gerekçe, ödenecek tek tutar
 * ve bakım hakları. Tazminat akışı ve HUB rötar kartı aynı görünümü kullanır.
 */
export function RightsPanel({ a, compact, potential }: { a: RightsAssessment; compact?: boolean; potential?: boolean }) {
  const t = useT();
  const lang = useUI((s) => s.lang);
  const pay = payableRegime(a);
  const tryEq = pay ? convert(pay.amount, pay.currency, "TRY") : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
        <span className="microlabel">{t("rights.distance")}</span>
        <span className="num text-ink">{a.distanceKm != null ? t("rights.km", { n: a.distanceKm.toLocaleString(locale()) }) : "—"}</span>
        {a.regimes[0] && <Pill tone="gray">{t("rights.band", { n: a.regimes[0].band })}</Pill>}
        {a.domesticTr && <Pill tone="gray">{t("rights.domestic")}</Pill>}
      </div>

      <div className={cn("flex items-center justify-between gap-3 rounded-md border px-4 py-3",
        pay && !potential ? "border-[var(--t-green-d)] bg-[var(--t-green-w)]" : "border-line bg-raised")}>
        <div>
          <div className="microlabel">{potential ? t("rights.potential") : t("rights.payable")}</div>
          {pay ? (
            <div className="num text-[22px] font-semibold tracking-[-0.02em] text-ink">
              {money(pay.amount, pay.currency)} <span className="text-[13px] font-medium text-ink-2">· {REGIME_LABEL[pay.regime]}</span>
            </div>
          ) : (
            <div className="text-[15px] font-semibold text-ink-2">{t("rights.none")}</div>
          )}
          {pay?.regime === "SHY" && tryEq != null && (
            <div className="num mt-0.5 text-[11.5px] text-ink-3">{t("rights.tryEq", { v: Math.round(tryEq).toLocaleString(locale()) })}</div>
          )}
        </div>
        {pay?.reduced && <Pill tone="amber">{t("rights.reduced")}</Pill>}
      </div>
      {!compact && <p className="-mt-1 text-[11.5px] text-ink-3">{t("rights.payableHint")}</p>}

      <div className="flex flex-col gap-1.5">
        {a.regimes.map((r) => (
          <div key={r.regime} className="flex items-start gap-2.5 rounded-md border border-line px-3 py-2">
            <span className={cn("mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full",
              r.applies ? "bg-[var(--t-green-d)] text-white" : "bg-sunken text-ink-3")}>
              {r.applies ? <Check size={12} strokeWidth={3} /> : <Minus size={12} strokeWidth={3} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-ink">{REGIME_LABEL[r.regime]}</span>
                <span className="text-[11.5px] text-ink-3">{r.applies ? t("rights.applies") : t("rights.notApplies")}</span>
                {r.applies && <span className="num ml-auto text-[13px] font-medium text-ink">{money(r.amount, r.currency)}</span>}
              </div>
              {!compact && <p className="mt-0.5 text-[12px] leading-snug text-ink-2">{lang === "en" ? r.reasonEn : r.reason}</p>}
            </div>
          </div>
        ))}
      </div>

      {!compact && (
        <div>
          <div className="microlabel mb-1.5">{t("rights.care")}</div>
          <div className="flex flex-wrap gap-1.5">
            {a.care.meals && <Pill tone="blue">{t("rights.care.meals")}</Pill>}
            {a.care.hotel && <Pill tone="blue">{t("rights.care.hotel")}</Pill>}
            {a.care.refundOption && <Pill tone="blue">{t("rights.care.refund")}</Pill>}
            {!a.care.meals && !a.care.hotel && !a.care.refundOption && <span className="text-[12px] text-ink-3">{t("rights.care.none")}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
