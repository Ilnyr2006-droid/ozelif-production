-- Stage 2 ONLY. Draft migration: NOT applied to production.
-- Stores a non-identifying correlation key for *new* website_cart orders.
-- No changes to existing order records, checkout or historical attribution.
CREATE TABLE IF NOT EXISTS order_goal_correlations (
  order_id uuid PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  order_ref text NOT NULL UNIQUE CHECK (order_ref ~ '^[a-f0-9]{32}$'),
  delivery_state text NOT NULL DEFAULT 'claimed'
    CHECK (delivery_state IN ('claimed', 'observed', 'not_observed', 'ambiguous', 'duplicate_events')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Observed is not a verification of payment or paid campaign origin.
  provider_event_observed boolean NOT NULL DEFAULT false,
  CONSTRAINT order_goal_observation_state_consistent
    CHECK (provider_event_observed = false OR delivery_state = 'observed')
);
COMMENT ON TABLE order_goal_correlations IS
  'Stage-2 opaque checkout/Metrika correlation state. Never export order_id or order_ref via MCP.';
