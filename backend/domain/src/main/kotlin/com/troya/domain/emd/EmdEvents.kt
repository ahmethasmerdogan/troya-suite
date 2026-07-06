package com.troya.domain.emd

import com.troya.domain.common.DomainEvent
import java.time.Instant

/** EMD domain event'leri (F5, Handbook Ch 5). Ticket event'leriyle aynı store'a jsonb yazılır. */
sealed interface EmdEvent : DomainEvent

/** EMD kesildi — kupon O başlar. EMD-A ET kuponuna bağlı; EMD-S "in connection with" opsiyonel. */
data class EmdIssued(
    val emdNumber: String,
    val emdType: String,
    val rfisc: String,
    val description: String?,
    val passengerName: String,
    val validatingCarrier: String,
    val associatedTicket: String?,
    val associatedCouponSeq: Int?,
    val amount: String,
    val currency: String,
    override val occurredAt: Instant = Instant.now(),
) : EmdEvent

/** EMD iade edildi — O→R. */
data class EmdRefunded(
    val emdNumber: String,
    override val occurredAt: Instant = Instant.now(),
) : EmdEvent

/** EMD void edildi — O→V. */
data class EmdVoided(
    val emdNumber: String,
    val reason: String?,
    override val occurredAt: Instant = Instant.now(),
) : EmdEvent
