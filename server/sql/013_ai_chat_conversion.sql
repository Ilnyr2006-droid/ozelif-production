ALTER TABLE live_chat_conversations
  ADD COLUMN IF NOT EXISTS manager_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_request_reason text,
  ADD COLUMN IF NOT EXISTS lead_intent text,
  ADD COLUMN IF NOT EXISTS lead_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contact_offer_shown_at timestamptz,
  ADD COLUMN IF NOT EXISTS contact_captured_at timestamptz;

ALTER TABLE live_chat_conversations
  DROP CONSTRAINT IF EXISTS live_chat_conversations_lead_score_check;

ALTER TABLE live_chat_conversations
  ADD CONSTRAINT live_chat_conversations_lead_score_check
  CHECK (lead_score >= 0 AND lead_score <= 100);

CREATE INDEX IF NOT EXISTS live_chat_manager_requested_idx
  ON live_chat_conversations (
    manager_requested_at DESC,
    lead_score DESC,
    last_message_at DESC
  )
  WHERE manager_requested_at IS NOT NULL
    AND status <> 'closed';
