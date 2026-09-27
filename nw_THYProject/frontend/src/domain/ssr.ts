// SSR — Special Service Request kodları (IATA Resolution 1700 / AHM·PSCRM).
// Engelli / özel ihtiyaç sahibi yolcular için STANDART kodlar; el ile yazılmaz,
// katalogdan seçilir → resmî açıklama + işleme otomatik dolar.
// Bazı hizmetler ücretsizdir (erişilebilirlik hakkı), bazıları EMD doğurur.

export type SsrCategory = "mobility" | "sensory" | "medical" | "assistance" | "infant" | "animal";

/**
 * Belge/açıklama dili. Arayüz store'una (`store/ui`) BAĞLANMAZ — domain katmanı
 * sunumdan bağımsız kalsın (döngüsel bağımlılık olmasın). Varsayılan her yerde
 * "tr"; çağıran yerler değişmeden çalışır.
 */
export type DocLang = "tr" | "en";

export interface SsrDef {
  code: string; // 4 harfli IATA SSR kodu
  label: string; // TR açıklama
  labelEn: string; // EN açıklama (arayüz dili EN iken gösterilir)
  category: SsrCategory;
  /** Ücretsiz erişilebilirlik hizmeti mi (true) yoksa EMD/ücret doğurabilir mi (false). */
  free: boolean;
  /** EMD doğuran hizmetlerde önerilen RFISC + açıklama (otomatik EMD-A için). */
  emd?: { rfisc: string; description: string };
}

export const SSR_CATALOG: SsrDef[] = [
  // Hareket kabiliyeti
  { code: "WCHR", label: "Tekerlekli sandalye — rampaya kadar yürüyebilir", labelEn: "Wheelchair — can walk to the ramp", category: "mobility", free: true },
  { code: "WCHS", label: "Tekerlekli sandalye — merdiven çıkamaz", labelEn: "Wheelchair — cannot climb stairs", category: "mobility", free: true },
  { code: "WCHC", label: "Tekerlekli sandalye — tamamen taşınır (kabine kadar)", labelEn: "Wheelchair — immobile, carried to the cabin seat", category: "mobility", free: true },
  { code: "WCBD", label: "Kuru pilli kendi tekerlekli sandalyesi", labelEn: "Own wheelchair with dry-cell battery", category: "mobility", free: true },
  { code: "WCBW", label: "Islak pilli kendi tekerlekli sandalyesi", labelEn: "Own wheelchair with wet-cell battery", category: "mobility", free: true },
  // Duyusal
  { code: "BLND", label: "Görme engelli yolcu", labelEn: "Blind / visually impaired passenger", category: "sensory", free: true },
  { code: "DEAF", label: "İşitme engelli yolcu", labelEn: "Deaf / hearing impaired passenger", category: "sensory", free: true },
  { code: "DPNA", label: "Zihinsel/gelişimsel engel — refakat gerekli", labelEn: "Intellectual or developmental disability — assistance required", category: "sensory", free: true },
  // Refakat
  { code: "MAAS", label: "Karşılama & yönlendirme (meet and assist)", labelEn: "Meet and assist", category: "assistance", free: true },
  { code: "UMNR", label: "Refakatsiz çocuk", labelEn: "Unaccompanied minor", category: "assistance", free: false, emd: { rfisc: "0DD", description: "Refakatsiz çocuk hizmeti (UMNR)" } },
  // Tıbbi
  { code: "MEDA", label: "Tıbbi durum — uçuşa uygunluk (MEDIF)", labelEn: "Medical case — fitness to fly (MEDIF)", category: "medical", free: true },
  { code: "STCR", label: "Sedye (stretcher) ile seyahat", labelEn: "Travelling on a stretcher", category: "medical", free: false, emd: { rfisc: "0DA", description: "Sedye hizmeti (STCR)" } },
  { code: "OXYG", label: "Uçakta tıbbi oksijen", labelEn: "In-flight medical oxygen", category: "medical", free: false, emd: { rfisc: "0DG", description: "Tıbbi oksijen (OXYG)" } },
  { code: "PETC", label: "Kabinde evcil hayvan", labelEn: "Pet in cabin", category: "animal", free: false, emd: { rfisc: "0CY", description: "Kabinde evcil hayvan (PETC)" } },
  { code: "SVAN", label: "Servis/refakat hayvanı (ücretsiz)", labelEn: "Service / assistance animal (no charge)", category: "animal", free: true },
];

export function ssrByCode(code: string): SsrDef | undefined {
  return SSR_CATALOG.find((s) => s.code === code.toUpperCase());
}

/** Katalog kaydının seçilen dildeki açıklaması. */
export function ssrDefLabel(def: SsrDef, lang: DocLang = "tr"): string {
  return lang === "en" ? def.labelEn : def.label;
}

/** Koddan açıklama — bilinmeyen kodda `undefined` (`ssrByCode(c)?.label` ile aynı davranış). */
export function ssrLabel(code: string, lang: DocLang = "tr"): string | undefined {
  const def = ssrByCode(code);
  return def && ssrDefLabel(def, lang);
}

export const SSR_CATEGORY_LABEL: Record<SsrCategory, string> = {
  mobility: "Hareket",
  sensory: "Duyusal",
  medical: "Tıbbi",
  assistance: "Refakat",
  infant: "Bebek",
  animal: "Hayvan",
};

export const SSR_CATEGORY_LABEL_EN: Record<SsrCategory, string> = {
  mobility: "Mobility",
  sensory: "Sensory",
  medical: "Medical",
  assistance: "Assistance",
  infant: "Infant",
  animal: "Animal",
};

export function ssrCategoryLabel(cat: SsrCategory, lang: DocLang = "tr"): string {
  return lang === "en" ? SSR_CATEGORY_LABEL_EN[cat] : SSR_CATEGORY_LABEL[cat];
}
