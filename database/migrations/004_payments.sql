-- 004_payments.sql
-- Application-level payment records linked to M-Pesa transactions and sales

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    merchant_id UUID NOT NULL
        REFERENCES merchants(id) ON DELETE CASCADE,

    sale_id UUID
        REFERENCES sales(id) ON DELETE SET NULL,

    mpesa_transaction_id UUID
        REFERENCES mpesa_transactions(id) ON DELETE SET NULL,

    payment_method VARCHAR(30) NOT NULL DEFAULT 'MPESA_C2B'
        CHECK (payment_method IN ('MPESA_C2B')),

    amount NUMERIC(14,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'KES',

    status VARCHAR(30) NOT NULL DEFAULT 'UNMATCHED'
        CHECK (status IN (
            'UNMATCHED',
            'MATCHED',
            'AMOUNT_MISMATCH',
            'REJECTED',
            'REVERSED'
        )),

    match_method VARCHAR(40),

    payment_reference VARCHAR(100),

    paid_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (amount >= 0)
);

CREATE INDEX idx_payments_merchant
    ON payments(merchant_id);

CREATE INDEX idx_payments_merchant_status
    ON payments(merchant_id, status);

CREATE INDEX idx_payments_sale
    ON payments(sale_id);

CREATE INDEX idx_payments_mpesa_transaction
    ON payments(mpesa_transaction_id);

CREATE INDEX idx_payments_reference
    ON payments(merchant_id, payment_reference);

CREATE INDEX idx_payments_created
    ON payments(merchant_id, created_at DESC);

-- A single M-Pesa transaction should produce at most one
-- application payment record.
CREATE UNIQUE INDEX uq_payments_mpesa_transaction
    ON payments(mpesa_transaction_id)
    WHERE mpesa_transaction_id IS NOT NULL;

-- A sale should not have two successful/matched payment records
-- for the same transaction. Multiple payment attempts remain
-- possible while only the valid matched payment is associated.
CREATE INDEX idx_payments_matched_sale
    ON payments(sale_id)
    WHERE status = 'MATCHED';
