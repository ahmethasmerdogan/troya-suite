package com.troya.application.port

import com.troya.application.ticket.TicketSummaryView
import com.troya.application.ticket.TicketView

/**
 * Okuma tarafı portu (CQRS read model). Komut yolu Repository, sorgu yolu burası (ARCHITECTURE §3).
 * Adapter: infrastructure/JdbcTicketQueries (ticket_read tablosu).
 */
interface TicketQueries {
    fun byNumber(ticketNumber: String): TicketView?

    /** TKT no / yolcu adı / PNR üzerinde arama (Search & Display, Handbook Ch 1). */
    fun search(query: String): List<TicketSummaryView>
}
