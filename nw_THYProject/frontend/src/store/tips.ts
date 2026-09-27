import { create } from "zustand";

/* ====================================================================
   İpucu katmanı — durum.

   Üç parça aynı tercihi paylaşır:
   · karşılama (ilk girişte bir kez; `troya.onboarded` — e2e bu anahtarla atlar)
   · bağlamsal ipucu balonları (okununca bir daha görünmez)
   · ekran turları (spot ışıklı adım adım gezinti)

   Varsayılan KAPALI: ipuçları yalnız karşılamayı tamamlayan (ya da profilden
   açan) kullanıcıya görünür. Böylece karşılamayı `troya.onboarded` ile atlayan
   otomasyon ve alışkın kullanıcı ekranda beklenmedik bir katmanla karşılaşmaz.
   Tercih tarayıcı başına tutulur — hassas veri değildir, çıkışta silinmez.
   ==================================================================== */

export const ONBOARDED_KEY = "troya.onboarded";
const TIPS_KEY = "troya.tips.v1";

interface Persisted {
  enabled: boolean;
  seen: string[];
  tours: string[];
  dailyHidden: boolean;
}

const EMPTY: Persisted = { enabled: false, seen: [], tours: [], dailyHidden: false };

function load(): Persisted {
  if (typeof localStorage === "undefined") return EMPTY;
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(TIPS_KEY) ?? "null");
    if (!raw || typeof raw !== "object") return EMPTY;
    const r = raw as Partial<Persisted>;
    return {
      enabled: r.enabled === true,
      seen: Array.isArray(r.seen) ? r.seen.filter((x) => typeof x === "string") : [],
      tours: Array.isArray(r.tours) ? r.tours.filter((x) => typeof x === "string") : [],
      dailyHidden: r.dailyHidden === true,
    };
  } catch {
    return EMPTY; // bozuk kayıt — sıfırdan başla
  }
}

function save(p: Persisted): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(TIPS_KEY, JSON.stringify(p));
}

function onboarded(): boolean {
  return typeof localStorage !== "undefined" && localStorage.getItem(ONBOARDED_KEY) !== null;
}

interface TipsState extends Persisted {
  /** Karşılama tamamlandı mı (bu tarayıcıda). */
  onboarded: boolean;
  /** Şu an oynayan tur. */
  activeTour: string | null;
  /** Karşılamayı kapat; ipuçlarını kullanıcının seçimine göre aç/kapat. */
  finishOnboarding: (showTips: boolean) => void;
  /** Karşılamayı yeniden göster (profil). */
  replayOnboarding: () => void;
  setEnabled: (on: boolean) => void;
  dismiss: (id: string) => void;
  /** Okunan ipuçlarını ve biten turları unut — hepsi yeniden görünür. */
  reset: () => void;
  startTour: (id: string) => void;
  /** Turu kapat — tamamlanan da yarıda bırakılan da "görüldü" sayılır. */
  endTour: () => void;
  /** Turu oynatmadan "görüldü" say (tur önerisini reddetmek). */
  skipTour: (id: string) => void;
  setDailyHidden: (hidden: boolean) => void;
}

function persisted(s: TipsState): Persisted {
  return { enabled: s.enabled, seen: s.seen, tours: s.tours, dailyHidden: s.dailyHidden };
}

export const useTips = create<TipsState>((set, get) => {
  const commit = (patch: Partial<TipsState>) => {
    set(patch);
    save(persisted(get()));
  };
  const addTour = (id: string) => (get().tours.includes(id) ? get().tours : [...get().tours, id]);

  return {
    ...load(),
    onboarded: onboarded(),
    activeTour: null,

    finishOnboarding: (showTips) => {
      if (typeof localStorage !== "undefined") localStorage.setItem(ONBOARDED_KEY, "1");
      set({ onboarded: true });
      commit({ enabled: showTips });
    },
    replayOnboarding: () => {
      if (typeof localStorage !== "undefined") localStorage.removeItem(ONBOARDED_KEY);
      set({ onboarded: false });
    },
    setEnabled: (enabled) => commit({ enabled }),
    dismiss: (id) => {
      if (get().seen.includes(id)) return;
      commit({ seen: [...get().seen, id] });
    },
    reset: () => commit({ seen: [], tours: [], enabled: true, dailyHidden: false }),
    startTour: (id) => set({ activeTour: id }),
    endTour: () => {
      const id = get().activeTour;
      if (!id) return;
      set({ activeTour: null });
      // Yarıda bırakılan tur da "görüldü" sayılır: öneri tekrar tekrar çıkmasın.
      commit({ tours: addTour(id) });
    },
    skipTour: (id) => commit({ tours: addTour(id) }),
    setDailyHidden: (dailyHidden) => commit({ dailyHidden }),
  };
});

/** Bir ipucu balonu şu an gösterilmeli mi. */
export function useTipVisible(id: string): boolean {
  return useTips((s) => s.enabled && s.onboarded && !s.seen.includes(id) && s.activeTour === null);
}
