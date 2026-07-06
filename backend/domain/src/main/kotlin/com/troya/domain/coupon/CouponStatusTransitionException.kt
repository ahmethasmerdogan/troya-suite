package com.troya.domain.coupon

/** İzin verilmeyen kupon statü geçişi. Final statü değiştirilemez (terminal). */
class CouponStatusTransitionException(
    val from: CouponStatus,
    val to: CouponStatus,
) : RuntimeException(
    if (from.isFinal) {
        "Kupon ${from.code} final statüde — değiştirilemez (→ ${to.code})."
    } else {
        "Geçersiz kupon geçişi: ${from.code} → ${to.code}."
    },
)
