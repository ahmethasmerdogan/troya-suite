// SSR — Special Service Request kodları (IATA Resolution 1700 / AHM·PSCRM).
// Engelli / özel ihtiyaç sahibi yolcular için STANDART kodlar; el ile yazılmaz,
// katalogdan seçilir → resmî açıklama + işleme otomatik dolar.
// Bazı hizmetler ücretsizdir (erişilebilirlik hakkı), bazıları EMD doğurur.

export type SsrCategory = "mobility" | "sensory" | "medical" | "assistance" | "infant" | "animal";

export interface SsrDef {
  code: string; // 4 harfli IATA SSR kodu
  label: string; // TR açıklama
  category: SsrCategory;
  /** Ücretsiz erişilebilirlik hizmeti mi (true) yoksa EMD/ücret doğurabilir mi (false). */
  free: boolean;
  /** EMD doğuran hizmetlerde önerilen RFISC + açıklama (otomatik EMD-A için). */
  emd?: { rfisc: string; description: string };
}

export const SSR_CATALOG: SsrDef[] = [
  // Hareket kabiliyeti
  { code: "WCHR", label: "Tekerlekli sandalye — rampaya kadar yürüyebilir", category: "mobility", free: true },
  { code: "WCHS", label: "Tekerlekli sandalye — merdiven çıkamaz", category: "mobility", free: true },
  { code: "WCHC", label: "Tekerlekli sandalye — tamamen taşınır (kabine kadar)", category: "mobility", free: true },
  { code: "WCBD", label: "Kuru pilli kendi tekerlekli sandalyesi", category: "mobility", free: true },
  { code: "WCBW", label: "Islak pilli kendi tekerlekli sandalyesi", category: "mobility", free: true },
  // Duyusal
  { code: "BLND", label: "Görme engelli yolcu", category: "sensory", free: true },
  { code: "DEAF", label: "İşitme engelli yolcu", category: "sensory", free: true },
  { code: "DPNA", label: "Zihinsel/gelişimsel engel — refakat gerekli", category: "sensory", free: true },
  // Refakat
  { code: "MAAS", label: "Karşılama & yönlendirme (meet and assist)", category: "assistance", free: true },
  { code: "UMNR", label: "Refakatsiz çocuk", category: "assistance", free: false, emd: { rfisc: "0DD", description: "Refakatsiz çocuk hizmeti (UMNR)" } },
  // Tıbbi
  { code: "MEDA", label: "Tıbbi durum — uçuşa uygunluk (MEDIF)", category: "medical", free: true },
  { code: "STCR", label: "Sedye (stretcher) ile seyahat", category: "medical", free: false, emd: { rfisc: "0DA", description: "Sedye hizmeti (STCR)" } },
  { code: "OXYG", label: "Uçakta tıbbi oksijen", category: "medical", free: false, emd: { rfisc: "0DG", description: "Tıbbi oksijen (OXYG)" } },
  { code: "PETC", label: "Kabinde evcil hayvan", category: "animal", free: false, emd: { rfisc: "0CY", description: "Kabinde evcil hayvan (PETC)" } },
  { code: "SVAN", label: "Servis/refakat hayvanı (ücretsiz)", category: "animal", free: true },
];

export function ssrByCode(code: string): SsrDef | undefined {
  return SSR_CATALOG.find((s) => s.code === code.toUpperCase());
}

export const SSR_CATEGORY_LABEL: Record<SsrCategory, string> = {
  mobility: "Hareket",
  sensory: "Duyusal",
  medical: "Tıbbi",
  assistance: "Refakat",
  infant: "Bebek",
  animal: "Hayvan",
};
