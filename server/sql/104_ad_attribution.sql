CREATE TABLE IF NOT EXISTS ad_attribution (
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  attribution jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id)
);
CREATE TABLE IF NOT EXISTS metrika_purchase_outbox (
  order_id uuid PRIMARY KEY REFERENCES orders(id),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','uncertain','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
