ALTER TABLE live_chat_order_drafts
  ADD COLUMN IF NOT EXISTS delivery_method text;

ALTER TABLE live_chat_order_drafts
  DROP CONSTRAINT IF EXISTS
    live_chat_order_drafts_delivery_method_check;

ALTER TABLE live_chat_order_drafts
  ADD CONSTRAINT
    live_chat_order_drafts_delivery_method_check
  CHECK (
    delivery_method IS NULL
    OR delivery_method IN ('pickup', 'courier')
  );
