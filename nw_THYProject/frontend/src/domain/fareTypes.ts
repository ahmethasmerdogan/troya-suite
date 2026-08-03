// Bilet tipi / sınıf kataloğu — Troya'da bilet tipleri otomatik gelir ve seçilir;
// el ile RBD/Fare Basis yazmak yerine sınıfı seç → RBD + Fare Basis otomatik dolar
// (kullanıcı yine de düzenleyebilir). Handbook 2.5.2 (RBD) / 2.6 (Fare Basis).

export type CabinName = "Business" | "Premium" | "Economy";

export interface FareType {
  id: string;
  label: string; // "Business Flex"
  cabin: CabinName;
  rbd: string; // booking class (1 harf)
  fareBasis: string; // önerilen fare basis kodu
  refundable: boolean;
  changeable: boolean;
  note: string; // kısa kural özeti
}

export const FARE_TYPES: FareType[] = [
  { id: "biz-flex", label: "Business Flex", cabin: "Business", rbd: "C", fareBasis: "CFLEX", refundable: true, changeable: true, note: "Tam esnek · iade & değişim serbest" },
  { id: "biz-classic", label: "Business Classic", cabin: "Business", rbd: "J", fareBasis: "JCLASSIC", refundable: true, changeable: true, note: "Değişim ücretli · iade kısmi" },
  { id: "biz-saver", label: "Business Saver", cabin: "Business", rbd: "D", fareBasis: "DSAVER", refundable: false, changeable: true, note: "İade yok · değişim ücretli" },
  { id: "prem-flex", label: "Premium Economy Flex", cabin: "Premium", rbd: "W", fareBasis: "WFLEX", refundable: true, changeable: true, note: "Esnek premium ekonomi" },
  { id: "prem-classic", label: "Premium Economy", cabin: "Premium", rbd: "P", fareBasis: "PCLASSIC", refundable: false, changeable: true, note: "Değişim ücretli" },
  { id: "eco-flex", label: "Economy Flex", cabin: "Economy", rbd: "Y", fareBasis: "YFLEX", refundable: true, changeable: true, note: "Tam esnek ekonomi" },
  { id: "eco-classic", label: "Economy Classic", cabin: "Economy", rbd: "M", fareBasis: "MCLASSIC", refundable: false, changeable: true, note: "Değişim ücretli · iade yok" },
  { id: "eco-saver", label: "Economy Saver", cabin: "Economy", rbd: "V", fareBasis: "VSAVER", refundable: false, changeable: false, note: "En uygun · iade & değişim yok" },
  { id: "eco-promo", label: "Economy Promo", cabin: "Economy", rbd: "L", fareBasis: "LPROMO", refundable: false, changeable: false, note: "Promosyon · kısıtlı" },
];

export function fareTypeById(id: string): FareType | undefined {
  return FARE_TYPES.find((f) => f.id === id);
}

/** RBD + fareBasis'ten en yakın bilet tipini bul (mevcut kuponu sınıf seçicide göstermek için). */
export function fareTypeByCoupon(rbd?: string, fareBasis?: string): FareType | undefined {
  if (fareBasis) {
    const byFb = FARE_TYPES.find((f) => f.fareBasis.toUpperCase() === fareBasis.toUpperCase());
    if (byFb) return byFb;
  }
  if (rbd) return FARE_TYPES.find((f) => f.rbd.toUpperCase() === rbd.toUpperCase());
  return undefined;
}
