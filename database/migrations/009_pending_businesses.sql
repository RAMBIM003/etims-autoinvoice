-- Business details captured at sign-up. The merchant row (which needs a KRA PIN)
-- is created later, when the business connects KRA eTIMS in onboarding.
CREATE TABLE IF NOT EXISTS pending_businesses (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    trading_name text NOT NULL,
    business_phone text,
    business_type text,
    created_at timestamptz NOT NULL DEFAULT now()
);
