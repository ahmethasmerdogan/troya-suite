import { useRef } from "react";
import { X } from "lucide-react";
import { useDialog } from "@/lib/useDialog";
import { cn } from "@/lib/utils";

// Sağ drawer — DESIGN_ROADMAP §6 (değişiklik akışları). Esc kapatır.
export function Drawer({
  open, onClose, title, description, children, footer, width = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "md" | "lg";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialog(open, panelRef, onClose);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-[rgba(9,16,32,0.5)] backdrop-blur-[2px] animate-in" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "absolute right-0 top-0 flex h-full flex-col border-l border-[var(--border-subtle)] bg-surface shadow-xl outline-none",
          width === "lg" ? "w-full max-w-2xl" : "w-full max-w-md",
        )}
        style={{ animation: "drawerIn 280ms cubic-bezier(0.16,1,0.3,1)" }}
      >
        <div className="flex items-start justify-between border-b border-[var(--border-subtle)] px-6 py-4">
          <div>
            <h2 className="text-[18px] font-semibold text-primary">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-secondary">{description}</p>}
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded text-tertiary hover:bg-sunken hover:text-primary">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="border-t border-[var(--border-subtle)] px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
