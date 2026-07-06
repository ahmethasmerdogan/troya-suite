-- CQRS okuma tarafı (ARCHITECTURE §3) — event'lerden projekte edilen read model.
-- Search & Display (Handbook Ch 1) bunu sorgular; yazma tarafı (events) ayrıdır.
CREATE TABLE IF NOT EXISTS ticket_read (
    ticket_number      TEXT PRIMARY KEY,
    passenger_name     TEXT        NOT NULL,
    pnr                TEXT,
    validating_carrier TEXT        NOT NULL,
    route              TEXT        NOT NULL,
    overall_status     CHAR(1)     NOT NULL,
    total_amount       NUMERIC     NOT NULL,
    currency           TEXT        NOT NULL,
    issued_at          TIMESTAMPTZ NOT NULL,
    coupons            JSONB       NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_read_pax ON ticket_read (upper(passenger_name));
CREATE INDEX IF NOT EXISTS idx_ticket_read_pnr ON ticket_read (pnr);
