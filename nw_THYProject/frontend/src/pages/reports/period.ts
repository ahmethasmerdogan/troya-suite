// Dönem ön ayarları — üç raporun ortak omurgası.

export type PeriodId = "day" | "month" | "year" | "custom";

/**
 * Sıra burada durur, ETİKET durmaz: dönem adı ve ipucu dile bağlıdır ve
 * `report.period.*` anahtarlarından okunur (bkz. çağrı yerlerindeki
 * `PERIOD_KEY`). Sözlük dışında sabit metin tutmak, arayüz İngilizceye
 * geçtiğinde çipleri Türkçe bırakıyordu.
 */
export const PERIODS: { id: PeriodId }[] = [
  { id: "day" },
  { id: "month" },
  { id: "year" },
  { id: "custom" },
];

/**
 * Aralıklar UTC gününe göre kurulur.
 *
 * Raporlama dönemi kimliği olayın ISO damgasından kesilir (`reportingPeriodId`
 * → UTC günü). Aralığı yerel takvimden üretmek, UTC+3'te her günün son üç
 * saatini hiçbir "gün sonu" raporuna girmez hâle getiriyordu. Tek gün tanımı:
 * UTC.
 */
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function periodRange(id: PeriodId, now = new Date()): { from: string; to: string } | null {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (id === "day") return { from: iso(now), to: iso(now) };
  if (id === "month")
    return {
      from: iso(new Date(Date.UTC(y, m, 1))),
      to: iso(new Date(Date.UTC(y, m + 1, 0))),
    };
  if (id === "year")
    return { from: iso(new Date(Date.UTC(y, 0, 1))), to: iso(new Date(Date.UTC(y, 11, 31))) };
  return null;
}
