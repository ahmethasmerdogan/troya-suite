import type { CouponStatus } from "./types";

export type PillVariant = "success" | "info" | "warning" | "danger" | "neutral";

interface StatusMeta {
  label: string; // İngilizce IATA anlamı
  short: string; // pill etiketi (TR/kısa)
  variant: PillVariant;
  final: boolean; // terminal statü → kilit ikonu
}

/**
 * Coupon Status → Pill mapping. Kaynak: DESIGN_SYSTEM.md §9.1 (FINAL).
 * Resmî 17 kod (Handbook 1.1.4). Final statüler (E F G R V P X Z) terminal —
 * değişmez (ARCHITECTURE §4).
 */
export const STATUS_META: Record<CouponStatus, StatusMeta> = {
  O: { label: "Open For Use", short: "Open", variant: "info", final: false },
  A: { label: "Airport Control", short: "Airport Ctrl", variant: "info", final: false },
  C: { label: "Checked-In", short: "Checked-In", variant: "info", final: false },
  L: { label: "Lifted / Boarded", short: "Lifted", variant: "info", final: false },
  I: { label: "Irregular Operations", short: "IRROP", variant: "warning", final: false },
  S: { label: "Suspended", short: "Suspended", variant: "warning", final: false },
  U: { label: "Unavailable", short: "Unavailable", variant: "warning", final: false },
  Y: { label: "Refund TFC", short: "Refund TFC", variant: "warning", final: false },
  N: { label: "Notification", short: "Notification", variant: "neutral", final: false },
  F: { label: "Flown / Used", short: "Flown", variant: "success", final: true },
  E: { label: "Exchanged / Reissued", short: "Exchanged", variant: "neutral", final: true },
  G: { label: "Exchanged / FIM", short: "Exch (FIM)", variant: "neutral", final: true },
  P: { label: "Printed", short: "Printed", variant: "neutral", final: true },
  X: { label: "Print Exchange", short: "Print Exch", variant: "neutral", final: true },
  R: { label: "Refunded", short: "Refunded", variant: "danger", final: true },
  V: { label: "Void", short: "Void", variant: "danger", final: true },
  Z: { label: "Closed", short: "Closed", variant: "danger", final: true },
};

// Grafik renkleri — statü BAŞINA ayırt edilebilir (pill variant'ları çok statüyü tek renge
// düşürüyordu). THY kimliği: yalnız kırmızı-rampası + yeşil/amber/gri (MAVİSİZ).
// Aktif/açık statüler parlak→koyu kırmızı; sonlanmışlar bordo; istisnalar amber; tamamlanan yeşil.
export const STATUS_CHART_COLOR: Record<CouponStatus, string> = {
  O: "#e8484a", // Open — parlak kırmızı
  A: "#f28b8c", // Airport Control — açık kırmızı
  C: "#c70a0c", // Checked-In — THY kırmızı
  L: "#9c1f1f", // Lifted — koyu kırmızı
  I: "#f79009", // IRROP — amber
  S: "#dc6803", // Suspended — koyu amber
  U: "#fdb022", // Unavailable — açık amber
  Y: "#fec84b", // Refund TFC — sarı
  N: "#98a2b3", // Notification — gri
  F: "#17b26a", // Flown — yeşil (tamamlandı)
  E: "#667085", // Exchanged — slate gri
  G: "#8b95a5", // Exch/FIM — gri
  P: "#b0b6bf", // Printed — açık gri
  X: "#7a828f", // Print Exch — gri
  R: "#7a0608", // Refunded — bordo
  V: "#530507", // Void — koyu bordo
  Z: "#3d0405", // Closed — en koyu bordo
};

export const INTERIM_STATUSES: CouponStatus[] = ["O", "A", "C", "L", "I", "S", "U", "N", "Y"];
export const FINAL_STATUSES: CouponStatus[] = ["F", "E", "G", "R", "V", "P", "X", "Z"];

export function isFinal(status: CouponStatus): boolean {
  return STATUS_META[status].final;
}
