import { useUI, type Lang } from "@/store/ui";
import { DICT } from "./dict";

export type { Lang };

/** Çeviri hook'u. t("nav.issue") → aktif dile göre metin. Eksik key → key'in kendisi (dev'de görünür). */
export function useT() {
  const lang = useUI((s) => s.lang);
  return (key: string): string => DICT[lang][key] ?? DICT.tr[key] ?? key;
}

/** Hook dışı (event handler vb.) için anlık çeviri. */
export function translate(key: string): string {
  const lang = useUI.getState().lang;
  return DICT[lang][key] ?? DICT.tr[key] ?? key;
}
