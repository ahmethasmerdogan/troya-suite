package com.troya.infrastructure.eventstore

import com.fasterxml.jackson.databind.ObjectMapper
import com.troya.domain.common.DomainEvent
import com.troya.domain.emd.EmdIssued
import com.troya.domain.emd.EmdRefunded
import com.troya.domain.emd.EmdVoided
import com.troya.domain.ticket.CouponsExchanged
import com.troya.domain.ticket.CouponsRefunded
import com.troya.domain.ticket.TicketIssued
import com.troya.domain.ticket.TicketVoided
import org.springframework.stereotype.Component

/** Event ↔ JSON (jsonb). F1: issue · F3: void/refund/exchange · F5: EMD yaşam döngüsü. */
@Component
class EventSerde(private val mapper: ObjectMapper) {
    private val byType: Map<String, Class<out DomainEvent>> = mapOf(
        "TicketIssued" to TicketIssued::class.java,
        "TicketVoided" to TicketVoided::class.java,
        "CouponsRefunded" to CouponsRefunded::class.java,
        "CouponsExchanged" to CouponsExchanged::class.java,
        "EmdIssued" to EmdIssued::class.java,
        "EmdRefunded" to EmdRefunded::class.java,
        "EmdVoided" to EmdVoided::class.java,
    )

    fun typeOf(event: DomainEvent): String = event::class.simpleName ?: error("İsimsiz event")

    fun toJson(event: DomainEvent): String = mapper.writeValueAsString(event)

    fun fromJson(type: String, json: String): DomainEvent {
        val cls = byType[type] ?: error("Bilinmeyen event tipi: $type")
        return mapper.readValue(json, cls)
    }
}
