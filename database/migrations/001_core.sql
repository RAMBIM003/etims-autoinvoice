-- Pass 1 (identity) and Pass 2 (KRA / M-Pesa connections). UUID keys, timestamptz, CHECK-constrained statuses.
CREATE TABLE users(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text UNIQUE,
 full_name text NOT NULL,
 password_hash text NOT NULL,
 phone_hash text UNIQUE,
 phone_encrypted text,
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','SUSPENDED','CLOSED')),
 last_login_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE otp_verifications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 destination_hash text NOT NULL,
 purpose text NOT NULL,
 otp_hash text NOT NULL,
 expires_at timestamptz NOT NULL,
 verified_at timestamptz,
 attempt_count int NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','VERIFIED','USED','LOCKED')),
 created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX idx_otp_lookup ON otp_verifications(destination_hash,purpose,created_at DESC);
CREATE TABLE merchants(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 trading_name text NOT NULL,
 kra_pin text NOT NULL UNIQUE,
 taxpayer_name text,
 taxpayer_type text,
 kra_status text,
 business_phone text,
 business_type text,
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','SUSPENDED','CLOSED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE merchant_users(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role text NOT NULL DEFAULT 'OWNER' CHECK(role IN('OWNER','MANAGER','ACCOUNTANT','CASHIER')),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','INVITED','REMOVED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(merchant_id,user_id));
CREATE TABLE merchant_branches(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
 branch_code text NOT NULL,
 branch_name text NOT NULL,
 kra_bhf_id text NOT NULL,
 is_head_office boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'ACTIVE',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(merchant_id,kra_bhf_id));
CREATE TABLE merchant_onboarding(
 merchant_id uuid PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
 current_step text NOT NULL,
 status text NOT NULL DEFAULT 'IN_PROGRESS' CHECK(status IN('NOT_STARTED','IN_PROGRESS','COMPLETED','BLOCKED')),
 updated_at timestamptz NOT NULL DEFAULT now());
-- Only the status lives here. The CMC key, device serial and branch come from the server .env for the POC.
CREATE TABLE kra_connections(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 merchant_id uuid NOT NULL UNIQUE REFERENCES merchants(id) ON DELETE CASCADE,
 branch_id uuid REFERENCES merchant_branches(id),
 environment text NOT NULL,
 kra_pin text NOT NULL,
 bhf_id text NOT NULL,
 status text NOT NULL DEFAULT 'NOT_CONNECTED' CHECK(status IN('NOT_CONNECTED','CONNECTED','ERROR')),
 last_verified_at timestamptz,
 last_result text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE mpesa_connections(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
 connection_type text NOT NULL CHECK(connection_type IN('PAYBILL','TILL')),
 environment text NOT NULL,
 business_shortcode text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','ACTIVE','ERROR')),
 callback_registration_status text NOT NULL DEFAULT 'PENDING' CHECK(callback_registration_status IN('PENDING','REGISTERED','FAILED')),
 callback_error text,
 callback_registered_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE buyers(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
 kra_pin text NOT NULL UNIQUE,
 kra_taxpayer_name text NOT NULL,
 kra_taxpayer_type text,
 kra_pin_status text,
 consent_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now());
-- Several phones per PIN. phone_hash is an HMAC used to match C2B callbacks; phone_encrypted is for sending SMS.
CREATE TABLE buyer_phones(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 buyer_id uuid NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
 phone_hash text NOT NULL UNIQUE,
 phone_encrypted text NOT NULL,
 verified_at timestamptz,
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','UNLINKED')),
 created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE kra_pin_verifications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 subject_type text NOT NULL CHECK(subject_type IN('PRE_REGISTRATION','MERCHANT','BUYER')),
 subject_id uuid,
 kra_pin text NOT NULL,
 result_code text,
 result_message text,
 taxpayer_name text,
 taxpayer_type text,
 pin_status text,
 raw_response jsonb,
 created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE consent_records(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 subject_type text NOT NULL,
 subject_id uuid,
 purpose text NOT NULL,
 policy_version text NOT NULL,
 action text NOT NULL CHECK(action IN('GRANTED','WITHDRAWN')),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 withdrawn_at timestamptz);
CREATE TABLE mpesa_transactions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 trans_id text NOT NULL UNIQUE,
 merchant_id uuid REFERENCES merchants(id),
 business_shortcode text,
 bill_ref_number text,
 amount numeric(14,2),
 trans_time timestamptz,
 payer_ref text,
 payer_name text,
 raw_callback jsonb,
 callback_received_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX idx_mpesa_ref ON mpesa_transactions(merchant_id,bill_ref_number);
