-- 005_invoices.sql
-- Internal invoice records and KRA fiscalization attempts

CREATE TABLE invoice_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    merchant_id UUID NOT NULL
        REFERENCES merchants(id) ON DELETE CASCADE,

    branch_id UUID
        REFERENCES merchant_branches(id) ON DELETE SET NULL,

    next_number BIGINT NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (merchant_id, branch_id),

    CHECK (next_number > 0)
);


CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    merchant_id UUID NOT NULL
        REFERENCES merchants(id) ON DELETE CASCADE,

    sale_id UUID NOT NULL
        REFERENCES sales(id) ON DELETE RESTRICT,

    branch_id UUID
        REFERENCES merchant_branches(id) ON DELETE SET NULL,

    invoice_number VARCHAR(100) NOT NULL,

    invoice_type VARCHAR(30) NOT NULL DEFAULT 'STANDARD'
        CHECK (invoice_type IN ('STANDARD', 'CREDIT_NOTE')),

    original_invoice_id UUID
        REFERENCES invoices(id) ON DELETE SET NULL,

    seller_pin VARCHAR(20) NOT NULL,
    seller_name VARCHAR(255),

    buyer_id UUID
        REFERENCES buyers(id) ON DELETE SET NULL,

    buyer_pin VARCHAR(20),
    buyer_name VARCHAR(255),

    currency VARCHAR(3) NOT NULL DEFAULT 'KES',

    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,

    fiscalization_status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (fiscalization_status IN (
            'PENDING',
            'PROCESSING',
            'FISCALIZED',
            'FAILED',
            'CANCELLED'
        )),

    kra_receipt_number VARCHAR(100),
    kra_invoice_number VARCHAR(100),

    cu_serial_number VARCHAR(100),
    kra_internal_data TEXT,
    receipt_signature TEXT,
    sdc_date_time VARCHAR(30),

    qr_code TEXT,

    fiscalized_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (merchant_id, invoice_number),

    CHECK (subtotal >= 0),
    CHECK (tax_amount >= 0),
    CHECK (total_amount >= 0)
);


CREATE INDEX idx_invoices_merchant
    ON invoices(merchant_id);

CREATE INDEX idx_invoices_merchant_status
    ON invoices(merchant_id, fiscalization_status);

CREATE INDEX idx_invoices_sale
    ON invoices(sale_id);

CREATE INDEX idx_invoices_buyer
    ON invoices(buyer_id);

CREATE INDEX idx_invoices_receipt
    ON invoices(kra_receipt_number);


CREATE TABLE fiscalization_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    invoice_id UUID NOT NULL
        REFERENCES invoices(id) ON DELETE CASCADE,

    attempt_number INTEGER NOT NULL,

    status VARCHAR(30) NOT NULL
        CHECK (status IN (
            'STARTED',
            'SUCCESS',
            'FAILED',
            'TIMEOUT',
            'UNKNOWN'
        )),

    request_reference VARCHAR(100),

    request_payload JSONB,

    response_payload JSONB,

    http_status INTEGER,

    kra_result_code VARCHAR(50),
    kra_result_message TEXT,

    error_message TEXT,

    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,

    UNIQUE (invoice_id, attempt_number),

    CHECK (attempt_number > 0)
);


CREATE INDEX idx_fiscalization_attempts_invoice
    ON fiscalization_attempts(invoice_id);

CREATE INDEX idx_fiscalization_attempts_status
    ON fiscalization_attempts(status);

CREATE INDEX idx_fiscalization_attempts_started
    ON fiscalization_attempts(started_at DESC);
