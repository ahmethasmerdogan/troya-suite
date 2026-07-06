import * as React from "react";
import { fxLines } from "@/domain/fx";
import { cn } from "@/lib/utils";

// Ondalık para girişi — Türkçe virgül (1.234,56) ve İngilizce nokta (1,234.56)
// gösterimini kabul eder; binlik ayraçları temizler. type="number" değil çünkü
// number input bazı locale'lerde virgülü reddeder (kullanıcı şikâyeti).
// Opsiyonel `fxCurrency` ile altına "≈ TRY / ≈ USD" çeviri satırı basar.

function normalizeDecimal(raw: string): string {
  let s = raw.replace(/[^\d.,-]/g, "");
  const neg = s.trimStart().startsWith("-");
  s = s.replace(/-/g, "");
  const sepIdx = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  if (sepIdx >= 0) {
    const intPart = s.slice(0, sepIdx).replace(/[.,]/g, "");
    const fracPart = s.slice(sepIdx + 1).replace(/[.,]/g, "");
    s = `${intPart}.${fracPart}`;
  }
  return (neg ? "-" : "") + s;
}

function parse(raw: string): number | undefined {
  const norm = normalizeDecimal(raw);
  if (norm === "" || norm === "-" || norm === ".") return undefined;
  const n = Number(norm);
  return Number.isFinite(n) ? n : undefined;
}

export interface DecimalInputProps {
  value: number | undefined | null;
  onChange: (n: number | undefined) => void;
  placeholder?: string;
  className?: string;
  allowNegative?: boolean;
  /** Verilirse altına bu para biriminden TRY/USD çeviri satırı basılır. */
  fxCurrency?: string;
  "aria-invalid"?: boolean;
  id?: string;
  name?: string;
  disabled?: boolean;
}

export function DecimalInput({
  value, onChange, placeholder, className, allowNegative, fxCurrency,
  "aria-invalid": invalid, id, name, disabled,
}: DecimalInputProps) {
  const [text, setText] = React.useState(() => (value == null ? "" : String(value)));
  const lastNum = React.useRef<number | undefined>(value ?? undefined);

  React.useEffect(() => {
    const v = value ?? undefined;
    if (v !== lastNum.current) {
      lastNum.current = v;
      setText(v == null ? "" : String(v));
    }
  }, [value]);

  const handle = (raw: string) => {
    const cleaned = allowNegative ? raw : raw.replace(/-/g, "");
    setText(cleaned);
    const parsed = parse(cleaned);
    lastNum.current = parsed;
    onChange(parsed);
  };

  const num = parse(text);
  const lines = fxCurrency && num != null ? fxLines(num, fxCurrency) : [];

  return (
    <div>
      <input
        id={id}
        name={name}
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        aria-invalid={invalid}
        value={text}
        placeholder={placeholder}
        onChange={(e) => handle(e.target.value)}
        className={cn(
          "h-9 w-full rounded border border-border-default bg-surface px-3 text-sm text-primary placeholder:text-tertiary",
          "transition-colors focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          invalid && "border-[var(--danger-text)] focus-visible:border-[var(--danger-text)] focus-visible:ring-[var(--danger-bg)]",
          className,
        )}
      />
      {lines.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-tertiary">
          {lines.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}
