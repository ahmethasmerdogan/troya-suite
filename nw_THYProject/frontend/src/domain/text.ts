/**
 * Arama için metni katlar: büyük harf + Türkçe harflerin aksansız karşılığı
 * (Ç→C, Ğ→G, İ/ı→I, Ö→O, Ş→S, Ü→U) + diğer birleşik işaretler atılır.
 * Personel "KILIC" yazınca "KILIÇ" kaydını, "MULLER" yazınca "MÜLLER"i bulur;
 * yolcu adı sistemde hangi yazımla durursa dursun arama tutar.
 */
const TR_FOLD: Record<string, string> = { Ç: "C", Ğ: "G", İ: "I", I: "I", ı: "I", Ö: "O", Ş: "S", Ü: "U", ç: "C", ğ: "G", i: "I", ö: "O", ş: "S", ü: "U" };

export function fold(s: string | undefined | null): string {
  if (!s) return "";
  const mapped = [...s].map((ch) => TR_FOLD[ch] ?? ch).join("");
  return mapped.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

/** `hay` içinde `needle` geçiyor mu — ikisi de katlanarak karşılaştırılır. */
export function foldIncludes(hay: string | undefined | null, needle: string): boolean {
  const n = fold(needle.trim());
  return !!n && fold(hay).includes(n);
}
