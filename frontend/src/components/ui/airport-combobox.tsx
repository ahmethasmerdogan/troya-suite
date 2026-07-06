import { useState, useRef, useEffect, useMemo } from "react";
import { MapPin, Plane } from "lucide-react";
import { searchAirports, airportByCode } from "@/domain/airports";
import { cn } from "@/lib/utils";

// Havalimanı autocomplete — value/onChange: IATA kodu (3 harf). Kod/şehir/ülke ile aranır.
export function AirportCombobox({
  value, onChange, placeholder = "Şehir / kod", invalid, autoFocus,
}: {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const selected = airportByCode(value);
  // Açık değilken kutuda seçili kodu göster; açıkken arama metnini.
  const display = open ? query : value ? `${value} · ${selected?.city ?? ""}`.trim() : "";
  const results = useMemo(() => searchAirports(open ? query : "", 8), [open, query]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  useEffect(() => { setHi(0); }, [query, open]);

  const pick = (code: string) => { onChange(code); setOpen(false); setQuery(""); };

  return (
    <div ref={ref} className="relative">
      <div
        className={cn(
          "flex h-9 items-center gap-2 rounded border bg-surface px-2.5 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20",
          invalid ? "border-[var(--danger-text)]" : "border-border-default",
        )}
      >
        <MapPin size={15} strokeWidth={1.75} className="flex-shrink-0 text-tertiary" />
        <input
          autoFocus={autoFocus}
          value={display}
          placeholder={placeholder}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onChange={(e) => { setOpen(true); setQuery(e.target.value); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            else if (e.key === "Enter" && open && results[hi]) { e.preventDefault(); pick(results[hi].code); }
            else if (e.key === "Escape") { setOpen(false); }
          }}
          className="h-full w-full bg-transparent text-sm text-primary outline-none placeholder:text-tertiary"
        />
        {value && !open && <span className="font-mono text-[11px] font-semibold text-tertiary">{value}</span>}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-11 z-50 max-h-72 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-surface p-1 shadow-md">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-[13px] text-tertiary">Sonuç yok</div>
          ) : (
            results.map((a, i) => (
              <button
                key={a.code}
                type="button"
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(a.code)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left transition-colors",
                  i === hi ? "bg-sunken" : "hover:bg-sunken",
                )}
              >
                <span className={cn("flex h-7 w-9 flex-shrink-0 items-center justify-center rounded font-mono text-[12px] font-bold", value === a.code ? "bg-accent text-white" : "bg-accent-soft text-accent")}>
                  {a.code}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-primary">{a.city}</span>
                  <span className="block truncate text-[11px] text-tertiary">{a.country}</span>
                </span>
                <Plane size={13} strokeWidth={1.75} className="flex-shrink-0 text-tertiary" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
