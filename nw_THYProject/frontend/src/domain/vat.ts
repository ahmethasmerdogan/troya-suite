// KDV (Türkiye) — hava taşımacılığı.
//
// KDV Kanunu md.20/4: "bedelin biletle tahsil edildiği hallerde tarife ve bilet
// bedeli KDV DAHİL edilerek tespit olunur ve vergi müşteriye ayrıca intikal
// ettirilmez." Bu yüzden KDV bilete AYRI KALEM OLARAK EKLENMEZ; toplamın
// içinden iç yüzdeyle ayrıştırılır:  kdv = matrah * oran / (1 + oran)
//
// md.14 + 84/8889 BKK: başlangıç veya bitiş noktalarından biri yurt dışındaysa
// (ya da taşıma transitse) KDV hesaplanmaz.
//
// md.13/b: hava meydanlarında uçak ve yolculara verilen hizmetler istisnadır →
// yolcu servis ücreti (VQ) KDV MATRAHINA GİRMEZ. (Uçak başına toplam servis
// ücreti KDV hariç 100 TL'nin altındaysa istisna uygulanmaz — 2004/8127.)
//
// md.35: iade / exchange düzeltmesinde KDV, İLK KESİM TARİHİNDEKİ oranla
// düzeltilir — iade günündeki oranla değil. Bu yüzden tarihli oran tablosu.

import type { VatBreakdown } from "./types";

export interface VatRatePeriod { from: string; to?: string; rate: number }

/** Tarihli genel KDV oranı. En yeni dönem başta. */
export const VAT_RATES: VatRatePeriod[] = [
  { from: "2023-07-10", rate: 0.20 }, // 7346 sayılı CB Kararı
  { from: "2021-10-01", to: "2023-07-09", rate: 0.18 },
  { from: "2020-04-01", to: "2021-09-30", rate: 0.01 }, // COVID indirimi
  { from: "1985-01-01", to: "2020-03-31", rate: 0.18 },
];

/** Verilen tarihte yürürlükteki oran. */
export function vatRateAt(iso: string): number {
  const d = iso.slice(0, 10);
  for (const p of VAT_RATES) {
    if (d >= p.from && (!p.to || d <= p.to)) return p.rate;
  }
  return 0.20;
}

/**
 * KDV dökümü. `taxable` yalnız YURT İÇİ taşımada doğar.
 * @param vatBase çıplak ücret + taşıyıcı ek ücretleri (YQ/YR) — VQ HARİÇ.
 */
export function computeVat(vatBase: number, domestic: boolean, issueDateIso: string): VatBreakdown {
  if (!domestic) {
    return {
      regime: "exempt", exemptionArticle: "KDV_14", rate: 0,
      base: vatBase, amount: 0, rateDate: issueDateIso.slice(0, 10),
    };
  }
  const rate = vatRateAt(issueDateIso);
  // İç yüzde — bedel KDV dahil olduğu için matrahın üstüne EKLENMEZ.
  const amount = Math.round((vatBase * rate) / (1 + rate) * 100) / 100;
  return { regime: "taxable", rate, base: vatBase, amount, rateDate: issueDateIso.slice(0, 10) };
}
