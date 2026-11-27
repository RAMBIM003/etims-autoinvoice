-- 014_held_by_kra.sql
-- An invoice KRA already holds (924 or 994 on its number) whose receipt we cannot confirm
-- can be closed as HELD_BY_KRA by an operator. It is not counted as unresolved, so it no
-- longer blocks later invoices. The KRA number stays on the invoice for the record.

ALTER TABLE invoices
DROP CONSTRAINT IF EXISTS invoices_fiscalization_status_check;

ALTER TABLE invoices
ADD CONSTRAINT invoices_fiscalization_status_check
CHECK (fiscalization_status IN (
    'PENDING',
    'PROCESSING',
    'PENDING_KRA',
    'NEEDS_CHECK',
    'HELD_BY_KRA',
    'FISCALIZED',
    'FAILED',
    'CANCELLED'
));
