-- 007_transaction_states.sql
-- Fix invoice sequence uniqueness when branch_id is NULL and add explicit
-- payment/fiscalization lifecycle states for orders.

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;

ALTER TABLE sales
ADD CONSTRAINT sales_status_check
CHECK (status IN (
    'DRAFT',
    'AWAITING_PAYMENT',
    'PAID',
    'FISCALIZATION_PENDING',
    'CANCELLED',
    'CLOSED'
));

ALTER TABLE invoice_sequences DROP CONSTRAINT IF EXISTS invoice_sequences_merchant_id_branch_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_sequences_merchant_branch
ON invoice_sequences (merchant_id, branch_id) NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS idx_sales_payment_lifecycle
ON sales (merchant_id, status, updated_at DESC);
