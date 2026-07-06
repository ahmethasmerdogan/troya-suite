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

export const INTERIM_STATUSES: CouponStatus[] = ["O", "A", "C", "L", "I", "S", "U", "N", "Y"];
export const FINAL_STATUSES: CouponStatus[] = ["F", "E", "G", "R", "V", "P", "X", "Z"];

export function isFinal(status: CouponStatus): boolean {
  return STATUS_META[status].final;
}
