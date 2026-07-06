package com.troya.infrastructure.outbox

import org.apache.kafka.clients.producer.KafkaProducer
import org.apache.kafka.clients.producer.ProducerConfig
import org.apache.kafka.clients.producer.ProducerRecord
import org.apache.kafka.common.serialization.StringSerializer
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

/**
 * Outbox relay (F6, kural 6) — outbox'taki yayınlanmamış satırları Kafka/Redpanda'ya
 * taşır ve işaretler. Broker yoksa satırlar bekler, sonraki turda yeniden denenir
 * (at-least-once; tüketici idempotent olmalı). Mesaj zarfı:
 * {"type": "...", "aggregateId": "...", "payload": {...}} — key = aggregateId (stream sırası korunur).
 */
@Component
class OutboxRelay(
    private val jdbc: JdbcTemplate,
    @Value("\${troya.kafka.bootstrap:localhost:19092}") private val bootstrap: String,
    @Value("\${troya.kafka.topic:troya.events}") private val topic: String,
) {
    private val log = LoggerFactory.getLogger(OutboxRelay::class.java)

    private val producer by lazy {
        KafkaProducer<String, String>(
            mapOf(
                ProducerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrap,
                ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG to StringSerializer::class.java.name,
                ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG to StringSerializer::class.java.name,
                ProducerConfig.ACKS_CONFIG to "1",
                // broker yoksa hızlı vazgeç — relay bir sonraki turda dener
                ProducerConfig.MAX_BLOCK_MS_CONFIG to 2_000,
                ProducerConfig.REQUEST_TIMEOUT_MS_CONFIG to 3_000,
                ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG to 5_000,
            ),
        )
    }

    data class Row(val id: Long, val aggregateId: String, val type: String, val payload: String)

    @Scheduled(fixedDelay = 2_000)
    @Suppress("TooGenericExceptionCaught") // broker/serialization/IO — hepsi "sonraki turda dene" demek
    fun relay() {
        val rows = jdbc.query(
            "SELECT id, aggregate_id, type, payload FROM outbox WHERE published_at IS NULL ORDER BY id LIMIT 100",
        ) { rs, _ -> Row(rs.getLong("id"), rs.getString("aggregate_id"), rs.getString("type"), rs.getString("payload")) }
        if (rows.isEmpty()) return
        try {
            for (r in rows) {
                val envelope = """{"type":"${r.type}","aggregateId":"${r.aggregateId}","payload":${r.payload}}"""
                producer.send(ProducerRecord(topic, r.aggregateId, envelope)).get()
                jdbc.update("UPDATE outbox SET published_at = now() WHERE id = ?", r.id)
            }
            log.info("Outbox: {} mesaj yayınlandı → {}", rows.size, topic)
        } catch (e: Exception) {
            log.warn("Outbox yayını başarısız ({} satır bekliyor) — sonraki turda denenecek: {}", rows.size, e.message)
        }
    }
}
