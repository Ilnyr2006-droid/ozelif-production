ALTER TABLE live_chat_conversations
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS external_chat_id text,
  ADD COLUMN IF NOT EXISTS telegram_user_id text,
  ADD COLUMN IF NOT EXISTS telegram_chat_id text,
  ADD COLUMN IF NOT EXISTS telegram_username text,
  ADD COLUMN IF NOT EXISTS telegram_url text;

CREATE INDEX IF NOT EXISTS live_chat_conversations_channel_idx
  ON live_chat_conversations (channel);

CREATE UNIQUE INDEX IF NOT EXISTS live_chat_conversations_channel_external_uidx
  ON live_chat_conversations (channel, external_chat_id)
  WHERE external_chat_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS live_chat_conversations_telegram_user_idx
  ON live_chat_conversations (telegram_user_id)
  WHERE telegram_user_id IS NOT NULL;
