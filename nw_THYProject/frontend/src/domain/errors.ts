/* ====================================================================
   İki dilli sunucu hatası.

   Mock sunucunun kural ihlalleri yalnız Türkçe mesaj fırlatıyordu ve arayüz
   bu metni toast'ta / satır içinde olduğu gibi gösteriyordu: İngilizce
   arayüzdeki personel en riskli işlemin (void, iade, exchange) neden
   reddedildiğini Türkçe okuyordu.

   Hata artık iki metni birlikte taşır: `message` Türkçedir (loglar ve
   mevcut testler onu okur — değişmez), `en` İngilizce karşılığıdır.
   Hangisinin gösterileceğine SUNUM katmanı karar verir (`errorText`).
   ==================================================================== */

export class LocalizedError extends Error {
  constructor(message: string, public readonly en?: string) {
    super(message);
  }
}

/**
 * Hatanın seçilen dildeki metni. İngilizce karşılığı yoksa Türkçe mesaja
 * düşer; Error olmayan bir değer fırlatılmışsa metne çevrilir.
 */
export function errorText(e: unknown, lang: "tr" | "en"): string {
  if (e instanceof LocalizedError) return lang === "en" && e.en ? e.en : e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}
