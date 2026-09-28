import { useCallback } from "react";
import { useUI } from "@/store/ui";
import { errorText } from "@/domain/errors";

// Sunucu hatasını arayüz dilinde metne çevirir — toast'ta ve satır içi hata
// alanında `e.message` yerine bu kullanılır; aksi hâlde İngilizce arayüzdeki
// personel reddin gerekçesini Türkçe okur. Dil değişmedikçe aynı referans.
export function useErrorText(): (e: unknown) => string {
  const lang = useUI((s) => s.lang);
  return useCallback((e: unknown) => errorText(e, lang), [lang]);
}
