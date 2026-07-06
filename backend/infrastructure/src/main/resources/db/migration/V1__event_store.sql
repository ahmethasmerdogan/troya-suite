-- Event store — append-only (ARCHITECTURE §2). State event'lerden türetilir.
-- Optimistic concurrency: (stream_id, version) UNIQUE.
CREATE TABLE IF NOT EXISTS events (
    global_seq   BIGSERIAL PRIMARY KEY,
    stream_id    TEXT        NOT NULL,
    version      BIGINT      NOT NULL,
    type         TEXT        NOT NULL,
    payload      JSONB       NOT NULL,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_stream_version UNIQUE (stream_id, version)
);

CREATE INDEX IF NOT EXISTS idx_events_stream ON events (stream_id, version);

-- Outbox (Faz 6 — DB commit ↔ mesaj yayını atomik; ARCHITECTURE §6).
CREATE TABLE IF NOT EXISTS outbox (
    id           BIGSERIAL PRIMARY KEY,
    aggregate_id TEXT        NOT NULL,
    type         TEXT        NOT NULL,
    payload      JSONB       NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ
);

-- İdempotency anahtarları (ARCHITECTURE §6 — çift-issue/refund koruması).
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key         TEXT PRIMARY KEY,
    result_ref  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
