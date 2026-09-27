import { useUI, type Lang } from "@/store/ui";
import { DICT, type Key } from "./dict";

export type { Lang, Key };

/** Yer tutucu doldurma: t("x", { n: 3 }) → "3 kupon". */
export type Params = Record<string, string | number>;

function fill(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

function lookup(lang: Lang, key: Key, params?: Params): string {
  const hit = DICT[lang][key] ?? DICT.tr[key];
  if (hit === undefined && import.meta.env.DEV) {
    // Kaçak anahtar sessizce kendi adını basıyordu; geliştirmede görünür olsun.
    console.warn(`[i18n] eksik anahtar: ${String(key)}`);
  }
  return fill(hit ?? String(key), params);
}

/**
 * Çeviri hook'u.
 *
 * Anahtar tipi sözlükten türer: olmayan anahtar DERLENMEZ, İngilizce karşılığı
 * eksik olan anahtar da tsc hatası verir (dict.ts'teki Record<Key, string>).
 */
export function useT() {
  const lang = useUI((s) => s.lang);
  return (key: Key, params?: Params): string => lookup(lang, key, params);
}

/** Hook dışı (event handler vb.) için anlık çeviri. */
export function translate(key: Key, params?: Params): string {
  return lookup(useUI.getState().lang, key, params);
}
