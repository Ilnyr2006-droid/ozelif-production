ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_email_snapshot text,
  ADD COLUMN IF NOT EXISTS customer_type text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS company_inn text,
  ADD COLUMN IF NOT EXISTS company_kpp text,
  ADD COLUMN IF NOT EXISTS company_legal_address text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS desired_delivery_date date,
  ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz;

DO $$
BEGIN
  ALTER TABLE orders
    ADD CONSTRAINT orders_customer_type_check
    CHECK (
      customer_type IS NULL
      OR customer_type IN (
        'individual',
        'legal'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE orders
    ADD CONSTRAINT orders_payment_method_check
    CHECK (
      payment_method IS NULL
      OR payment_method IN (
        'manager_invoice',
        'bank_transfer',
        'cash_on_pickup'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
