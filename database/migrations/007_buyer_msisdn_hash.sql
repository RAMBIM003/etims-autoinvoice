-- SHA-256 of each buyer phone (254XXXXXXXXX form), matched against the
-- hashed MSISDN that Daraja sends in C2B callbacks.
ALTER TABLE buyer_phones ADD COLUMN IF NOT EXISTS msisdn_sha256 text;
CREATE INDEX IF NOT EXISTS idx_buyer_phones_msisdn_sha256 ON buyer_phones(msisdn_sha256);

-- M-Pesa name linking columns used by routes/buyerIdentity.js and buyerLinkService.js.
ALTER TABLE buyers
    ADD COLUMN IF NOT EXISTS mpesa_name text,
    ADD COLUMN IF NOT EXISTS mpesa_name_key text,
    ADD COLUMN IF NOT EXISTS mpesa_last3 text,
    ADD COLUMN IF NOT EXISTS mpesa_consent_at timestamptz;
