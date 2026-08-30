CREATE TABLE IF NOT EXISTS ai_rate_limit_buckets (
  bucket_key text PRIMARY KEY,
  bucket_type text NOT NULL
    CHECK (bucket_type IN ('conversation', 'ip')),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0
    CHECK (request_count >= 0),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_rate_limit_buckets_expires_idx
  ON ai_rate_limit_buckets (expires_at);

CREATE INDEX IF NOT EXISTS ai_rate_limit_buckets_type_updated_idx
  ON ai_rate_limit_buckets (
    bucket_type,
    updated_at DESC
  );
