package com.troya.api

import com.troya.domain.coupon.CouponStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

/**
 * Faz 0 health/smoke. Faz 1'de TicketController gelir:
 * POST /tickets, GET /tickets/{n}, /coupons, /history.
 */
@RestController
class HealthController {
    @GetMapping("/health")
    fun health(): Map<String, Any> = mapOf("status" to "UP", "service" to "troya-eticket")

    /** Coupon status sözlüğü — frontend de aynı mapping'i kullanır (§9.1). */
    @GetMapping("/meta/coupon-statuses")
    fun couponStatuses(): List<Map<String, Any>> = CouponStatus.entries.map {
        mapOf("code" to it.code.toString(), "name" to it.name, "final" to it.isFinal)
    }
}
