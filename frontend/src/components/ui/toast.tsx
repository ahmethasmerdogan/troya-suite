import { useEffect } from "react";
import { create } from "zustand";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

// Toast — DESIGN_SYSTEM §8.7: alttan gelir, dark, sol 3px renk şeridi, auto-dismiss.
type ToastTone = "success" | "warning" | "danger" | "info";
interface ToastItem { id: number; tone: ToastTone; title: string; description?: string; }

interface ToastState {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: number) => void;
}

let counter = 0;
export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = ++counter;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (title: string, description?: string) => useToast.getState().push({ tone: "success", title, description }),
  warning: (title: string, description?: string) => useToast.getState().push({ tone: "warning", title, description }),
  danger: (title: string, description?: string) => useToast.getState().push({ tone: "danger", title, description }),
  info: (title: string, description?: string) => useToast.getState().push({ tone: "info", title, description }),
};

const ICONS = { success: CheckCircle2, warning: AlertTriangle, danger: XCircle, info: Info };
const STRIPE: Record<ToastTone, string> = {
  success: "var(--success-dot)", warning: "var(--warning-dot)", danger: "var(--danger-dot)", info: "var(--info-dot)",
};

export function ToastViewport() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4" role="status" aria-live="polite">
      {toasts.map((t) => (
        <ToastRow key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastRow({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const Icon = ICONS[item.tone];
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4200);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-md bg-inverse px-4 py-3 text-on-inverse shadow-md"
      style={{ animation: "toastIn 280ms cubic-bezier(0.16,1,0.3,1)" }}
    >
      <span className="absolute left-0 top-0 h-full w-[3px]" style={{ background: STRIPE[item.tone] }} />
      <Icon size={18} strokeWidth={1.75} style={{ color: STRIPE[item.tone] }} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-sm font-medium">{item.title}</div>
        {item.description && <div className="mt-0.5 text-[13px] text-on-inverse-2">{item.description}</div>}
      </div>
    </div>
  );
}
