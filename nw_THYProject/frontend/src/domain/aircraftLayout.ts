/* ====================================================================
   Uçak tipine göre kabin düzeni.

   Koltuk haritası her uçuşta 42 sıra × A-F = 252 koltuk üretiyordu: 737-800
   de, A350-900 da, A321neo de aynı. Kapasite üç ayrı sayı söylüyordu —
   `capacity` alanı, `config` metni ("C12 / Y156") ve haritadaki koltuk
   sayısı birbirini tutmuyordu. Kabin sınırları ("Business 1-5") ve çıkış
   sıraları uçaktan bağımsız sabitti.

   Burası tek doğruluk kaynağı: sıra sayısı, koltuk düzeni, kabin sınırları,
   çıkış ve bulkhead sıraları uçak tipinden gelir; kapasite düzenden TÜRETİLİR.

   Düzenler THY'nin fiilen kullandığı yapılandırmalara dayanır (dar gövde 3-3,
   A330 2-4-2, 777 3-4-3, A350 3-3-3); rakamlar demo amaçlı yuvarlanmıştır.
   ==================================================================== */

export type CabinClass = "Business" | "Premium" | "Economy";

export interface CabinZone {
  cabin: CabinClass;
  fromRow: number;
  toRow: number;
  /** Koltuk sütunları, koridorlar `null` ile ayrılır: ["A","B",null,"C","D"] */
  columns: (string | null)[];
}

export interface AircraftLayout {
  /** `DepartureFlight.aircraft.type` ile eşleşen ad. */
  type: string;
  /** Kısa ad — başlıkta ve lejantta. */
  short: string;
  zones: CabinZone[];
  /** Acil çıkış sıraları — bu sıralarda kısıtlı yolcu oturamaz (EASA/DOT). */
  exitRows: number[];
  /** Kabin bölmesinin ilk sırası — önünde koltuk yok (bebek beşiği burada). */
  bulkheadRows: number[];
  /** Kanat hizası — pencere koltuğunda manzara kapalı, türbülans az. */
  wingRows: [number, number];
  /** Lavabo bulunan sıralar (kabinin arkası ve bölme geçişleri). */
  lavatoryRows: number[];
}

const NARROW = ["A", "B", "C", null, "D", "E", "F"];
const NARROW_BIZ = ["A", null, "C", null, "D", null, "F"]; // 2-2, boş orta koltuk
const WIDE_242 = ["A", "B", null, "C", "D", "E", "F", null, "G", "H"];
const WIDE_334 = ["A", "B", "C", null, "D", "E", "F", "G", null, "H", "J", "K"];
const WIDE_333 = ["A", "B", "C", null, "D", "E", "F", null, "G", "H", "J"];
const WIDE_BIZ_122 = ["A", null, null, "D", "E", null, null, "K"]; // ters herringbone 1-2-1

export const AIRCRAFT_LAYOUTS: AircraftLayout[] = [
  {
    type: "Boeing 737-800", short: "B738",
    zones: [
      { cabin: "Business", fromRow: 1, toRow: 3, columns: NARROW_BIZ },
      { cabin: "Economy", fromRow: 4, toRow: 30, columns: NARROW },
    ],
    exitRows: [15, 16], bulkheadRows: [1, 4], wingRows: [12, 18], lavatoryRows: [3, 30],
  },
  {
    type: "Airbus A321neo", short: "A21N",
    zones: [
      { cabin: "Business", fromRow: 1, toRow: 4, columns: NARROW_BIZ },
      { cabin: "Economy", fromRow: 5, toRow: 33, columns: NARROW },
    ],
    exitRows: [16, 17], bulkheadRows: [1, 5], wingRows: [13, 20], lavatoryRows: [4, 33],
  },
  {
    type: "Airbus A330-300", short: "A333",
    zones: [
      { cabin: "Business", fromRow: 1, toRow: 7, columns: WIDE_242 },
      { cabin: "Economy", fromRow: 8, toRow: 45, columns: WIDE_242 },
    ],
    exitRows: [8, 26, 27], bulkheadRows: [1, 8], wingRows: [20, 30], lavatoryRows: [7, 26, 45],
  },
  {
    type: "Boeing 777-300ER", short: "B77W",
    zones: [
      { cabin: "Business", fromRow: 1, toRow: 8, columns: WIDE_BIZ_122 },
      { cabin: "Economy", fromRow: 9, toRow: 52, columns: WIDE_334 },
    ],
    exitRows: [9, 30, 31], bulkheadRows: [1, 9], wingRows: [22, 34], lavatoryRows: [8, 30, 52],
  },
  {
    type: "Airbus A350-900", short: "A359",
    zones: [
      { cabin: "Business", fromRow: 1, toRow: 8, columns: WIDE_BIZ_122 },
      { cabin: "Premium", fromRow: 9, toRow: 12, columns: WIDE_333 },
      { cabin: "Economy", fromRow: 13, toRow: 47, columns: WIDE_333 },
    ],
    exitRows: [13, 28, 29], bulkheadRows: [1, 9, 13], wingRows: [20, 32], lavatoryRows: [8, 12, 28, 47],
  },
];

/** Bilinmeyen tip için makul dar gövde varsayılanı. */
const FALLBACK = AIRCRAFT_LAYOUTS[0];

export function layoutFor(aircraftType: string): AircraftLayout {
  return AIRCRAFT_LAYOUTS.find((l) => l.type === aircraftType) ?? FALLBACK;
}

/** Sıranın hangi kabinde olduğu — düzenden, sabit sayıdan değil. */
export function zoneOfRow(layout: AircraftLayout, row: number): CabinZone | undefined {
  return layout.zones.find((z) => row >= z.fromRow && row <= z.toRow);
}

/** Toplam koltuk — kapasite BUNDAN türetilir, elle yazılmaz. */
export function seatCount(layout: AircraftLayout): number {
  return layout.zones.reduce(
    (n, z) => n + (z.toRow - z.fromRow + 1) * z.columns.filter(Boolean).length,
    0,
  );
}

/** Kabin bazında koltuk sayısı — "C20 / W24 / Y280" yapılandırma metni için. */
export function cabinCounts(layout: AircraftLayout): Record<CabinClass, number> {
  const out: Record<CabinClass, number> = { Business: 0, Premium: 0, Economy: 0 };
  for (const z of layout.zones) out[z.cabin] += (z.toRow - z.fromRow + 1) * z.columns.filter(Boolean).length;
  return out;
}

/** "C20 / W24 / Y280" — yapılandırma metni de düzenden üretilir. */
export function configString(layout: AircraftLayout): string {
  const c = cabinCounts(layout);
  return [c.Business && `C${c.Business}`, c.Premium && `W${c.Premium}`, c.Economy && `Y${c.Economy}`]
    .filter(Boolean).join(" / ");
}

export const lastRow = (layout: AircraftLayout): number =>
  layout.zones.reduce((m, z) => Math.max(m, z.toRow), 0);

/** Koltuğun konumu — pencere / koridor / orta. Kural motoru ve arayüz okur. */
export function seatPosition(columns: (string | null)[], col: string): "window" | "aisle" | "middle" {
  const i = columns.indexOf(col);
  if (i < 0) return "middle";
  const isEdge = i === 0 || i === columns.length - 1;
  if (isEdge) return "window";
  const leftGap = columns[i - 1] === null;
  const rightGap = columns[i + 1] === null;
  return leftGap || rightGap ? "aisle" : "middle";
}
