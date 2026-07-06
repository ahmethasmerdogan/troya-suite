package com.troya.infrastructure.readmodel

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.troya.application.port.TicketQueries
import com.troya.application.ticket.CouponView
import com.troya.application.ticket.TicketSummaryView
import com.troya.application.ticket.TicketView
import com.troya.domain.ticket.TicketEntries
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import java.sql.ResultSet

/** Read model sorgu adapter'ı (ticket_read). CQRS okuma yolu. */
@Component
class JdbcTicketQueries(
    private val jdbc: JdbcTemplate,
    private val mapper: ObjectMapper,
) : TicketQueries {

    override fun byNumber(ticketNumber: String): TicketView? = jdbc.query("SELECT * FROM ticket_read WHERE ticket_number = ?", { rs, _ -> toView(rs) }, ticketNumber).firstOrNull()

    override fun search(query: String): List<TicketSummaryView> {
        val like = "%${query.trim().uppercase()}%"
        return jdbc.query(
            """
            SELECT * FROM ticket_read
            WHERE ticket_number LIKE ? OR upper(passenger_name) LIKE ? OR upper(coalesce(pnr, '')) LIKE ?
            ORDER BY issued_at DESC LIMIT 50
            """.trimIndent(),
            { rs, _ -> toSummary(rs) },
            "%${query.trim()}%",
            like,
            like,
        )
    }

    private fun toView(rs: ResultSet): TicketView {
        val coupons: List<CouponView> = mapper.readValue(rs.getString("coupons"), object : TypeReference<List<CouponView>>() {})
        return TicketView(
            ticketNumber = rs.getString("ticket_number"),
            passengerName = rs.getString("passenger_name"),
            pnr = rs.getString("pnr"),
            validatingCarrier = rs.getString("validating_carrier"),
            route = rs.getString("route"),
            overallStatus = rs.getString("overall_status"),
            totalAmount = rs.getBigDecimal("total_amount").toPlainString(),
            currency = rs.getString("currency"),
            issuedAt = rs.getTimestamp("issued_at").toInstant().toString(),
            coupons = coupons,
            entries = rs.getString("entries")?.let { mapper.readValue(it, TicketEntries::class.java) },
        )
    }

    private fun toSummary(rs: ResultSet) = TicketSummaryView(
        ticketNumber = rs.getString("ticket_number"),
        passengerName = rs.getString("passenger_name"),
        route = rs.getString("route"),
        validatingCarrier = rs.getString("validating_carrier"),
        overallStatus = rs.getString("overall_status"),
        totalAmount = rs.getBigDecimal("total_amount").toPlainString(),
        currency = rs.getString("currency"),
        issuedAt = rs.getTimestamp("issued_at").toInstant().toString(),
    )
}
