CREATE TABLE IF NOT EXISTS telegram_admin_link_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telegram_admin_link_tokens_active_idx
  ON telegram_admin_link_tokens(token_hash, expires_at)
  WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS telegram_admin_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  telegram_user_id bigint NOT NULL UNIQUE,
  telegram_chat_id bigint NOT NULL,
  telegram_username text,
  is_active boolean NOT NULL DEFAULT true,
  verified_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telegram_admin_subscriptions_active_idx
  ON telegram_admin_subscriptions(is_active, telegram_chat_id)
  WHERE is_active = true AND revoked_at IS NULL;

UPDATE notification_outbox
SET
  status = 'skipped',
  processed_at = now(),
  last_error = 'admin_phone_notifications_not_enabled_at_event_time'
WHERE channel = 'admin'
  AND status IN ('pending', 'processing')
  AND created_at < now();
