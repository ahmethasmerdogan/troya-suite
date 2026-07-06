package com.troya.infrastructure.ticket

import com.troya.application.port.TicketNumberGenerator
import com.troya.domain.ticket.TicketNumber
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component

/** Bilet seri no üreteci — Postgres sequence (ticket_serial) + mod-7 check digit. */
@Component
class JdbcTicketNumberGenerator(private val jdbc: JdbcTemplate) : TicketNumberGenerator {
    override fun next(): TicketNumber {
        val serial = jdbc.queryForObject("SELECT nextval('ticket_serial')", Long::class.java)
            ?: error("Sequence ticket_serial okunamadı")
        return TicketNumber.build("235", serial.toString())
    }
}
