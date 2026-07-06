-- F5 — EMD read model (Handbook Ch 5). Yazma tarafı events tablosunda (stream = EMD no).
CREATE TABLE IF NOT EXISTS emd_read (
    emd_number            TEXT PRIMARY KEY,
    emd_type              TEXT        NOT NULL,
    rfisc                 TEXT        NOT NULL,
    description           TEXT,
    passenger_name        TEXT        NOT NULL,
    validating_carrier    TEXT        NOT NULL,
    associated_ticket     TEXT,
    associated_coupon_seq INT,
    amount                NUMERIC     NOT NULL,
    currency              TEXT        NOT NULL,
    status                CHAR(1)     NOT NULL,
    issued_at             TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_emd_read_ticket ON emd_read (associated_ticket);
