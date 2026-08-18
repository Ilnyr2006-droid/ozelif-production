ALTER TABLE live_chat_conversations
  ADD COLUMN IF NOT EXISTS recommendation_clicked_at timestamptz;

CREATE TABLE IF NOT EXISTS live_chat_recommendation_clicks (
  id bigserial PRIMARY KEY,
  conversation_id uuid NOT NULL
    REFERENCES live_chat_conversations(id)
    ON DELETE CASCADE,
  message_id bigint
    REFERENCES live_chat_messages(id)
    ON DELETE SET NULL,
  product_id uuid
    REFERENCES products(id)
    ON DELETE SET NULL,
  href text NOT NULL DEFAULT '',
  clicked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS live_chat_recommendation_clicks_conversation_idx
  ON live_chat_recommendation_clicks (
    conversation_id,
    clicked_at DESC
  );

CREATE INDEX IF NOT EXISTS live_chat_recommendation_clicks_product_idx
  ON live_chat_recommendation_clicks (
    product_id,
    clicked_at DESC
  )
  WHERE product_id IS NOT NULL;
