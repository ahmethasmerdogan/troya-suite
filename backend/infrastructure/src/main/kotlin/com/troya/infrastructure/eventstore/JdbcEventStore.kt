package com.troya.infrastructure.eventstore

import com.troya.application.port.EventStore
import com.troya.application.port.OptimisticConcurrencyException
import com.troya.application.port.StoredEvent
import com.troya.domain.common.DomainEvent
import org.springframework.dao.DuplicateKeyException
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional

/**
 * Postgres event store adapter (ARCHITECTURE §2) — append-only, jsonb payload.
 * Optimistic concurrency: (stream_id, version) UNIQUE ihlali → OptimisticConcurrencyException.
 * F6 (kural 6 — Outbox): her event, AYNI transaction içinde outbox'a da yazılır;
 * yayın OutboxRelay ile async yapılır — doğrudan publish YOK.
 */
@Repository
class JdbcEventStore(
    private val jdbc: JdbcTemplate,
    private val serde: EventSerde,
) : EventStore {

    @Transactional
    override fun append(streamId: String, expectedVersion: Long, events: List<DomainEvent>) {
        var version = expectedVersion
        try {
            for (event in events) {
                version += 1
                val type = serde.typeOf(event)
                val payload = serde.toJson(event)
                jdbc.update(
                    "INSERT INTO events (stream_id, version, type, payload) VALUES (?, ?, ?, ?::jsonb)",
                    streamId,
                    version,
                    type,
                    payload,
                )
                jdbc.update(
                    "INSERT INTO outbox (aggregate_id, type, payload) VALUES (?, ?, ?::jsonb)",
                    streamId,
                    type,
                    payload,
                )
            }
        } catch (e: DuplicateKeyException) {
            throw OptimisticConcurrencyException(streamId, expectedVersion, version).apply { initCause(e) }
        }
    }

    override fun readStream(streamId: String): List<StoredEvent> = jdbc.query(
        "SELECT stream_id, version, type, payload FROM events WHERE stream_id = ? ORDER BY version",
        { rs, _ ->
            val type = rs.getString("type")
            StoredEvent(rs.getString("stream_id"), rs.getLong("version"), type, serde.fromJson(type, rs.getString("payload")))
        },
        streamId,
    )
}
