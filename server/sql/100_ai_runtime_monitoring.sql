CREATE TABLE IF NOT EXISTS ai_runtime_events (
  id bigserial PRIMARY KEY,
  conversation_id uuid
    REFERENCES live_chat_conversations(id)
    ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'web',
  model text,
  prompt_version_id uuid
    REFERENCES ai_prompt_versions(id)
    ON DELETE SET NULL,
  prompt_version bigint,
  response_id text,
  intent text,
  catalog_search boolean NOT NULL DEFAULT false,
  latency_ms integer NOT NULL DEFAULT 0,
  input_tokens integer NOT NULL DEFAULT 0,
  cached_input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  reasoning_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(14,8) NOT NULL DEFAULT 0,
  fallback boolean NOT NULL DEFAULT false,
  empty_retry_count integer NOT NULL DEFAULT 0,
  incomplete_retry_count integer NOT NULL DEFAULT 0,
  recommendation_count integer NOT NULL DEFAULT 0,
  error_text text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_runtime_events_created_idx
  ON ai_runtime_events (created_at DESC);

CREATE INDEX IF NOT EXISTS ai_runtime_events_conversation_idx
  ON ai_runtime_events (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_runtime_events_channel_idx
  ON ai_runtime_events (channel, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_eval_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'passed', 'failed', 'aborted')),
  model text,
  prompt_version bigint,
  commit_sha text,
  scenario_count integer NOT NULL DEFAULT 0,
  passed_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  avg_latency_ms numeric(12,2) NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(14,8) NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ai_eval_runs_started_idx
  ON ai_eval_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS ai_eval_results (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL
    REFERENCES ai_eval_runs(id)
    ON DELETE CASCADE,
  scenario_key text NOT NULL,
  category text NOT NULL,
  passed boolean NOT NULL,
  latency_ms integer NOT NULL DEFAULT 0,
  reply text,
  checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_eval_results_run_idx
  ON ai_eval_results (run_id, id);
