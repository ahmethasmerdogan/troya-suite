import type { FareCalculation } from "@/domain/types";
import { Money } from "./Money";

// Fare/TFC breakdown — DESIGN_SYSTEM §9.2 + DESIGN_ROADMAP §3.9.
// Tax code mono + tutar two-tone; TOT vurgulu.
export function FareBreakdown({ fare }: { fare: FareCalculation }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-secondary">Base Fare</span>
        <Money value={fare.baseFare} size="sm" />
      </div>

      <div className="flex flex-col gap-2 rounded border border-[var(--border-subtle)] bg-surface-alt p-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-secondary">
          Tax / Fee / Charge
        </div>
        {fare.tfcs.map((t) => (
          <div key={t.code} className="flex items-center justify-between">
            <span className="font-mono text-[13px] text-secondary">{t.code}</span>
            <Money value={t.amount} size="sm" />
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between border-t border-[var(--border-subtle)] pt-2">
          <span className="text-[13px] text-secondary">Toplam TFC</span>
          <Money value={fare.totalTfc} size="sm" />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-3">
        <span className="text-sm font-semibold text-primary">TOPLAM</span>
        <Money value={fare.total} size="lg" />
      </div>

      {/* Equivalent Fare Paid (2.11) — ödeme farklı para biriminde yapıldıysa */}
      {fare.equivFarePaid && (
        <div className="flex items-center justify-between rounded bg-sunken px-3 py-2 text-[12px]">
          <span className="text-secondary">Eşdeğer ödenen (Equiv. Fare Paid)</span>
          <Money value={fare.equivFarePaid} size="sm" />
        </div>
      )}

      {(fare.nuc || fare.fareCalcString) && (
        <div className="flex flex-col gap-1 rounded bg-sunken p-3">
          {fare.nuc != null && (
            <div className="flex gap-4 font-mono text-[12px] text-secondary">
              <span>NUC {fare.nuc.toFixed(2)}</span>
              {fare.roe != null && <span>ROE {fare.roe.toFixed(2)}</span>}
            </div>
          )}
          {fare.fareCalcString && (
            <div className="font-mono text-[11px] leading-relaxed text-tertiary">{fare.fareCalcString}</div>
          )}
        </div>
      )}
    </div>
  );
}
