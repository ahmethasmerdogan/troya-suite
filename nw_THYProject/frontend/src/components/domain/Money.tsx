import type { Money as MoneyT } from "@/domain/types";
import { splitAmount, cn } from "@/lib/utils";

/**
 * Tutar — iki tonlu. Tam kısım koyu ve kalın, kuruş ile para birimi açık:
 * göz büyüklüğü okur, ayrıntıyı gerektiğinde alır. Her zaman mono + tabular,
 * böylece alt alta tutarlar hizalanır.
 */
export function Money({
  value,
  size = "md",
  signed,
  tone,
  className,
}: {
  value: MoneyT;
  size?: "sm" | "md" | "lg";
  signed?: boolean;
  /** out = iade/negatif · in = ek tahsilat */
  tone?: "out" | "in";
  className?: string;
}) {
  const { int, dec, cur } = splitAmount(Math.abs(value.amount), value.currency);
  const px = { sm: "text-[13px]", md: "text-[17px]", lg: "text-[24px]" }[size];
  const sign = signed ? (value.amount < 0 ? "−" : "+") : "";
  const color = tone === "out" ? "var(--t-red-i)" : tone === "in" ? "var(--brand)" : undefined;
  return (
    <span className={cn("amount inline-flex items-baseline gap-0.5", px, className)}>
      <span className="whole" style={color ? { color } : undefined}>{sign}{int}</span>
      <span className="frac">.{dec}</span>
      <span className="cur ml-0.5 text-[0.72em]">{cur}</span>
    </span>
  );
}
