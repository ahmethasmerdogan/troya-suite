package com.troya.api

import com.troya.application.port.IdempotencyStore
import com.troya.application.port.Repository
import com.troya.application.port.TicketNumberGenerator
import com.troya.application.port.TicketQueries
import com.troya.application.ticket.ExchangeTicketCommand
import com.troya.application.ticket.ExchangeTicketHandler
import com.troya.application.ticket.IssueCouponInput
import com.troya.application.ticket.IssueTicketCommand
import com.troya.application.ticket.IssueTicketHandler
import com.troya.application.ticket.RefundTicketCommand
import com.troya.application.ticket.RefundTicketHandler
import com.troya.application.ticket.VoidTicketCommand
import com.troya.application.ticket.VoidTicketHandler
import com.troya.domain.ticket.Ticket
import com.troya.domain.ticket.TicketEntries
import com.troya.domain.ticket.TicketNumber
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/** Use-case handler'larını portlardan kur (application Spring bilmez). */
@Configuration
class TicketConfig {
    @Bean
    fun issueTicketHandler(repository: Repository<Ticket, TicketNumber>, numbers: TicketNumberGenerator, idempotency: IdempotencyStore) =
        IssueTicketHandler(repository, numbers, idempotency)

    @Bean
    fun voidTicketHandler(repository: Repository<Ticket, TicketNumber>, idempotency: IdempotencyStore) = VoidTicketHandler(repository, idempotency)

    @Bean
    fun refundTicketHandler(repository: Repository<Ticket, TicketNumber>, idempotency: IdempotencyStore) = RefundTicketHandler(repository, idempotency)

    @Bean
    fun exchangeTicketHandler(repository: Repository<Ticket, TicketNumber>, numbers: TicketNumberGenerator, idempotency: IdempotencyStore) =
        ExchangeTicketHandler(repository, numbers, idempotency)
}

