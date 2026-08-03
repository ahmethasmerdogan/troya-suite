import { useEffect } from "react";
import { create } from "zustand";
import { Check, Info, TriangleAlert, XCircle } from "lucide-react";
import { TONE_DOT, type Tone } from "./pill";

/* ====================================================================
   Bildirim — işin sonucunu söyler, işi yapmaz.

   Alt ortada belirir, dört saniyede kaybolur, panel yüzeyi taşır.
   Para işlemleri sunucu sonucunu bekler; bu yüzden toast bir SONUÇ
   bildirimidir, iyimser bir tahmin değil.
   ==================================================================== */

type Kind = "success" | "info" | "warning" | "danger";

interface Item {
  id: number;
  kind: Kind;
  title: string;
  detail?: string;
}

interface ToastState {
  items: Item[];
  push: (t: Omit<Item, "id">) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (t) => set((s) => ({ items: [...s.items, { ...t, id: ++seq }] })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (title: string, detail?: string) => useToastStore.getState().push({ kind: "success", title, detail }),
  info: (title: string, detail?: string) => useToastStore.getState().push({ kind: "info", title, detail }),
  warning: (title: string, detail?: string) => useToastStore.getState().push({ kind: "warning", title, detail }),
  danger: (title: string, detail?: string) => useToastStore.getState().push({ kind: "danger", title, detail }),
};

const ICON = { success: Check, info: Info, warning: TriangleAlert, danger: XCircle };
const TONE: Record<Kind, Tone> = { success: "green", info: "blue", warning: "amber", danger: "red" };

export function ToastHost() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div
      className="pointer-events-none fixed bottom-5 left-1/2 z-[70] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {items.map((t) => (
        <Row key={t.id} item={t} onDone={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function Row({ item, onDone }: { item: Item; onDone: () => void }) {
  const Icon = ICON[item.kind];
  useEffect(() => {
    const timer = setTimeout(onDone, 4200);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="anim-rise pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line bg-panel px-4 py-3">
      <Icon size={16} strokeWidth={2} className="mt-0.5 shrink-0" style={{ color: TONE_DOT[TONE[item.kind]] }} />
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold text-ink">{item.title}</div>
        {item.detail && <div className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{item.detail}</div>}
      </div>
    </div>
  );
}
