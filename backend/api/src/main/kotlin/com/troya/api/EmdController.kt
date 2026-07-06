package com.troya.api

import com.troya.application.emd.EmdQueries
import com.troya.application.emd.IssueEmdCommand
import com.troya.application.emd.IssueEmdHandler
import com.troya.application.emd.RefundEmdHandler
import com.troya.application.emd.VoidEmdHandler
import com.troya.application.port.IdempotencyStore
import com.troya.application.port.Repository
import com.troya.application.port.TicketNumberGenerator
import com.troya.domain.emd.Emd
import com.troya.domain.ticket.Ticket
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
import org.springframework.web.bind.annotation.RestController

@Configuration
class EmdConfig {
    @Bean
    fun issueEmdHandler(
        emdRepository: Repository<Emd, TicketNumber>,
        ticketRepository: Repository<Ticket, TicketNumber>,
        numbers: TicketNumberGenerator,
        idempotency: IdempotencyStore,
    ) = IssueEmdHandler(emdRepository, ticketRepository, numbers, idempotency)

    @Bean
    fun refundEmdHandler(emdRepository: Repository<Emd, TicketNumber>, idempotency: IdempotencyStore) = RefundEmdHandler(emdRepository, idempotency)

    @Bean
    fun voidEmdHandler(emdRepository: Repository<Emd, TicketNumber>, idempotency: IdempotencyStore) = VoidEmdHandler(emdRepository, idempotency)
}

data class IssueEmdRequest(
    val type: String,
    val rfisc: String,
    val description: String?,
    val associatedCouponSeq: Int?,
    val amount: MoneyDto,
    val idempotencyKey: String,
)

data class EmdActionRequest(val reason: String? = null, val idempotencyKey: String)

/** F5 REST — EMD kesimi bilete iliştirilir (EMD-S = "in connection with"); yaşam döngüsü refund/void. */
@RestController
class EmdController(
    private val issueHandler: IssueEmdHandler,
    private val refundHandler: RefundEmdHandler,
    private val voidHandler: VoidEmdHandler,
    private val queries: EmdQueries,
) {
    @PostMapping("/tickets/{ticketNumber}/emds")
    @Transactional
    fun issueForTicket(@PathVariable ticketNumber: String, @RequestBody request: IssueEmdRequest): ResponseEntity<Any> {
        val result = issueHandler.handle(
            IssueEmdCommand(
                type = request.type,
                rfisc = request.rfisc,
                description = request.description,
                associatedTicket = ticketNumber,
                associatedCouponSeq = request.associatedCouponSeq,
                amount = request.amount.amount,
                currency = request.amount.currency,
                idempotencyKey = request.idempotencyKey,
            ),
        )
        return ResponseEntity.status(HttpStatus.CREATED).body(queries.byNumber(result.emdNumber) ?: mapOf("emdNumber" to result.emdNumber))
    }

    @GetMapping("/tickets/{ticketNumber}/emds")
    fun byTicket(@PathVariable ticketNumber: String) = queries.byTicket(ticketNumber)

    @GetMapping("/emds")
    fun list() = queries.list()

    @GetMapping("/emds/{emdNumber}")
    fun get(@PathVariable emdNumber: String): ResponseEntity<Any> = queries.byNumber(emdNumber)?.let { ResponseEntity.ok(it) } ?: ResponseEntity.notFound().build()

    @PostMapping("/emds/{emdNumber}/refund")
    @Transactional
    fun refund(@PathVariable emdNumber: String, @RequestBody request: EmdActionRequest): ResponseEntity<Any> {
        refundHandler.handle(emdNumber, request.idempotencyKey)
        return ResponseEntity.ok(queries.byNumber(emdNumber) ?: mapOf("emdNumber" to emdNumber))
    }

    @PostMapping("/emds/{emdNumber}/void")
    @Transactional
    fun void(@PathVariable emdNumber: String, @RequestBody request: EmdActionRequest): ResponseEntity<Any> {
        voidHandler.handle(emdNumber, request.reason, request.idempotencyKey)
        return ResponseEntity.ok(queries.byNumber(emdNumber) ?: mapOf("emdNumber" to emdNumber))
    }
}
