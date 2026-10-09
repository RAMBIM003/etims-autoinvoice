-- 006_receipts.sql
-- Customer-facing receipt access and SMS delivery tracking

CREATE TABLE receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    merchant_id UUID NOT NULL
        REFERENCES merchants(id) ON DELETE CASCADE,

    invoice_id UUID NOT NULL
        REFERENCES invoices(id) ON DELETE CASCADE,

    sale_id UUID NOT NULL
        REFERENCES sales(id) ON DELETE CASCADE,

    receipt_token_hash VARCHAR(128) NOT NULL,

    recipient_phone_encrypted TEXT,

    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'REVOKED')),

    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (invoice_id),
    UNIQUE (receipt_token_hash)
);


CREATE INDEX idx_receipts_merchant
    ON receipts(merchant_id);

CREATE INDEX idx_receipts_sale
    ON receipts(sale_id);


CREATE TABLE receipt_sms_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    receipt_id UUID NOT NULL
        REFERENCES receipts(id) ON DELETE CASCADE,

    phone_encrypted TEXT NOT NULL,

    provider VARCHAR(50),

    provider_message_id VARCHAR(150),

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN (
            'PENDING',
            'SENT',
            'DELIVERED',
            'FAILED'
        )),

    message TEXT,

    error_message TEXT,

    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE INDEX idx_receipt_sms_receipt
    ON receipt_sms_deliveries(receipt_id);

CREATE INDEX idx_receipt_sms_status
    ON receipt_sms_deliveries(status);
