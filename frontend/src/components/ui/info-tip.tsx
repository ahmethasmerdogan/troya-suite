import { useState, useRef, useEffect } from "react";
import { Info } from "lucide-react";
import type { FieldHelp } from "@/domain/fieldHelp";
import { cn } from "@/lib/utils";

// Label yanına konan küçük (i) — hover/odakta örnekli açıklama (dark popover).
export function InfoTip({ help, className }: { help: FieldHelp; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <span ref={ref} className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Açıklama"
        className="flex h-4 w-4 items-center justify-center rounded-full text-tertiary transition-colors hover:text-accent"
      >
        <Info size={13} strokeWidth={1.75} />
      </button>
      {open && (
        <span className="absolute bottom-6 left-1/2 z-40 w-64 -translate-x-1/2 rounded-md bg-inverse p-3 text-left text-[12px] leading-relaxed text-on-inverse shadow-md">
          <span className="block">{help.desc}</span>
          {help.example && (
            <span className="mt-1.5 block">
              <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-on-inverse-2">Örnek</span>
              <span className="mt-0.5 block font-mono text-on-inverse">{help.example}</span>
            </span>
          )}
          {help.ref && <span className="mt-1.5 block text-[11px] text-on-inverse-2">Kaynak: Handbook {help.ref}</span>}
        </span>
      )}
    </span>
  );
}
