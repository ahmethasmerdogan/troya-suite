package com.troya.infrastructure.emd

import com.troya.application.emd.EmdQueries
import com.troya.application.emd.EmdView
import com.troya.application.port.EventStore
import com.troya.application.port.Repository
import com.troya.domain.common.DomainEvent
import com.troya.domain.emd.Emd
import com.troya.domain.emd.EmdIssued
import com.troya.domain.emd.EmdRefunded
import com.troya.domain.emd.EmdVoided
import com.troya.domain.ticket.TicketNumber
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.sql.ResultSet
import java.sql.Timestamp

/** EMD read model projektörü — event'leri emd_read'e yansıtır (senkron; outbox F6). */
@Component
class EmdProjection(private val jdbc: JdbcTemplate) {
    fun apply(event: DomainEvent) {
        when (event) {
            is EmdIssued -> jdbc.update(
                """
                INSERT INTO emd_read
                    (emd_number, emd_type, rfisc, description, passenger_name, validating_carrier,
                     associated_ticket, associated_coupon_seq, amount, currency, status, issued_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (emd_number) DO NOTHING
                """.trimIndent(),
                event.emdNumber, event.emdType, event.rfisc, event.description, event.passengerName,
                event.validatingCarrier, event.associatedTicket, event.associatedCouponSeq,
                BigDecimal(event.amount), event.currency, "O", Timestamp.from(event.occurredAt),
            )
            is EmdRefunded -> jdbc.update("UPDATE emd_read SET status = 'R' WHERE emd_number = ?", event.emdNumber)
            is EmdVoided -> jdbc.update("UPDATE emd_read SET status = 'V' WHERE emd_number = ?", event.emdNumber)
            else -> Unit
        }
    }
}

/** Event-sourced EMD repository (Ticket ile aynı event store; stream = EMD numarası). */
@org.springframework.stereotype.Repository
class EventSourcedEmdRepository(
    private val eventStore: EventStore,
    private val projection: EmdProjection,
) : Repository<Emd, TicketNumber> {

    override fun load(id: TicketNumber): Emd? {
        val stored = eventStore.readStream(id.value)
        if (stored.isEmpty()) return null
        return Emd.rehydrate(id, stored.map { it.event })
    }

    override fun save(aggregate: Emd) {
        val newEvents = aggregate.uncommittedEvents
        eventStore.append(aggregate.id.value, aggregate.version, newEvents)
        newEvents.forEach { projection.apply(it) }
        aggregate.markCommitted()
    }
}

/** EMD read model sorgu adapter'ı. */
@Component
class JdbcEmdQueries(private val jdbc: JdbcTemplate) : EmdQueries {
    override fun byNumber(emdNumber: String): EmdView? = jdbc.query("SELECT * FROM emd_read WHERE emd_number = ?", { rs, _ -> toView(rs) }, emdNumber).firstOrNull()

    override fun byTicket(ticketNumber: String): List<EmdView> =
        jdbc.query("SELECT * FROM emd_read WHERE associated_ticket = ? ORDER BY issued_at", { rs, _ -> toView(rs) }, ticketNumber)

    override fun list(): List<EmdView> = jdbc.query("SELECT * FROM emd_read ORDER BY issued_at DESC LIMIT 100") { rs, _ -> toView(rs) }

    private fun toView(rs: ResultSet) = EmdView(
        emdNumber = rs.getString("emd_number"),
        type = rs.getString("emd_type"),
        rfisc = rs.getString("rfisc"),
        description = rs.getString("description"),
        passengerName = rs.getString("passenger_name"),
        validatingCarrier = rs.getString("validating_carrier"),
        associatedTicket = rs.getString("associated_ticket"),
        associatedCouponSeq = rs.getObject("associated_coupon_seq") as Int?,
        amount = rs.getBigDecimal("amount").toPlainString(),
        currency = rs.getString("currency"),
        status = rs.getString("status"),
        issuedAt = rs.getTimestamp("issued_at").toInstant().toString(),
    )
}
