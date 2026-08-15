ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS source text;

WITH raw_contacts AS (
  SELECT
    c.id,
    NULLIF(btrim(c.visitor_name), '') AS name,
    NULLIF(btrim(c.visitor_phone), '') AS original_phone,
    regexp_replace(COALESCE(c.visitor_phone, ''), '\\D', '', 'g') AS digits,
    c.updated_at
  FROM live_chat_conversations c
  WHERE c.customer_id IS NULL
    AND c.visitor_phone IS NOT NULL
), valid_contacts AS (
  SELECT
    id,
    name,
    original_phone,
    CASE
      WHEN digits ~ '^[78][0-9]{10}$' THEN '+7' || substr(digits, 2)
      WHEN digits ~ '^9[0-9]{9}$' THEN '+7' || digits
      ELSE NULL
    END AS normalized_phone,
    updated_at
  FROM raw_contacts
), latest_contacts AS (
  SELECT DISTINCT ON (normalized_phone)
    name, original_phone, normalized_phone
  FROM valid_contacts
  WHERE normalized_phone IS NOT NULL
  ORDER BY normalized_phone, updated_at DESC, id DESC
), synced_customers AS (
  INSERT INTO customers (name, original_phone, normalized_phone, source)
  SELECT name, original_phone, normalized_phone, 'ai_chat'
  FROM latest_contacts
  ON CONFLICT (normalized_phone) DO UPDATE SET
    name = CASE
      WHEN customers.name IS NULL OR btrim(customers.name) = '' THEN EXCLUDED.name
      ELSE customers.name
    END,
    original_phone = CASE
      WHEN customers.original_phone IS NULL OR btrim(customers.original_phone) = '' THEN EXCLUDED.original_phone
      ELSE customers.original_phone
    END,
    source = COALESCE(customers.source, EXCLUDED.source),
    updated_at = now()
  RETURNING id, normalized_phone
)
UPDATE live_chat_conversations conversation
SET customer_id = customer.id,
    updated_at = now()
FROM valid_contacts contact
JOIN synced_customers customer
  ON customer.normalized_phone = contact.normalized_phone
WHERE conversation.id = contact.id
  AND conversation.customer_id IS NULL
  AND contact.normalized_phone IS NOT NULL;
