import { useRef } from "react";
import { useDialog } from "@/lib/useDialog";
import { cn } from "@/lib/utils";

// Modal — DESIGN_SYSTEM §8.6: radius 16px, padding 32, shadow-md, backdrop rgba(10,11,13,0.4).
export function Modal({
  open, onClose, title, children, footer, className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialog(open, panelRef, onClose);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-[rgba(9,16,32,0.5)] backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn("relative w-full max-w-md rounded-lg border border-[var(--border-subtle)] bg-surface p-8 shadow-xl outline-none", className)}
        style={{ animation: "modalIn 200ms cubic-bezier(0.16,1,0.3,1)" }}
      >
        <h2 className="text-[18px] font-semibold text-primary">{title}</h2>
        <div className="mt-4">{children}</div>
        {footer && <div className="mt-6 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
