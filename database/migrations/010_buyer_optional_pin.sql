-- A buyer's KRA PIN is optional (only needed for a PIN on the receipt, e.g. VAT claims).
-- The unique constraint stays: Postgres allows many NULLs under it.
ALTER TABLE buyers ALTER COLUMN kra_pin DROP NOT NULL;
