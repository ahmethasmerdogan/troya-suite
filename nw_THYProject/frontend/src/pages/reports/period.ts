// Dönem ön ayarları — üç raporun ortak omurgası.

export type PeriodId = "day" | "month" | "year" | "custom";

export const PERIODS: { id: PeriodId; label: string; hint: string }[] = [
  { id: "day", label: "Gün sonu", hint: "Bugünün kapanışı" },
  { id: "month", label: "Ay sonu", hint: "İçinde bulunulan ay" },
  { id: "year", label: "Yıl sonu", hint: "İçinde bulunulan yıl" },
  { id: "custom", label: "Özel tarih", hint: "Serbest aralık" },
];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function periodRange(id: PeriodId, now = new Date()): { from: string; to: string } | null {
  if (id === "day") return { from: iso(now), to: iso(now) };
  if (id === "month")
    return {
      from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  if (id === "year")
    return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(new Date(now.getFullYear(), 11, 31)) };
  return null;
}
