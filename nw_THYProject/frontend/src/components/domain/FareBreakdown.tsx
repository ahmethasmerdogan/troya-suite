import type { FareCalculation, FormOfPayment } from "@/domain/types";
import { Inset, Line, Rule } from "@/components/ui/surface";
import { Money } from "./Money";

/**
 * Ücret dökümü — çıplak ücret, vergi/harç kalemleri, toplam.
 * Toplam her zaman `baseFare + ΣTFC`'ye eşittir; bu görsel değil,
 * domain invariant'ıdır ve burada gözle doğrulanabilir kılınır.
 */
export function FareBreakdown({ fare, fop }: { fare: FareCalculation; fop?: FormOfPayment }) {
  return (
    <div className="flex flex-col gap-3">
      <Line label="Çıplak Ücret (Base Fare)" value={<Money value={fare.baseFare} size="sm" />} />

      {fare.tfcs.length > 0 && (
        <Inset>
          <div className="microlabel mb-1">Tax / Fee / Charge</div>
          {fare.tfcs.map((x) => (
            <Line key={x.code} label={<span className="num">{x.code}</span>} value={<Money value={x.amount} size="sm" />} />
          ))}
          <Rule className="my-1" />
          <Line label="Toplam TFC" value={<Money value={fare.totalTfc} size="sm" />} />
        </Inset>
      )}

      <Rule />
      <div className="flex items-baseline justify-between gap-4">
        <span className="microlabel">Toplam</span>
        <Money value={fare.total} size="lg" />
      </div>

      {fare.equivFarePaid && (
        <Line label="Eşdeğer ödenen (Equiv. Fare Paid)" value={<Money value={fare.equivFarePaid} size="sm" />} />
      )}
      {fop && (
        <Line
          label="Ödeme şekli"
          value={<span className="num">{fopLabel(fop)}</span>}
        />
      )}
      {fare.fareCalcString && (
        <div>
          <div className="microlabel mb-1">Fare Calculation</div>
          <div className="num rounded-md bg-sunken px-2.5 py-2 text-[11.5px] leading-relaxed text-ink-2">
            {fare.fareCalcString}
          </div>
        </div>
      )}
    </div>
  );
}

function fopLabel(fop: FormOfPayment): string {
  const kind = { cash: "Nakit", credit: "Kredi Kartı", uatp: "UATP", other: "Diğer" }[fop.type];
  return fop.detail ? `${kind} · ${fop.detail}` : kind;
}
