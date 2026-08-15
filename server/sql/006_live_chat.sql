CREATE TABLE IF NOT EXISTS live_chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_token_hash text NOT NULL,
  visitor_id text,
  visitor_name text,
  visitor_phone text,
  page_path text,
  user_agent text,
  ip_address inet,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'human', 'closed')),
  ai_enabled boolean NOT NULL DEFAULT true,
  assigned_admin_id uuid REFERENCES admin_users(id)
    ON DELETE SET NULL,
  last_message_at timestamptz,
  last_read_by_admin_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS live_chat_conversations_activity_idx
  ON live_chat_conversations (
    status,
    last_message_at DESC NULLS LAST,
    created_at DESC
  );

CREATE INDEX IF NOT EXISTS live_chat_conversations_visitor_idx
  ON live_chat_conversations (visitor_id);

CREATE TABLE IF NOT EXISTS live_chat_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES live_chat_conversations(id)
    ON DELETE CASCADE,
  role text NOT NULL
    CHECK (role IN ('user', 'assistant', 'manager', 'system')),
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_admin_id uuid REFERENCES admin_users(id)
    ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS live_chat_messages_conversation_idx
  ON live_chat_messages (conversation_id, id);

CREATE INDEX IF NOT EXISTS live_chat_messages_created_idx
  ON live_chat_messages (created_at DESC);
