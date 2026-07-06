package com.troya.domain.common

import java.time.Instant

/**
 * Domain event — immutable, append-only (Event Sourcing, ARCHITECTURE §2).
 * "ET file = gerçekleşen tüm aksiyonların tarihsel kaydı" (Handbook'un kendi tanımı).
 * Somut event'ler Faz 1'de: TicketIssued, CouponAdded, ControlGranted, CouponFlown…
 */
interface DomainEvent {
    val occurredAt: Instant
}
