import type { Money as MoneyT } from "@/domain/types";
import { splitAmount, cn } from "@/lib/utils";

// Big-number two-tone — DESIGN_SYSTEM §3 / §9.2. int koyu, dec+cur açık gri.
export function Money({
  value,
  size = "md",
  signed = false,
  tone = "default",
  className,
}: {
  value: MoneyT;
  size?: "sm" | "md" | "lg";
  signed?: boolean;
  /** "delta-out" = iade/negatif (danger), "delta-in" = ek tahsilat (primary). */
  tone?: "default" | "delta-out" | "delta-in";
  className?: string;
}) {
  const { int, dec, cur } = splitAmount(Math.abs(value.amount), value.currency);
  const sizes = { sm: "text-[14px]", md: "text-[18px]", lg: "text-[24px]" };
  const sign = signed ? (value.amount < 0 ? "−" : "+") : "";
  return (
    <span className={cn("amount inline-flex items-baseline gap-1", sizes[size], className)}>
      <span
        className="int"
        style={
          tone === "delta-out"
            ? { color: "var(--danger-text)" }
            : tone === "delta-in"
            ? { color: "var(--accent)" }
            : undefined
        }
      >
        {sign}
        {int}
      </span>
      <span className="dec">.{dec}</span>
      <span className="cur text-[0.7em]">{cur}</span>
    </span>
  );
}
