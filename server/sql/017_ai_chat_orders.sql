ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'website_cart',
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_source_idempotency_key_unique
  ON orders (source, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS live_chat_order_drafts (
  conversation_id uuid PRIMARY KEY
    REFERENCES live_chat_conversations(id)
    ON DELETE CASCADE,

  status text NOT NULL DEFAULT 'collecting'
    CHECK (
      status IN (
        'collecting',
        'awaiting_confirmation',
        'awaiting_contact',
        'created',
        'cancelled'
      )
    ),

  items jsonb NOT NULL DEFAULT '[]'::jsonb,

  revision integer NOT NULL DEFAULT 0
    CHECK (revision >= 0),

  confirmed_revision integer,

  confirmed_at timestamptz,

  order_id uuid
    REFERENCES orders(id)
    ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS live_chat_order_drafts_status_idx
  ON live_chat_order_drafts (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS live_chat_order_drafts_order_idx
  ON live_chat_order_drafts (order_id)
  WHERE order_id IS NOT NULL;
