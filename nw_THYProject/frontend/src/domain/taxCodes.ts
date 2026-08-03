// Vergi / harç / ücret (TFC) kataloğu ve İADE EDİLEBİLİRLİK kuralları.
//
// Kaynaklar: IATA Ticketing Handbook 14.1 (TFC tipleri) ve 14.2 (ülke → ticket
// code tablosu); iade edilebilirlik davranışı için 12.5(c) / 12.11 ("refund the
// difference, if refundable") ve sektör düzenlemeleri.
//
// TEMEL AYRIM (araştırma bulgusu, sistemin kalbi):
//
//   • Kalem bir OLAYA bağlıysa (kalkış / uçağa biniş / varış) → yolcu o olayı
//     gerçekleştirmediyse harç doğmaz ve İADE EDİLİR. Bilet "iade edilemez"
//     olsa bile bu kalemler geri verilir; çünkü vergiyi doğuran şey ücret
//     değil, fiili taşımadır.
//   • Kalem ÖDENEN TUTARA bağlıysa (yüzde bazlı bilet vergisi, KDV) → ücretin
//     iade edilebilirliğini İZLER. Ücret iade edilmiyorsa bu vergi de edilmez.
//   • Taşıyıcı kaynaklı ek ücret (YQ / YR) devlet vergisi DEĞİLDİR; ücret
//     kuralına tabidir. "Vergiler her zaman iade edilir" kuralının dışındadır.
//
// İki bilinen istisna:
//   • US XF (Passenger Facility Charge): devlet harcı olmasına rağmen ücretin
//     iade edilebilirliğini izler (14 C.F.R. §158.45).
//   • US AY (11 Eylül Güvenlik Ücreti): kullanılmamış / iade edilemez / süresi
//     dolmuş bilette bile iade edilir (49 U.S.C. §44940).
//
// XT BİR VERGİ KODU DEĞİLDİR: bilet üzerindeki vergi kutusu yetmediğinde
// kalanların toplandığı bir SUNUM göstergesidir. Kayda asla XT yazılmaz —
// kalemler tek tek saklanır, XT yalnız gösterimde hesaplanır.

export type TfcType = "departure" | "sales" | "transportation";

/**
 * Kalemin iade edilebilirliğini neyin belirlediği.
 *  perDeparture / perEnplanement / perArrival — olay bazlı
 *  percentOfFare — ödenen tutara bağlı, ücret kuralını izler
 *  always        — kullanılmasa da iade edilir
 *  never         — hiçbir hâlde iade edilmez
 */
export type TfcRefundBasis = "perDeparture" | "perEnplanement" | "perArrival" | "percentOfFare" | "always" | "never";

export interface TaxCodeDef {
  code: string;
  name: string;
  /** Handbook 14.2'deki İngilizce ad. */
  nameEn: string;
  country?: string;
  type: TfcType;
  refundBasis: TfcRefundBasis;
  /** İstisna: olay bazlı olmasına rağmen ücretin kuralını izler (US XF). */
  followsFare?: boolean;
  /** Taşıyıcının koyduğu ek ücret — devlet vergisi değil. */
  carrierImposed?: boolean;
  scope?: "domestic" | "international";
}

