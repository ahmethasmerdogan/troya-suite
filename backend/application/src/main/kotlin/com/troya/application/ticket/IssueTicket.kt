package com.troya.application.ticket

import com.troya.application.port.IdempotencyStore
import com.troya.application.port.Repository
import com.troya.application.port.TicketNumberGenerator
import com.troya.domain.common.CarrierCode
import com.troya.domain.common.Money
import com.troya.domain.ticket.IssuedCoupon
import com.troya.domain.ticket.Passenger
import com.troya.domain.ticket.Ticket
import com.troya.domain.ticket.TicketEntries
import com.troya.domain.ticket.TicketNumber
import java.math.BigDecimal

/** IssueTicket komutu (uygulama katmanı use-case). F4: NVB/NVA/bagaj + Ch 2 girdileri. */
data class IssueCouponInput(
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

data class IssueTicketCommand(
    val surname: String,
    val givenName: String,
    val title: String?,
    val validatingCarrier: String,
    val pnr: String?,
    val coupons: List<IssueCouponInput>,
    val fareAmount: String,
    val fareCurrency: String,
    val idempotencyKey: String,
    val entries: TicketEntries? = null,
)

data class IssueTicketResult(val ticketNumber: String)

/**
 * IssueTicket handler — aggregate'i kesip event store'a yazar.
 * Idempotency (ARCHITECTURE §6): aynı key tekrar gelirse aynı bilet döner, yeni kesim yok.
 */
class IssueTicketHandler(
    private val repository: Repository<Ticket, TicketNumber>,
    private val numbers: TicketNumberGenerator,
    private val idempotency: IdempotencyStore,
) {
    fun handle(command: IssueTicketCommand): IssueTicketResult {
        idempotency.recall(command.idempotencyKey)?.let { return IssueTicketResult(it) }
        require(command.coupons.isNotEmpty()) { "Bilet için en az bir kupon gerekli." }

        val ticketNumber = numbers.next()
        val ticket = Ticket.issue(
            ticketNumber = ticketNumber,
            passenger = Passenger(command.surname.uppercase(), command.givenName.uppercase(), command.title),
            validatingCarrier = CarrierCode(command.validatingCarrier.uppercase()),
            pnr = command.pnr,
            coupons = command.coupons.map {
                IssuedCoupon(
                    it.origin.uppercase(),
                    it.destination.uppercase(),
                    it.marketingCarrier.uppercase(),
                    it.flightNumber.uppercase(),
                    it.rbd.uppercase(),
                    it.fareBasis,
                    it.departure,
                    notValidBefore = it.notValidBefore,
                    notValidAfter = it.notValidAfter,
                    baggage = it.baggage,
                )
            },
            fareTotal = Money.of(BigDecimal(command.fareAmount), command.fareCurrency.uppercase()),
            entries = command.entries,
        )
        repository.save(ticket)
        idempotency.remember(command.idempotencyKey, ticketNumber.value)
        return IssueTicketResult(ticketNumber.value)
    }
}
