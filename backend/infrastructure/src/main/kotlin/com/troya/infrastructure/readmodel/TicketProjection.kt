package com.troya.infrastructure.readmodel

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.troya.domain.common.DomainEvent
import com.troya.domain.ticket.CouponsExchanged
import com.troya.domain.ticket.CouponsRefunded
import com.troya.domain.ticket.TicketIssued
import com.troya.domain.ticket.TicketVoided
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.sql.Timestamp

/**
 * Read model projektörü (CQRS) — event'leri ticket_read tablosuna yansıtır.
 * F2: TicketIssued · F3: TicketVoided / CouponsRefunded / CouponsExchanged (kupon statüleri
 * + overall_status güncellenir). (Gerçekte outbox + async projeksiyon; şimdilik senkron —
 * repository.save sonrası çağrılır.)
 */
@Component
class TicketProjection(
    private val jdbc: JdbcTemplate,
    private val mapper: ObjectMapper,
) {
    fun apply(event: DomainEvent) {
        when (event) {
            is TicketIssued -> projectIssued(event)
            is TicketVoided -> updateCouponStatuses(event.ticketNumber, seqs = null, newStatus = "V")
            is CouponsRefunded -> updateCouponStatuses(event.ticketNumber, event.couponSeqs.toSet(), "R")
            is CouponsExchanged -> updateCouponStatuses(event.ticketNumber, event.couponSeqs.toSet(), "E")
            else -> Unit
        }
    }

    private fun projectIssued(event: TicketIssued) {
        val route = (event.coupons.map { it.origin } + event.coupons.last().destination).joinToString(" → ")
        val coupons = event.coupons.mapIndexed { i, c ->
            mapOf(
                "seq" to i + 1, "status" to "O", "origin" to c.origin, "destination" to c.destination,
                "flightNumber" to c.flightNumber, "rbd" to c.rbd, "fareBasis" to c.fareBasis,
                "notValidBefore" to c.notValidBefore, "notValidAfter" to c.notValidAfter, "baggage" to c.baggage,
            )
        }
        jdbc.update(
            """
            INSERT INTO ticket_read
                (ticket_number, passenger_name, pnr, validating_carrier, route, overall_status, total_amount, currency, issued_at, coupons, entries)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb)
            ON CONFLICT (ticket_number) DO UPDATE SET
                overall_status = EXCLUDED.overall_status, coupons = EXCLUDED.coupons, entries = EXCLUDED.entries
            """.trimIndent(),
            event.ticketNumber,
            "${event.surname}/${event.givenName}",
            event.pnr,
            event.validatingCarrier,
            route,
            "O",
            BigDecimal(event.fareAmount),
            event.fareCurrency,
            Timestamp.from(event.occurredAt),
            mapper.writeValueAsString(coupons),
            event.entries?.let { mapper.writeValueAsString(it) },
        )
    }

    /** Kupon statülerini güncelle (seqs=null → tümü) ve overall_status'u yeniden türet. */
    private fun updateCouponStatuses(ticketNumber: String, seqs: Set<Int>?, newStatus: String) {
        val json = jdbc.query("SELECT coupons FROM ticket_read WHERE ticket_number = ?", { rs, _ -> rs.getString(1) }, ticketNumber)
            .firstOrNull() ?: return
        val coupons: MutableList<MutableMap<String, Any>> =
            mapper.readValue(json, object : TypeReference<MutableList<MutableMap<String, Any>>>() {})
        coupons.forEach { c ->
            val seq = (c["seq"] as Number).toInt()
            if (seqs == null || seq in seqs) c["status"] = newStatus
        }
        val overall = overallOf(coupons.map { it["status"] as String })
        jdbc.update(
            "UPDATE ticket_read SET coupons = ?::jsonb, overall_status = ? WHERE ticket_number = ?",
            mapper.writeValueAsString(coupons),
            overall,
            ticketNumber,
        )
    }

    /**
     * Bilet düzeyi özet statü (arama listesi için). Öncelik: hâlâ açık kupon varsa O (aksiyon
     * alınabilir); yoksa "en anlamlı" final: V (tümü) > R > E > F; aksi halde ilk statü.
     */
    private fun overallOf(statuses: List<String>): String = when {
        statuses.isEmpty() -> "O"
        statuses.all { it == "V" } -> "V"
        statuses.any { it == "O" } -> "O"
        statuses.any { it == "I" } -> "I"
        statuses.any { it == "R" } -> "R"
        statuses.any { it == "E" } -> "E"
        statuses.any { it == "F" } -> "F"
        else -> statuses.first()
    }
}
