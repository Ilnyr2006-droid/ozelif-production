CREATE TABLE IF NOT EXISTS ai_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  content text NOT NULL,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  archived_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_prompt_one_published_idx
  ON ai_prompt_versions ((status))
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS ai_prompt_versions_created_idx
  ON ai_prompt_versions (created_at DESC);

CREATE TABLE IF NOT EXISTS ai_prompt_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_version_id uuid REFERENCES ai_prompt_versions(id)
    ON DELETE SET NULL,
  action text NOT NULL
    CHECK (action IN ('draft_created', 'published', 'rollback_published')),
  actor text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
