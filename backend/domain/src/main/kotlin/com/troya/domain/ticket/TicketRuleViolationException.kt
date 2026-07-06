package com.troya.domain.ticket

/**
 * Bilet iş kuralı ihlali (Handbook invariant'ları) — örn. void için tüm kuponlar O değil,
 * final statüdeki kupona işlem, exchange için açık kupon yok. API katmanı 422'ye eşler.
 */
class TicketRuleViolationException(message: String) : RuntimeException(message)
