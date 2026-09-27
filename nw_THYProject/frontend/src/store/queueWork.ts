import { create } from "zustand";

/**
 * Kuyruk çalışma durumu — personelin "bitti" ve "ertele" işaretleri.
 *
 * Kuyruk kaydın kendisinden türer (`domain/queues`); bu depo yalnız gişenin
 * o işe ne yaptığını tutar. "Bitti" denen iş, kaydı düzeltilmemiş olsa bile
 * listeden kalkar (ör. yolcuya ulaşıldı, geri dönüş bekleniyor); "Ertele"
 * işi dört saatliğine sıranın sonuna atar (Amadeus QD).
 */
const KEY = "troya.queue.v1";
export const DELAY_MS = 4 * 3_600_000;

interface Persisted { done: Record<string, number>; delayed: Record<string, number> }

function load(): Persisted {
  if (typeof localStorage === "undefined") return { done: {}, delayed: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Persisted> | null;
    return { done: raw?.done ?? {}, delayed: raw?.delayed ?? {} };
  } catch {
    return { done: {}, delayed: {} };
  }
}

interface QueueWorkState extends Persisted {
  complete: (id: string) => void;
  delay: (id: string) => void;
  reopen: (id: string) => void;
}

export const useQueueWork = create<QueueWorkState>((set, get) => {
  const save = () => {
    if (typeof localStorage !== "undefined") {
      const { done, delayed } = get();
      localStorage.setItem(KEY, JSON.stringify({ done, delayed }));
    }
  };
  return {
    ...load(),
    complete: (id) => { set({ done: { ...get().done, [id]: Date.now() } }); save(); },
    delay: (id) => { set({ delayed: { ...get().delayed, [id]: Date.now() + DELAY_MS } }); save(); },
    reopen: (id) => {
      const { [id]: _d, ...done } = get().done;
      const { [id]: _l, ...delayed } = get().delayed;
      void _d; void _l;
      set({ done, delayed });
      save();
    },
  };
});

/** Çalışma durumunu uygula: bitenler çıkar, ertelenenler sona. */
export function applyWork<T extends { id: string }>(items: T[], w: Persisted, now: number): (T & { delayedUntil?: number })[] {
  const live = items.filter((i) => !w.done[i.id]);
  const active = live.filter((i) => !(w.delayed[i.id] > now));
  const later = live.filter((i) => w.delayed[i.id] > now).map((i) => ({ ...i, delayedUntil: w.delayed[i.id] }));
  return [...active, ...later];
}
