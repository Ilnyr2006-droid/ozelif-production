ALTER TABLE live_chat_conversations
  ADD COLUMN IF NOT EXISTS chat_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS product_interest_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_takeover_at timestamptz;

WITH first_messages AS (
  SELECT
    conversation_id,
    MIN(created_at) AS first_user_message_at
  FROM live_chat_messages
  WHERE role = 'user'
  GROUP BY conversation_id
)
UPDATE live_chat_conversations conversation
SET chat_started_at = first_messages.first_user_message_at
FROM first_messages
WHERE conversation.id = first_messages.conversation_id
  AND conversation.chat_started_at IS NULL;

UPDATE live_chat_conversations
SET product_interest_at = COALESCE(
  product_interest_at,
  contact_offer_shown_at,
  contact_captured_at,
  manager_requested_at,
  chat_started_at
)
WHERE product_interest_at IS NULL
  AND lead_intent IN ('product', 'wholesale', 'production');

UPDATE live_chat_conversations
SET manager_takeover_at = COALESCE(
  manager_takeover_at,
  last_message_at,
  updated_at
)
WHERE manager_takeover_at IS NULL
  AND assigned_admin_id IS NOT NULL
  AND status = 'human';

CREATE INDEX IF NOT EXISTS live_chat_funnel_started_idx
  ON live_chat_conversations (chat_started_at DESC)
  WHERE chat_started_at IS NOT NULL;
