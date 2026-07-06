package com.troya.application.port

import com.troya.domain.ticket.TicketNumber

/** Bilet numarası üreteci portu — adapter: DB sequence (infrastructure). */
interface TicketNumberGenerator {
    fun next(): TicketNumber
}