data class IssueCouponRequest(
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

data class IssueTicketRequest(
    val surname: String,
    val givenName: String,
    val title: String?,
    val validatingCarrier: String,
    val pnr: String?,
    val coupons: List<IssueCouponRequest>,
    val fareAmount: String,
    val fareCurrency: String,
    val idempotencyKey: String,
    /** F4 — Ch 2 girdileri: fare breakdown (base+ΣTFC==total zorlanır) + FOP/FOID/tourCode/endorsement. */
    val entries: TicketEntries? = null,
) {
    fun toCommand() = IssueTicketCommand(
        surname, givenName, title, validatingCarrier, pnr,
        coupons.map { it.toInput() },
        fareAmount, fareCurrency, idempotencyKey, entries,
    )
}

private fun IssueCouponRequest.toInput() = IssueCouponInput(
    origin, destination, marketingCarrier, flightNumber, rbd, fareBasis, departure,
    notValidBefore, notValidAfter, baggage,
)

// ---------- F3 istekleri (contracts/openapi.yaml: VoidInput/RefundInput/ExchangeInput) ----------

data class MoneyDto(val amount: String, val currency: String)

data class VoidRequest(val reason: String?, val idempotencyKey: String)

data class RefundRequest(
    val couponSeqs: List<Int>,
    val refundAmount: MoneyDto,
    val waiver: String?,
    val idempotencyKey: String,
)

data class ExchangeRequest(
    val newSegments: List<IssueCouponRequest>,
    val adc: MoneyDto,
    val idempotencyKey: String,
)

/** REST — F1: POST/GET · F2: search+receipt (read model) · F3: void/refund/exchange. */
@RestController
@RequestMapping("/tickets")
class TicketController(
    private val issueHandler: IssueTicketHandler,
    private val voidHandler: VoidTicketHandler,
    private val refundHandler: RefundTicketHandler,
    private val exchangeHandler: ExchangeTicketHandler,
    private val queries: TicketQueries,
) {
    @PostMapping
    fun issue(@RequestBody request: IssueTicketRequest): ResponseEntity<Map<String, Any>> {
        val result = issueHandler.handle(request.toCommand())
        return ResponseEntity.status(HttpStatus.CREATED).body(mapOf("ticketNumber" to result.ticketNumber))
    }

    /** Void (1.1.9) — TÜM kuponlar O olmalı, hepsi V olur; idempotent. Güncel view döner. */
    @PostMapping("/{ticketNumber}/void")
    @Transactional
    fun void(@PathVariable ticketNumber: String, @RequestBody request: VoidRequest): ResponseEntity<Any> {
        voidHandler.handle(VoidTicketCommand(ticketNumber, request.reason, request.idempotencyKey))
        return ResponseEntity.ok(queries.byNumber(ticketNumber) ?: mapOf("ticketNumber" to ticketNumber))
    }

    /** Refund (Ch 15) — seçili O kuponlar R olur; waiver opsiyonel; idempotent. */
    @PostMapping("/{ticketNumber}/refund")
    @Transactional
    fun refund(@PathVariable ticketNumber: String, @RequestBody request: RefundRequest): ResponseEntity<Any> {
        refundHandler.handle(
            RefundTicketCommand(
                ticketNumber = ticketNumber,
                couponSeqs = request.couponSeqs,
                refundAmount = request.refundAmount.amount,
                refundCurrency = request.refundAmount.currency,
                waiver = request.waiver,
                idempotencyKey = request.idempotencyKey,
            ),
        )
        return ResponseEntity.ok(queries.byNumber(ticketNumber) ?: mapOf("ticketNumber" to ticketNumber))
    }

    /** Exchange/Reissue (Ch 12) — açık kuponlar E; yeni bilet linkage'la kesilir; idempotent.
     *  İki aggregate tek transaction'da yazılır (yarım exchange kalamaz). */
    @PostMapping("/{ticketNumber}/exchange")
    @Transactional
    fun exchange(@PathVariable ticketNumber: String, @RequestBody request: ExchangeRequest): ResponseEntity<Any> {
        val result = exchangeHandler.handle(
            ExchangeTicketCommand(
                oldTicketNumber = ticketNumber,
                newCoupons = request.newSegments.map {
                    IssueCouponInput(it.origin, it.destination, it.marketingCarrier, it.flightNumber, it.rbd, it.fareBasis, it.departure)
                },
                adcAmount = request.adc.amount,
                adcCurrency = request.adc.currency,
                idempotencyKey = request.idempotencyKey,
            ),
        )
        return ResponseEntity.ok(
            mapOf(
                "oldTicket" to (queries.byNumber(result.oldTicketNumber) ?: mapOf("ticketNumber" to result.oldTicketNumber)),
                "newTicket" to (queries.byNumber(result.newTicketNumber) ?: mapOf("ticketNumber" to result.newTicketNumber)),
            ),
        )
    }

    /** Search & Display (Handbook Ch 1) — read model'den arama; q boşsa tümü. */
    @GetMapping
    fun list(@RequestParam(required = false) q: String?) = queries.search(q ?: "")

    /** Bilet detayı — CQRS okuma yolu (ticket_read read model). */
    @GetMapping("/{ticketNumber}")
    fun get(@PathVariable ticketNumber: String): ResponseEntity<Any> {
        val view = queries.byNumber(ticketNumber) ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(view)
    }

    /** Itinerary / Receipt (App B zorunlu uyarılar). */
    @GetMapping("/{ticketNumber}/receipt")
    fun receipt(@PathVariable ticketNumber: String): ResponseEntity<Any> {
        val v = queries.byNumber(ticketNumber) ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(
            mapOf(
                "ticketNumber" to v.ticketNumber,
                "passenger" to v.passengerName,
                "validatingCarrier" to v.validatingCarrier,
                "itinerary" to v.route,
                "coupons" to v.coupons,
                "fare" to mapOf("amount" to v.totalAmount, "currency" to v.currency),
                "entries" to v.entries,
                "issuedAt" to v.issuedAt,
                "notice" to "Bu Itinerary/Receipt IATA Conditions of Contract ve App B zorunlu uyarılarına tabidir. Elektronik bilet kaydı geçerli seyahat dokümanıdır.",
            ),
        )
    }
}
