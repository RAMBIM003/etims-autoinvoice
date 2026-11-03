-- One row per notable event in the payment-to-KRA workflow.
-- Written alongside the server log so the Logs page can show the same errors
-- without anyone opening the server. Rows are never edited, only added or purged.
CREATE TABLE IF NOT EXISTS system_events (
    id           bigserial PRIMARY KEY,
    created_at   timestamptz NOT NULL DEFAULT now(),
    merchant_id  uuid REFERENCES merchants(id) ON DELETE SET NULL,
    stage        text NOT NULL,
    outcome      text NOT NULL CHECK (outcome IN ('OK', 'REJECTED', 'FAILED', 'STUCK')),
    code         text,
    reference    text,
    sale_id      uuid,
    invoice_id   uuid,
    message      text NOT NULL,
    detail       text
);

CREATE INDEX IF NOT EXISTS system_events_created_idx ON system_events (created_at DESC);
CREATE INDEX IF NOT EXISTS system_events_merchant_idx ON system_events (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS system_events_reference_idx ON system_events (reference);
