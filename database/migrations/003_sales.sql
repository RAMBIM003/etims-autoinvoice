-- 003_sales.sql
-- Merchant sales/orders and immutable sale-line snapshots

CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    merchant_id UUID NOT NULL
        REFERENCES merchants(id) ON DELETE CASCADE,

    buyer_id UUID
        REFERENCES buyers(id) ON DELETE SET NULL,

    order_reference VARCHAR(100) NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'AWAITING_PAYMENT'
        CHECK (status IN (
            'DRAFT',
            'AWAITING_PAYMENT',
            'CANCELLED',
            'CLOSED'
        )),

    currency VARCHAR(3) NOT NULL DEFAULT 'KES',

    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    cancelled_at TIMESTAMPTZ,

    UNIQUE (merchant_id, order_reference),

    CHECK (subtotal >= 0),
    CHECK (tax_amount >= 0),
    CHECK (total_amount >= 0)
);

CREATE INDEX idx_sales_merchant
    ON sales(merchant_id);

CREATE INDEX idx_sales_merchant_status
    ON sales(merchant_id, status);

CREATE INDEX idx_sales_merchant_created
    ON sales(merchant_id, created_at DESC);

CREATE INDEX idx_sales_buyer
    ON sales(buyer_id);


CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    sale_id UUID NOT NULL
        REFERENCES sales(id) ON DELETE CASCADE,

    item_id UUID
        REFERENCES items(id) ON DELETE SET NULL,

    line_number INTEGER NOT NULL,

    sku VARCHAR(100),
    item_name VARCHAR(255) NOT NULL,

    quantity NUMERIC(14,3) NOT NULL,
    unit_code VARCHAR(20) NOT NULL DEFAULT 'PCS',

    unit_price NUMERIC(14,4) NOT NULL,

    tax_type_code VARCHAR(20),
    tax_rate NUMERIC(7,4),

    tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    line_subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    line_total NUMERIC(14,2) NOT NULL DEFAULT 0,

    currency VARCHAR(3) NOT NULL DEFAULT 'KES',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (sale_id, line_number),

    CHECK (line_number > 0),
    CHECK (quantity > 0),
    CHECK (unit_price >= 0),
    CHECK (tax_amount >= 0),
    CHECK (line_subtotal >= 0),
    CHECK (line_total >= 0)
);

CREATE INDEX idx_sale_items_sale
    ON sale_items(sale_id);

CREATE INDEX idx_sale_items_item
    ON sale_items(item_id);
