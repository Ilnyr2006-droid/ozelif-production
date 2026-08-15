ALTER TABLE live_chat_messages
  ADD COLUMN IF NOT EXISTS client_message_id text;

CREATE UNIQUE INDEX IF NOT EXISTS live_chat_messages_conversation_client_message_id_key
  ON live_chat_messages (conversation_id, client_message_id)
  WHERE client_message_id IS NOT NULL;
