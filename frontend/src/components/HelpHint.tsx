import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * Açıklama balonu — "kim nereyi nasıl doldurur". Form/ekran başlıklarının yanına konur.
 * Dark popover (DESIGN_SYSTEM §8.8). children = açıklama içeriği.
 */
export function HelpHint({ children, className }: { children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("help.title")}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full text-tertiary transition-colors hover:bg-sunken hover:text-secondary",
          open && "bg-sunken text-secondary",
        )}
      >
        <HelpCircle size={15} strokeWidth={1.75} />
      </button>
      {open && (
        <div className="absolute left-1/2 top-7 z-30 w-72 -translate-x-1/2 rounded-md bg-inverse p-3 text-[12px] leading-relaxed text-on-inverse shadow-md">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-on-inverse-2">{t("help.title")}</div>
          {children}
        </div>
      )}
    </div>
  );
}
