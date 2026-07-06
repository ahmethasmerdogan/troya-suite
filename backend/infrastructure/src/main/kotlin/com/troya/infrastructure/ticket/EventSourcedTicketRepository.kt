package com.troya.infrastructure.ticket

import com.troya.application.port.EventStore
import com.troya.application.port.Repository
import com.troya.domain.ticket.Ticket
import com.troya.domain.ticket.TicketNumber
import com.troya.infrastructure.readmodel.TicketProjection

/** Event-sourced Ticket repository (komut yazma yolu). Rehydrate = event replay. */
@org.springframework.stereotype.Repository
class EventSourcedTicketRepository(
    private val eventStore: EventStore,
    private val projection: TicketProjection,
) : Repository<Ticket, TicketNumber> {

    override fun load(id: TicketNumber): Ticket? {
        val stored = eventStore.readStream(id.value)
        if (stored.isEmpty()) return null
        return Ticket.rehydrate(id, stored.map { it.event })
    }

    override fun save(aggregate: Ticket) {
        val newEvents = aggregate.uncommittedEvents
        eventStore.append(aggregate.id.value, aggregate.version, newEvents)
        // Senkron read model projeksiyonu (F2). İleride outbox + async olur (ARCHITECTURE §6).
        newEvents.forEach { projection.apply(it) }
        aggregate.markCommitted()
    }
}
