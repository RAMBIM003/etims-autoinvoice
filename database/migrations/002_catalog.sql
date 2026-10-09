-- 002_catalog.sql
-- Merchant item catalogue + KRA item mappings/reference data

CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

    sku VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    description TEXT,

    unit_code VARCHAR(20) NOT NULL DEFAULT 'PCS',
    unit_price NUMERIC(14,4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'KES',

    tax_type_code VARCHAR(20),
    tax_rate NUMERIC(7,4),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE','INACTIVE')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (merchant_id, sku)
);

CREATE INDEX idx_items_merchant
    ON items(merchant_id);

CREATE INDEX idx_items_merchant_status
    ON items(merchant_id, status);


CREATE TABLE item_kra_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,

    item_cls_code VARCHAR(50),
    item_code VARCHAR(100),
    item_name VARCHAR(255),

    tax_type_code VARCHAR(20),
    unit_code VARCHAR(20),

    source VARCHAR(30) NOT NULL DEFAULT 'MANUAL'
        CHECK (source IN ('KRA_SYNC','MANUAL')),

    active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (item_id)
);

CREATE INDEX idx_item_kra_mappings_item
    ON item_kra_mappings(item_id);

CREATE INDEX idx_item_kra_mappings_item_code
    ON item_kra_mappings(item_code);


CREATE TABLE kra_reference_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,

    code_type VARCHAR(50) NOT NULL,
    code VARCHAR(100) NOT NULL,
    name VARCHAR(255),

    parent_code VARCHAR(100),
    description TEXT,

    source VARCHAR(30) NOT NULL DEFAULT 'KRA_OSCU'
        CHECK (source IN ('KRA_OSCU','MANUAL')),

    raw_data JSONB,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (merchant_id, code_type, code)
);

CREATE INDEX idx_kra_reference_codes_merchant
    ON kra_reference_codes(merchant_id);

CREATE INDEX idx_kra_reference_codes_type
    ON kra_reference_codes(merchant_id, code_type);

CREATE INDEX idx_kra_reference_codes_code
    ON kra_reference_codes(code);


CREATE TABLE kra_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

    sync_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('STARTED','SUCCESS','FAILED')),

    records_received INTEGER NOT NULL DEFAULT 0,

    message TEXT,
    raw_response JSONB,

    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_kra_sync_logs_merchant
    ON kra_sync_logs(merchant_id, started_at DESC);
