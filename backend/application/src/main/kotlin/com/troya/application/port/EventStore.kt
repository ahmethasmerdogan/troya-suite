package com.troya.application.port

import com.troya.domain.common.DomainEvent

/**
 * Event store portu (Hexagonal). Append-only + optimistic concurrency (ARCHITECTURE §2).
 * Adapter: infrastructure/PostgresEventStore (events tablosu, payload jsonb).
 */
interface EventStore {
    /**
     * Stream'e event'leri ekle. [expectedVersion] çakışırsa
     * [OptimisticConcurrencyException] fırlatır (eşzamanlı yazım koruması).
     */
    fun append(streamId: String, expectedVersion: Long, events: List<DomainEvent>)

    /** Stream'in tüm event'lerini sırayla oku (rehydrate için). */
    fun readStream(streamId: String): List<StoredEvent>
}

data class StoredEvent(
    val streamId: String,
    val version: Long,
    val type: String,
    val event: DomainEvent,
)

class OptimisticConcurrencyException(streamId: String, expected: Long, actual: Long) :
    RuntimeException("Versiyon çakışması stream=$streamId beklenen=$expected gerçek=$actual")
