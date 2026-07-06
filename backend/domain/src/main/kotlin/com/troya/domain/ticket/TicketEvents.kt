package com.troya.domain.ticket

import com.troya.domain.common.DomainEvent
import java.time.Instant

/**
 * Ticket domain event'leri (Event Sourcing, ARCHITECTURE §2).
 * F1: TicketIssued · F3: TicketVoided / CouponsRefunded / CouponsExchanged.
 * Event'ler serileştirme dostu primitive alanlar taşır (value object'ler aggregate.apply'da kurulur);
 * jsonb payload olarak event store'a yazılır.
 */
sealed interface TicketEvent : DomainEvent

/** Event payload'ında kupon (issue anındaki segment bilgisi). F4: NVB/NVA (2.8) + bagaj (2.9). */
data class IssuedCoupon(
    val origin: String,
    val destination: String,
    val marketingCarrier: String,
    val flightNumber: String,
    val rbd: String,
    val fareBasis: String,
    val departure: String,
    val notValidBefore: String? = null,
    val notValidAfter: String? = null,
    val baggage: String? = null,
)

/** Bilet kesildi — tüm kuponlar O (Open For Use) başlar (Handbook 1.1.4 / Ch 2). */
data class TicketIssued(
    val ticketNumber: String,
    val surname: String,
    val givenName: String,
    val title: String?,
    val validatingCarrier: String,
    val pnr: String?,
    val coupons: List<IssuedCoupon>,
    val fareAmount: String,
    val fareCurrency: String,
    /** F4 — Ch 2 girdileri: fare breakdown + FOP + FOID + tour code + endorsement (opsiyonel). */
    val entries: TicketEntries? = null,
    /** Exchange sonucu kesildiyse eski bilet no ("Issued in Exchange For", Ch 12). */
    val issuedInExchangeFor: String? = null,
    override val occurredAt: Instant = Instant.now(),
) : TicketEvent

/** Bilet void edildi — TÜM kuponlar O→V (invariant: hepsi O olmalı; Handbook 1.1.9). */
data class TicketVoided(
    val ticketNumber: String,
    val reason: String?,
    override val occurredAt: Instant = Instant.now(),
) : TicketEvent

/** Seçili açık kuponlar iade edildi — O→R (Handbook Ch 15). Waiver: vefat/hastalık (13.9/15.4). */
data class CouponsRefunded(
    val ticketNumber: String,
    val couponSeqs: List<Int>,
    val refundAmount: String,
    val refundCurrency: String,
    val waiver: String?,
    override val occurredAt: Instant = Instant.now(),
) : TicketEvent

/** Açık kuponlar yeni bilete değiştirildi — O→E + linkage (Handbook Ch 12, "Issued in Exchange For"). */
data class CouponsExchanged(
    val ticketNumber: String,
    val couponSeqs: List<Int>,
    val newTicketNumber: String,
    override val occurredAt: Instant = Instant.now(),
) : TicketEvent
