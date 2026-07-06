package com.troya.infrastructure.idempotency

import com.troya.application.port.IdempotencyStore
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository

/** İdempotency anahtarları (Postgres) — çift-issue/refund koruması (ARCHITECTURE §6). */
@Repository
class JdbcIdempotencyStore(private val jdbc: JdbcTemplate) : IdempotencyStore {

    override fun recall(key: String): String? = jdbc.query("SELECT result_ref FROM idempotency_keys WHERE key = ?", { rs, _ -> rs.getString("result_ref") }, key)
        .firstOrNull()

    override fun remember(key: String, resultRef: String) {
        jdbc.update("INSERT INTO idempotency_keys (key, result_ref) VALUES (?, ?) ON CONFLICT (key) DO NOTHING", key, resultRef)
    }
}
