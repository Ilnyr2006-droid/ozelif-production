ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'material_request',
  ADD COLUMN IF NOT EXISTS price_status text NOT NULL DEFAULT 'preliminary',
  ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'pending_confirmation',
  ADD COLUMN IF NOT EXISTS final_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS manager_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_city text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'website_cart',
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE orders
  ADD CONSTRAINT orders_order_type_check CHECK (order_type IN ('material_request')),
  ADD CONSTRAINT orders_price_status_check CHECK (price_status IN ('preliminary','confirmed')),
  ADD CONSTRAINT orders_availability_status_check CHECK (availability_status IN ('pending_confirmation','confirmed','partially_available','unavailable'));

CREATE UNIQUE INDEX IF NOT EXISTS orders_source_idempotency_key_uidx
  ON orders(source, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS category_name_snapshot text;

CREATE TABLE IF NOT EXISTS order_item_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  previous_quantity numeric(14,3) NOT NULL,
  next_quantity numeric(14,3) NOT NULL,
  previous_price numeric(14,2),
  next_price numeric(14,2),
  comment text,
  changed_by_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
