package com.troya.domain.coupon

/**
 * Coupon Status Indicator — IATA Handbook 1.1.4 (resmî 17 kod) + explicit FSM.
 * Not: "T (Paper Ticket)" resmî 1.1.4 listelerinde yoktur (yalnızca O'nun
 * açıklamasında anılır); kâğıda dönüşümü PRINTED (P) ve PRINT_EXCHANGE (X) karşılar.
 * Sistemin kalbi (ARCHITECTURE §4). İzin verilen geçişler kod + exhaustive test ile sabit;
 * izin verilmeyen geçiş [CouponStatusTransitionException] fırlatır — asla sessiz.
 *
 * İnvariant'lar:
 *  (1) final statüye geçen kupon değişmez (terminal);
 *  (2) işlem için statü uygun olmalı (void/exchange/refund → kaynak O);
 *  (3) kuponlar sırayla honor edilir (aggregate düzeyinde).
 *
 * Frontend aynası: nw_THYProject/frontend/src/domain/couponStatusMachine.ts — aynı geçiş tablosu.
 * Refund-Cancel (R→O, aynı raporlama dönemi) bilinçli olarak tabloda DEĞİLDİR: R terminal
 * kalır; geri dönüş yalnız o komutun kendi kapısından yapılır (frontend `applyRefundCancel`).
 */
enum class CouponStatus(val code: Char, val isFinal: Boolean) {
    // ----- interim (kupon hayatta) -----
    OPEN_FOR_USE('O', false),
    AIRPORT_CONTROL('A', false),
    CHECKED_IN('C', false),
    LIFTED('L', false),
    IRREGULAR_OPS('I', false),
    SUSPENDED('S', false),
    UNAVAILABLE('U', false),
    NOTIFICATION('N', false),
    REFUND_TFC('Y', false),

    // ----- final (terminal) -----
    FLOWN('F', true),
    EXCHANGED('E', true),
    EXCHANGED_FIM('G', true),
    REFUNDED('R', true),
    VOID('V', true),
    PRINTED('P', true),
    PRINT_EXCHANGE('X', true),
    CLOSED('Z', true),
    ;

    /** Bu statüden izin verilen hedef statüler. */
    fun allowedTransitions(): Set<CouponStatus> = TRANSITIONS[this] ?: emptySet()

    fun canTransitionTo(target: CouponStatus): Boolean = target in allowedTransitions()

    /** Geçişi doğrula; geçersizse exception. State machine'in tek kapısı. */
    fun transitionTo(target: CouponStatus): CouponStatus {
        if (!canTransitionTo(target)) throw CouponStatusTransitionException(this, target)
        return target
    }

    companion object {
        fun fromCode(code: Char): CouponStatus = entries.firstOrNull { it.code == code }
            ?: throw IllegalArgumentException("Bilinmeyen coupon status kodu: $code")

        val INTERIM: Set<CouponStatus> = entries.filterNot { it.isFinal }.toSet()
        val FINAL: Set<CouponStatus> = entries.filter { it.isFinal }.toSet()

        // İzin verilen geçişler. Final statülerin çıkışı yok (terminal).
        private val TRANSITIONS: Map<CouponStatus, Set<CouponStatus>> = mapOf(
            // Y (REFUND_TFC): yalnız-vergi iadesi işareti (1.3.5) — O'dan girilir.
            // X (PRINT_EXCHANGE): kağıt stoğun numarası ET'den farklıysa (1.3.4) — O'dan girilir.
            OPEN_FOR_USE to setOf(
                AIRPORT_CONTROL, CHECKED_IN, SUSPENDED, UNAVAILABLE, NOTIFICATION, IRREGULAR_OPS,
                VOID, EXCHANGED, REFUNDED, FLOWN, PRINTED, PRINT_EXCHANGE, REFUND_TFC,
            ),
            // İade uygunluğu O/A/Y (1.3.5) → A'dan R var; print-to-paper YALNIZ O'dan (1.3.3) → A'dan P YOK.
            AIRPORT_CONTROL to setOf(CHECKED_IN, LIFTED, IRREGULAR_OPS, SUSPENDED, FLOWN, REFUNDED),
            CHECKED_IN to setOf(LIFTED, IRREGULAR_OPS, AIRPORT_CONTROL),
            LIFTED to setOf(FLOWN, IRREGULAR_OPS),
            IRREGULAR_OPS to setOf(OPEN_FOR_USE, AIRPORT_CONTROL, EXCHANGED_FIM, FLOWN),
            // Askıdaki kupon doğrudan iade edilemez — önce O'ya döner (1.3.5).
            SUSPENDED to setOf(OPEN_FOR_USE, VOID),
            UNAVAILABLE to setOf(OPEN_FOR_USE),
            NOTIFICATION to setOf(OPEN_FOR_USE),
            REFUND_TFC to setOf(REFUNDED),
            // final → çıkış yok
        )
    }
}
