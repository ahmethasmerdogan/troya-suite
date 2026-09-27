// Döviz çevirisi — DEMO statik kurlar. Gerçekte günlük IATA ROE / banka kuru
// (bu modülün işi değil; backend/port besler). Ekranda "≈ TRY / ≈ USD" göstermek için.

/** Para birimi → TRY karşılığı (1 birim kaç TRY). Demo değerler (~2026). */
export const FX_TO_TRY: Record<string, number> = {
  TRY: 1,
  USD: 32.5,
  EUR: 35.2,
  GBP: 41.0,
  CHF: 36.4,
  JPY: 0.215,
  AED: 8.85,
  SAR: 8.66,
  QAR: 8.93,
  KWD: 105.5,
  RUB: 0.35,
  CNY: 4.49,
};

export const FX_CURRENCIES = Object.keys(FX_TO_TRY);

/** from→to çevirir. Kur bilinmiyorsa null. */
export function convert(amount: number, from: string, to: string): number | null {
  const f = FX_TO_TRY[from?.toUpperCase()];
  const t = FX_TO_TRY[to?.toUpperCase()];
  if (!f || !t || !Number.isFinite(amount)) return null;
  return (amount * f) / t;
}

/** Bir tutarı verilen para biriminde okunaklı formatlar (locale gruplaması). */
export function fmtMoney(amount: number, currency: string): string {
  const max = ["JPY", "TRY"].includes(currency.toUpperCase()) && amount >= 1000 ? 0 : 2;
  return `${amount.toLocaleString("en-US", { maximumFractionDigits: max })} ${currency.toUpperCase()}`;
}

/**
 * Ekranda gösterilecek "≈ ..." çeviri satırları. Girilen para birimi hariç,
 * hedef listesindeki her biri için bir satır döner (kur biliniyorsa).
 * Varsayılan hedefler: TRY ve USD.
 */
export function fxLines(amount: number, currency: string, targets: string[] = ["TRY", "USD"]): string[] {
  if (!amount || !currency || !FX_TO_TRY[currency.toUpperCase()]) return [];
  const cur = currency.toUpperCase();
  return targets
    .map((t) => t.toUpperCase())
    .filter((t) => t !== cur)
    .map((t) => {
      const v = convert(amount, cur, t);
      return v == null ? null : `≈ ${fmtMoney(v, t)}`;
    })
    .filter((s): s is string => s !== null);
}
