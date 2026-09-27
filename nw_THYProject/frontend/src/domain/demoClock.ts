/**
 * Demo saati — fixture tarihlerini bugüne taşır.
 *
 * Örnek veri Haziran 2026'da yazıldı ve tarihleri sabitti. Aylar geçtikçe
 * canlı demoda her uçuş geçmişte kaldı, "bugün" ve "bu ay" raporları boş
 * göründü, açık kuponların hepsi "kalkış geçti" dedi. Veri, yazıldığı günün
 * (`FIXTURE_TODAY`) bugün olduğu varsayımıyla tam gün kaydırılır: kalkışa
 * kalan süreler, kontrol süreleri ve TTL'ler tasarlandığı gibi kalır.
 *
 * Testte kayma YOKTUR (`MODE === "test"`): birim testleri sabit tarihlere
 * dayanır ve her gün aynı sonucu vermelidir.
 */
const DAY = 86_400_000;

/** El yazımı fixture'ların "bugün"ü. */
export const FIXTURE_TODAY = Date.UTC(2026, 5, 18);

const IS_TEST = typeof import.meta !== "undefined" && import.meta.env?.MODE === "test";

/** Demonun "şimdi"si: testte sabit gün, canlıda gerçek saat. */
export const DEMO_NOW = IS_TEST ? FIXTURE_TODAY + 12 * 3_600_000 : Date.now();

/** Fixture'lara uygulanan tam-gün kayma (geriye kaydırılmaz). */
export const DEMO_SHIFT_MS = Math.max(0, Math.floor((DEMO_NOW - FIXTURE_TODAY) / DAY)) * DAY;

const ISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** Tek bir ISO tarihini (tam ya da yalnız gün) kaydır; biçimi korunur. */
export function shiftIso(iso: string, ms = DEMO_SHIFT_MS): string {
  if (!ms || !ISO.test(iso)) return iso;
  const dateOnly = iso.length === 10;
  const t = Date.parse(dateOnly ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(t)) return iso;
  const out = new Date(t + ms).toISOString();
  return dateOnly ? out.slice(0, 10) : iso.endsWith("Z") && !iso.includes(".") ? out.replace(".000Z", "Z") : out;
}

/**
 * Fixture ağacındaki bütün ISO tarihlerini yerinde kaydır. `skip` altındaki
 * alanlar (zaten `Date.now()`'a göre yazılmış TTL gibi) dokunulmaz.
 */
export function shiftFixture<T>(value: T, skip: readonly string[] = [], ms = DEMO_SHIFT_MS): T {
  if (!ms) return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return shiftIso(v, ms);
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) v[i] = walk(v[i]);
      return v;
    }
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      for (const k of Object.keys(o)) if (!skip.includes(k)) o[k] = walk(o[k]);
      return o;
    }
    return v;
  };
  return walk(value) as T;
}
