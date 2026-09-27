/**
 * Rota → gövde şekli.
 *
 * İki şekil var:
 *   - tek sütun  (FullView) — sihirbaz, tablo, pano, doküman, yönetim.
 *   - konsol     (SplitView) — kayıt gezme: solda liste, sağda seçili kayıt,
 *                 iki panel kendi başına kayar, kenardan kenara durur.
 *
 * Konsol sayfaları `SplitView` kurar; onları tek sütunun dolgulu kutusuna
 * koymak listeyi sayfanın ortasında yarıda kesiyor, detay panelini içerik
 * kadar kısa bırakıyordu. Hangi rotanın konsol olduğu burada tek yerde.
 */
const SPLIT: RegExp[] = [
  /^\/chat(\/|$)/,
  /^\/checkin(\/[^/]+)?$/, // uçuş listesi + uçuş (koltuk seçimi tek sütundur)
  /^\/res(\/[A-Z0-9]{6})?$/, // PNR listesi + PNR (oluştur/uygunluk tek sütun)
  /^\/orders(\/[^/]+)?$/,
  /^\/emds(\/[^/]+)?$/, // EMD listesi + EMD (makbuz tek sütundur)
];

export function isSplit(pathname: string): boolean {
  return SPLIT.some((r) => r.test(pathname));
}
