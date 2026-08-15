CREATE TABLE IF NOT EXISTS manager_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  public_number bigint
    GENERATED ALWAYS AS IDENTITY
    UNIQUE,

  name text NOT NULL,
  phone text NOT NULL,
  normalized_phone text NOT NULL,

  comment text,

  source text NOT NULL
    DEFAULT 'manager_form',

  status text NOT NULL
    DEFAULT 'new'
    CHECK (
      status IN (
        'new',
        'contacted',
        'completed',
        'cancelled'
      )
    ),

  ip_address inet,
  user_agent text,
  page_path text,

  created_at timestamptz NOT NULL
    DEFAULT now(),

  updated_at timestamptz NOT NULL
    DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
  manager_leads_status_created_idx
ON manager_leads (
  status,
  created_at DESC
);

CREATE INDEX IF NOT EXISTS
  manager_leads_phone_idx
ON manager_leads (
  normalized_phone
);
