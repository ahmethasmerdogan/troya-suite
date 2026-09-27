import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Lightbulb, X } from "lucide-react";
import { useT } from "@/i18n";
import { useTips, useTipVisible } from "@/store/tips";
import { cn } from "@/lib/utils";
import { TIPS, type TipId } from "./catalog";
import { placeCard } from "./place";

/**
 * Bağlamsal ipucu — bir özelliğin YANINDA duran nabızlı nokta.
 *
 * Tıklanınca küçük bir kart açılır: tek cümlelik fayda + "Anladım".
 * Okunan ipucu bir daha gösterilmez; "İpuçlarını kapat" hepsini susturur.
 * Nokta bir buton olduğu için başka bir butonun/bağlantının İÇİNE konmaz,
 * yanına konur.
 */
export function Tip({ id, className }: { id: TipId; className?: string }) {
  const t = useT();
  const visible = useTipVisible(id);
  const dismiss = useTips((s) => s.dismiss);
  const setEnabled = useTips((s) => s.setEnabled);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const beacon = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const def = TIPS[id];

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = beacon.current?.getBoundingClientRect();
      const c = card.current;
      if (!b || !c) return;
      const r = placeCard(
        { top: b.top, left: b.left - 10, width: b.width, height: b.height },
        { width: c.offsetWidth, height: c.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
        8,
      );
      setPos({ top: r.top, left: r.left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // Dışarı tıklama ve Esc kapatır; kart portalda olduğu için iki düğüm de sayılır.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const n = e.target as Node;
      if (!beacon.current?.contains(n) && !card.current?.contains(n)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); beacon.current?.focus(); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!visible && !open) return null;
  const title = t(def.title);

  return (
    <>
      <button
        ref={beacon}
        type="button"
        aria-label={t("tips.beacon", { title })}
        aria-expanded={open}
        title={t("tips.beacon", { title })}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        className={cn("tip-beacon", className)}
        data-print-hide
      >
        <span />
      </button>
      {open && createPortal(
        <div
          ref={card}
          role="dialog"
          aria-label={title}
          className="anim-pop fixed z-[70] w-[300px] rounded-lg border border-line bg-panel p-4"
          style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
        >
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-md bg-brand-wash text-brand">
              <Lightbulb size={15} strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="microlabel">{t("tips.label")}</div>
              <div className="mt-0.5 text-[13.5px] font-semibold leading-snug text-ink">{title}</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("common.close")}
              className="grid h-6 w-6 place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink">
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{t(def.body)}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button type="button" onClick={() => { setEnabled(false); setOpen(false); }}
              className="text-[12px] text-ink-3 underline-offset-2 hover:text-ink hover:underline">
              {t("tips.turnOff")}
            </button>
            <button type="button" onClick={() => { dismiss(id); setOpen(false); }}
              className="rounded-full bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[var(--brand-hover)]">
              {t("tips.gotIt")}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
