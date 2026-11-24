-- 013_kra_invoice_numbers.sql
-- KRA invoice numbers (invcNo) are assigned when an invoice is submitted, not when
-- it is created, and are stored before the request is sent. The last number KRA
-- accepted is tracked per branch sequence, so numbers stay in order and a retry
-- after a timeout resends the same number instead of a new one.

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS kra_invc_no BIGINT;

ALTER TABLE invoices
DROP CONSTRAINT IF EXISTS invoices_fiscalization_status_check;

ALTER TABLE invoices
ADD CONSTRAINT invoices_fiscalization_status_check
CHECK (fiscalization_status IN (
    'PENDING',
    'PROCESSING',
    'PENDING_KRA',
    'NEEDS_CHECK',
    'FISCALIZED',
    'FAILED',
    'CANCELLED'
));

-- Never two invoices with the same KRA number for one merchant.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_kra_invc_no
ON invoices (merchant_id, kra_invc_no)
WHERE kra_invc_no IS NOT NULL;

-- Last invoice number KRA accepted for this sequence. NULL until baselined.
ALTER TABLE invoice_sequences
ADD COLUMN IF NOT EXISTS last_kra_invc_no BIGINT;
