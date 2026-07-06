package com.troya.application.ticket

import com.troya.application.port.IdempotencyStore
import com.troya.application.port.Repository
import com.troya.application.port.TicketNumberGenerator
import com.troya.domain.common.Money
import com.troya.domain.ticket.IssuedCoupon
import com.troya.domain.ticket.Ticket
import com.troya.domain.ticket.TicketNumber
import java.math.BigDecimal

/**
 * F3 komutları — Changes to Tickets (Handbook Ch 12/15) + Void (1.1.9).
 * Ortak kurallar: her komut idempotency key taşır (tekrar = aynı sonuç, yan etki yok);
 * invariant'lar aggregate'te (FSM + kurallar), burada yalnızca orkestrasyon.
 */
class TicketNotFoundException(ticketNumber: String) : RuntimeException("Bilet bulunamadı: $ticketNumber")

// ---------- Void ----------

data class VoidTicketCommand(val ticketNumber: String, val reason: String?, val idempotencyKey: String)

class VoidTicketHandler(
    private val repository: Repository<Ticket, TicketNumber>,
    private val idempotency: IdempotencyStore,
) {
    /** Döner: void edilen bilet no. Aynı key tekrar gelirse aynı sonuç, yeni event yok. */
    fun handle(command: VoidTicketCommand): String {
        idempotency.recall(command.idempotencyKey)?.let { return it }
        val ticket = repository.load(TicketNumber(command.ticketNumber))
            ?: throw TicketNotFoundException(command.ticketNumber)
        ticket.void(command.reason)
        repository.save(ticket)
        idempotency.remember(command.idempotencyKey, command.ticketNumber)
        return command.ticketNumber
    }
}

// ---------- Refund ----------

data class RefundTicketCommand(
    val ticketNumber: String,
    val couponSeqs: List<Int>,
    val refundAmount: String,
    val refundCurrency: String,
    val waiver: String?,
    val idempotencyKey: String,
)

class RefundTicketHandler(
    private val repository: Repository<Ticket, TicketNumber>,
    private val idempotency: IdempotencyStore,
) {
    fun handle(command: RefundTicketCommand): String {
        idempotency.recall(command.idempotencyKey)?.let { return it }
        val ticket = repository.load(TicketNumber(command.ticketNumber))
            ?: throw TicketNotFoundException(command.ticketNumber)
        ticket.refund(command.couponSeqs, Money.of(BigDecimal(command.refundAmount), command.refundCurrency.uppercase()), command.waiver)
        repository.save(ticket)
        idempotency.remember(command.idempotencyKey, command.ticketNumber)
        return command.ticketNumber
    }
}

// ---------- Exchange / Reissue ----------

data class ExchangeTicketCommand(
    val oldTicketNumber: String,
    val newCoupons: List<IssueCouponInput>,
    /** ADC (Additional Collection) — ek tahsilat; negatif = residual. Eski toplamla aynı para birimi. */
    val adcAmount: String,
    val adcCurrency: String,
    val idempotencyKey: String,
)

data class ExchangeTicketResult(val oldTicketNumber: String, val newTicketNumber: String)

class ExchangeTicketHandler(
    private val repository: Repository<Ticket, TicketNumber>,
    private val numbers: TicketNumberGenerator,
    private val idempotency: IdempotencyStore,
) {
    /**
     * Eski biletin açık kuponları O→E; yeni bilet "Issued in Exchange For" linkage'ıyla kesilir.
     * Yeni toplam = eski toplam + ADC (aynı para birimi zorunlu — Money.plus zorlar).
     * İdempotency ref = yeni bilet no (tekrar çağrıda aynı çift döner, ikinci bilet kesilmez).
     */
    fun handle(command: ExchangeTicketCommand): ExchangeTicketResult {
        idempotency.recall(command.idempotencyKey)?.let {
            return ExchangeTicketResult(command.oldTicketNumber, it)
        }
        require(command.newCoupons.isNotEmpty()) { "Exchange için en az bir yeni segment gerekli (Ch 12)." }
        val old = repository.load(TicketNumber(command.oldTicketNumber))
            ?: throw TicketNotFoundException(command.oldTicketNumber)

        val newNumber = numbers.next()
        old.exchange(newNumber)
        val newTotal = old.fareTotal + Money.of(BigDecimal(command.adcAmount), command.adcCurrency.uppercase())
        val newTicket = Ticket.issue(
            ticketNumber = newNumber,
            passenger = old.passenger,
            validatingCarrier = old.validatingCarrier,
            pnr = old.pnr,
            coupons = command.newCoupons.map {
                IssuedCoupon(
                    it.origin.uppercase(),
                    it.destination.uppercase(),
                    it.marketingCarrier.uppercase(),
                    it.flightNumber.uppercase(),
                    it.rbd.uppercase(),
                    it.fareBasis,
                    it.departure,
                )
            },
            fareTotal = newTotal,
            issuedInExchangeFor = old.id.value,
        )
        // Not: iki aggregate tek DB transaction'ında yazılmalı — adapter save'leri aynı
        // transaction'a katılır (Spring @Transactional, api katmanında). Outbox F6'da.
        repository.save(old)
        repository.save(newTicket)
        idempotency.remember(command.idempotencyKey, newNumber.value)
        return ExchangeTicketResult(command.oldTicketNumber, newNumber.value)
    }
}
