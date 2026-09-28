import type { CouponStatus } from "./types";
import { isFinal } from "./couponStatus";
import { LocalizedError } from "./errors";

// Coupon Status FSM — IATA Handbook 1.1.4 / ROADMAP Faz 1 / ARCHITECTURE §4.
// Bu, sunum tarafı aynası; OTORİTE backend'dir (CLAUDE.md §8). Backend Kotlin
// tarafında aynı geçişler authoritative olarak kurulur (CouponStatus.kt).
//
// İnvariant'lar:
//  (1) Final statüye geçen kupon değişmez (terminal).
//  (2) İşlem için statü uygun olmalı (örn. void/exchange/refund → kaynak `O`).
//  (3) Kuponlar sırayla honor edilir (bu kural aggregate düzeyinde; burada tek kupon).

const ALLOWED: Record<CouponStatus, CouponStatus[]> = {
  // interim
  // X: Print Exchange (1.3.4) — kağıt stoğun numarası ET'den farklı olduğunda;
  // kupon "open for use" olmalı, sonuç final X.
  O: ["A", "C", "S", "U", "N", "I", "V", "E", "R", "F", "P", "X", "Y"], // Y: yalnız-TFC iadesi işareti (1.3.5)
  A: ["C", "L", "I", "S", "F", "R"], // R: iade uygunluğu O/A/Y (1.3.5); P KALDIRILDI — print yalnız O'dan (1.3.3)
  C: ["L", "I", "A"],
  L: ["F", "I"],
  I: ["O", "A", "G", "F"],
  S: ["O", "V"], // R KALDIRILDI — askıdaki kupon önce O'ya döner (iade uygunluğu O/A/Y, 1.3.5)
  U: ["O"],
  N: ["O"],
  Y: ["R"],
  // final (terminal) — çıkış yok
  F: [],
  E: [],
  G: [],
  R: [],
  V: [],
  P: [],
  X: [],
  Z: [],
};

export function allowedTransitions(from: CouponStatus): CouponStatus[] {
  return ALLOWED[from];
}

export function canTransition(from: CouponStatus, to: CouponStatus): boolean {
  return ALLOWED[from].includes(to);
}

export class InvalidTransitionError extends LocalizedError {
  constructor(public from: CouponStatus, public to: CouponStatus) {
    super(
      isFinal(from)
        ? `Kupon ${from} final statüde — değiştirilemez (→ ${to}).`
        : `Geçersiz kupon geçişi: ${from} → ${to}.`,
      isFinal(from)
        ? `Coupon ${from} is in a final status — it cannot be changed (→ ${to}).`
        : `Invalid coupon transition: ${from} → ${to}.`,
    );
    this.name = "InvalidTransitionError";
  }
}

/** Geçişi uygula; geçersizse exception fırlat (asla sessiz). */
export function applyTransition(from: CouponStatus, to: CouponStatus): CouponStatus {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
  return to;
}

/**
 * Refund-Cancel (Handbook 12.13.2 · SAC bölümü): acente bileti iade ettikten
 * sonra AYNI RAPORLAMA DÖNEMİ içinde iadeyi geri alırsa kupon "open for use"a
 * döner ve yeni bir SAC üretilir.
 *
 * Bu geçiş bilinçli olarak ALLOWED tablosunda DEĞİLDİR: `R` terminal kalmalı,
 * aksi hâlde her yerden R→O yapılabilirdi. Tek kapı budur ve yalnız
 * `refundCancel` komutu çağırır.
 */
export function applyRefundCancel(from: CouponStatus): CouponStatus {
  if (from !== "R") throw new InvalidTransitionError(from, "O");
  return "O";
}

/** İade edilebilir kupon statüleri (1.3.5). */
export function isRefundable(status: CouponStatus): boolean {
  return status === "O" || status === "A" || status === "Y";
}
