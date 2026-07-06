package com.troya.application.emd

import com.troya.application.port.IdempotencyStore
import com.troya.application.port.Repository
import com.troya.application.port.TicketNumberGenerator
import com.troya.application.ticket.TicketNotFoundException
import com.troya.domain.common.CarrierCode
import com.troya.domain.common.Money
import com.troya.domain.emd.Emd
import com.troya.domain.emd.EmdType
import com.troya.domain.emd.IssueEmdSpec
import com.troya.domain.ticket.Ticket
import com.troya.domain.ticket.TicketNumber
import com.troya.domain.ticket.TicketRuleViolationException
import java.math.BigDecimal

/**
 * F5 — EMD use-case'leri (Handbook Ch 5). Para/statü komutları idempotent.
 * EMD-A kesiminde bağlanılan ET ve kupon seq'inin varlığı doğrulanır (cross-aggregate kontrol).
 */
data class IssueEmdCommand(
    val type: String,
    val rfisc: String,
    val description: String?,
    val associatedTicket: String?,
    val associatedCouponSeq: Int?,
    val amount: String,
    val currency: String,
    val idempotencyKey: String,
)

data class IssueEmdResult(val emdNumber: String)

class IssueEmdHandler(
    private val emdRepository: Repository<Emd, TicketNumber>,
    private val ticketRepository: Repository<Ticket, TicketNumber>,
    private val numbers: TicketNumberGenerator,
    private val idempotency: IdempotencyStore,
) {
    fun handle(command: IssueEmdCommand): IssueEmdResult {
        idempotency.recall(command.idempotencyKey)?.let { return IssueEmdResult(it) }

        val ticket = command.associatedTicket?.let {
            ticketRepository.load(TicketNumber(it)) ?: throw TicketNotFoundException(it)
        }
        val type = EmdType.valueOf(command.type.uppercase())
        if (ticket != null && command.associatedCouponSeq != null && ticket.coupons.none { it.seq == command.associatedCouponSeq }) {
            throw TicketRuleViolationException("Kupon ${command.associatedCouponSeq} bilette yok — EMD bağlanamaz (Ch 5).")
        }

        val number = numbers.next()
        val emd = Emd.issue(
            IssueEmdSpec(
                number = number,
                type = type,
                rfisc = command.rfisc,
                description = command.description,
                passengerName = ticket?.let { "${it.passenger.surname}/${it.passenger.givenName}" } ?: "STANDALONE",
                validatingCarrier = ticket?.validatingCarrier ?: CarrierCode("TK"),
                associatedTicket = command.associatedTicket,
                associatedCouponSeq = command.associatedCouponSeq,
                amount = Money.of(BigDecimal(command.amount), command.currency.uppercase()),
            ),
        )
        emdRepository.save(emd)
        idempotency.remember(command.idempotencyKey, number.value)
        return IssueEmdResult(number.value)
    }
}

class RefundEmdHandler(
    private val emdRepository: Repository<Emd, TicketNumber>,
    private val idempotency: IdempotencyStore,
) {
    fun handle(emdNumber: String, idempotencyKey: String): String {
        idempotency.recall(idempotencyKey)?.let { return it }
        val emd = emdRepository.load(TicketNumber(emdNumber)) ?: throw TicketNotFoundException(emdNumber)
        emd.refund()
        emdRepository.save(emd)
        idempotency.remember(idempotencyKey, emdNumber)
        return emdNumber
    }
}

class VoidEmdHandler(
    private val emdRepository: Repository<Emd, TicketNumber>,
    private val idempotency: IdempotencyStore,
) {
    fun handle(emdNumber: String, reason: String?, idempotencyKey: String): String {
        idempotency.recall(idempotencyKey)?.let { return it }
        val emd = emdRepository.load(TicketNumber(emdNumber)) ?: throw TicketNotFoundException(emdNumber)
        emd.void(reason)
        emdRepository.save(emd)
        idempotency.remember(idempotencyKey, emdNumber)
        return emdNumber
    }
}

/** Okuma tarafı DTO + port (CQRS). */
data class EmdView(
    val emdNumber: String,
    val type: String,
    val rfisc: String,
    val description: String?,
    val passengerName: String,
    val validatingCarrier: String,
    val associatedTicket: String?,
    val associatedCouponSeq: Int?,
    val amount: String,
    val currency: String,
    val status: String,
    val issuedAt: String,
)

interface EmdQueries {
    fun byNumber(emdNumber: String): EmdView?

    fun byTicket(ticketNumber: String): List<EmdView>

    fun list(): List<EmdView>
}
