import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialog } from "@/lib/useDialog";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { IconButton } from "./core";

/* ====================================================================
   Katmanlar — modal, drawer, menü.

   Zemin: mürekkep %45 + 3px bulanıklık. Panel: kıl çizgi + 14px köşe.
   Gölge yoktur; katman, bulanık zeminden ve çizgisinden ayrışır.
   ==================================================================== */

const SCRIM = "absolute inset-0 bg-[rgba(26,26,23,0.45)] backdrop-blur-[3px] dark:bg-black/60";

/** Onay ve kısa form için ortada duran katman. */
export function Modal({
  open,
  onClose,
  title,
  hint,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  hint?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg";
}) {
  const t = useT();
  const panel = useRef<HTMLDivElement>(null);
  useDialog(open, panel, onClose);
  if (!open) return null;

  const w = width === "sm" ? "max-w-sm" : width === "lg" ? "max-w-2xl" : "max-w-lg";
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={cn(SCRIM, "anim-fade")} onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        className={cn("anim-pop relative flex w-full flex-col rounded-lg border border-line bg-panel outline-none", w)}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
            {hint && <p className="mt-0.5 text-[13px] text-ink-2">{hint}</p>}
          </div>
          <IconButton label={t("shell.close")} size="sm" onClick={onClose}><X size={16} strokeWidth={1.75} /></IconButton>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Kayıt üzerinde çalışan akışlar için sağdan gelen katman. */
export function Drawer({
  open,
  onClose,
  title,
  hint,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  hint?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: "md" | "lg";
}) {
  const t = useT();
  const panel = useRef<HTMLDivElement>(null);
  useDialog(open, panel, onClose);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className={cn(SCRIM, "anim-fade")} onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        className={cn(
          "anim-slide-r absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-panel outline-none",
          width === "lg" ? "max-w-2xl" : "max-w-md",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
            {hint && <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{hint}</p>}
          </div>
          <IconButton label={t("shell.close")} size="sm" onClick={onClose}><X size={16} strokeWidth={1.75} /></IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Açılır menü kabı — tetikleyiciyi çağıran taraf yerleştirir. */
export function Menu({ children, align = "right", className }: { children: ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <div
      className={cn(
        "anim-pop absolute top-[calc(100%+6px)] z-40 min-w-52 rounded-lg border border-line bg-panel p-1",
        align === "right" ? "right-0" : "left-0",
        className,
      )}
      role="menu"
    >
      {children}
    </div>
  );
}

export function MenuItem({
  icon,
  hint,
  danger,
  disabled,
  onSelect,
  children,
}: {
  icon?: ReactNode;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      title={hint}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors",
        disabled ? "cursor-not-allowed text-ink-4" : danger
          ? "text-[var(--t-red-i)] hover:bg-[var(--t-red-w)]"
          : "text-ink hover:bg-sunken",
      )}
    >
      {icon && <span className="mt-px flex-shrink-0 text-ink-3 [&_svg]:size-4">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{children}</span>
        {hint && <span className="mt-0.5 block truncate text-[11.5px] text-ink-3">{hint}</span>}
      </span>
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="microlabel px-2.5 pb-0.5 pt-2">{children}</div>;
}

export function MenuRule() {
  return <div className="my-1 h-px bg-line" />;
}

/** Dışarı tıklayınca kapat. */
/**
 * Dışarı tıklama VE Escape ile kapanma. Menüler için tek kapı: klavye
 * kullanıcısı açtığı menüyü fareye uzanmadan kapatabilmeli.
 */
export function useOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void) {
  // Satır-içi ok fonksiyonu gelse de effect her render yeniden kurulmasın.
  const cb = useRef(onOutside);
  cb.current = onOutside;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cb.current();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref]);
}