export const TAX_CODES: TaxCodeDef[] = [
  // --- Türkiye (Handbook 14.2) ---
  { code: "TR", name: "Havalimanı Hizmet Ücreti (dış hat)", nameEn: "Airport Service Charge (International)", country: "TR", type: "transportation", refundBasis: "perDeparture", scope: "international" },
  { code: "VQ", name: "Havalimanı Hizmet Ücreti (iç hat)", nameEn: "Airport Service Charge (Domestic)", country: "TR", type: "transportation", refundBasis: "perDeparture", scope: "domestic" },
  // Yurt içi hava taşımasında KDV doğar; uluslararası taşıma istisnadır
  // (KDV Kanunu m.14). Ödenen tutar üzerinden alınır → ücretin kuralını izler.
  { code: "KDV", name: "Katma Değer Vergisi (iç hat)", nameEn: "Value Added Tax (Domestic)", country: "TR", type: "sales", refundBasis: "percentOfFare", scope: "domestic" },

  // --- Taşıyıcı kaynaklı ek ücretler ---
  { code: "YQ", name: "Taşıyıcı ek ücreti (yakıt/güvenlik)", nameEn: "Carrier-imposed surcharge", type: "sales", refundBasis: "percentOfFare", carrierImposed: true },
  { code: "YR", name: "Taşıyıcı hizmet ücreti", nameEn: "Carrier-imposed misc. charge", type: "sales", refundBasis: "percentOfFare", carrierImposed: true },

  // --- ABD (özel kurallı kalemler) ---
  { code: "XF", name: "Passenger Facility Charge (ABD)", nameEn: "Passenger Facility Charge", country: "US", type: "transportation", refundBasis: "perEnplanement", followsFare: true },
  { code: "AY", name: "11 Eylül Güvenlik Ücreti (ABD)", nameEn: "September 11th Security Fee", country: "US", type: "departure", refundBasis: "always" },
  { code: "US", name: "ABD Bilet Vergisi (%7,5)", nameEn: "U.S. Domestic Transportation Tax", country: "US", type: "sales", refundBasis: "percentOfFare" },
  { code: "XY", name: "Göçmenlik Denetim Ücreti (ABD)", nameEn: "Immigration User Fee", country: "US", type: "perArrival" as TfcType, refundBasis: "perArrival" },
  { code: "YC", name: "Gümrük Denetim Ücreti (ABD)", nameEn: "Customs User Fee", country: "US", type: "transportation", refundBasis: "perArrival" },

  // --- Sık görülen diğer ülkeler (14.2) ---
  { code: "DE", name: "Havalimanı güvenlik harcı (Almanya)", nameEn: "Airport Security Charge", country: "DE", type: "departure", refundBasis: "perDeparture" },
  { code: "RA", name: "Yolcu servis ücreti — dış hat (Almanya)", nameEn: "Passenger Service Charge - Intl", country: "DE", type: "transportation", refundBasis: "perDeparture", scope: "international" },
  { code: "RD", name: "Yolcu servis ücreti — iç hat (Almanya)", nameEn: "Passenger Service Charge - Dom.", country: "DE", type: "transportation", refundBasis: "perDeparture", scope: "domestic" },
  { code: "FR", name: "Havalimanı vergisi (Fransa)", nameEn: "Airport Tax", country: "FR", type: "departure", refundBasis: "perDeparture" },
  { code: "GB", name: "Air Passenger Duty (İngiltere)", nameEn: "Air Passenger Duty (APD)", country: "GB", type: "departure", refundBasis: "perDeparture" },
  { code: "UB", name: "Yolcu servis ücreti (İngiltere)", nameEn: "Passenger Service Charge", country: "GB", type: "transportation", refundBasis: "perDeparture" },
  { code: "QL", name: "Havalimanı hizmet ücreti (Hollanda)", nameEn: "Airport Service Charge", country: "NL", type: "transportation", refundBasis: "perDeparture" },
  { code: "RN", name: "Yolcu servis ücreti (Hollanda)", nameEn: "Passenger Service Charge", country: "NL", type: "transportation", refundBasis: "perDeparture" },
  { code: "JP", name: "Tüketim vergisi (Japonya)", nameEn: "Consumption Tax", country: "JP", type: "sales", refundBasis: "percentOfFare" },
  { code: "SW", name: "Yolcu tesis ücreti — dış hat (Japonya)", nameEn: "Passenger Service Facilities Charge (Intl)", country: "JP", type: "transportation", refundBasis: "perDeparture", scope: "international" },
  { code: "AE", name: "Yolcu servis ücreti (BAE)", nameEn: "Passenger Service Charge", country: "AE", type: "transportation", refundBasis: "perDeparture" },
];

const BY_CODE = new Map(TAX_CODES.map((t) => [t.code, t]));

export function taxByCode(code?: string): TaxCodeDef | undefined {
  return code ? BY_CODE.get(code.toUpperCase()) : undefined;
}

/**
 * Bu TFC kalemi iade edilir mi?
 *
 * @param code            vergi kodu
 * @param couponFlown     kalemin bağlı olduğu kupon uçuldu mu (olay gerçekleşti mi)
 * @param fareRefundable  ücretin kendisi iade edilebilir mi (ücret kuralından)
 *
 * Katalogda olmayan kod: olay bazlı kabul edilir — uçulmadıysa iade edilir.
 */
export function isTfcRefundable(code: string, couponFlown: boolean, fareRefundable: boolean): boolean {
  const def = taxByCode(code);
  const basis: TfcRefundBasis = def?.refundBasis ?? "perDeparture";
  if (basis === "never") return false;
  if (basis === "always") return true;
  if (basis === "percentOfFare") return fareRefundable && !couponFlown;
  // olay bazlı: kural gereği ücretten bağımsızdır — tek istisna followsFare (US XF).
  if (def?.followsFare) return fareRefundable && !couponFlown;
  return !couponFlown;
}

/** Neden iade edildi / edilmedi — personele gösterilecek tek cümle. */
export function tfcRefundReason(code: string, couponFlown: boolean, fareRefundable: boolean): string {
  const def = taxByCode(code);
  const basis: TfcRefundBasis = def?.refundBasis ?? "perDeparture";
  if (basis === "always") return "Kullanılmasa da iade edilir (yasal düzenleme).";
  if (basis === "never") return "İade edilmez.";
  if (couponFlown) return "Kupon uçuldu — harç doğdu, iade edilmez.";
  if (basis === "percentOfFare" || def?.followsFare) {
    return fareRefundable
      ? "Ödenen tutara bağlı; ücret iade edilebilir olduğu için iade edilir."
      : "Ödenen tutara bağlı; ücret iade edilemediği için iade edilmez.";
  }
  return "Kalkış gerçekleşmedi — harç doğmadı, iade edilir.";
}

export function isCarrierImposed(code: string): boolean {
  return !!taxByCode(code)?.carrierImposed;
}

/** Devlet vergisi mi (taşıyıcı ücreti değil)? — belgede ayrı gruplanır. */
export function isGovernmentTax(code: string): boolean {
  return !isCarrierImposed(code);
}
