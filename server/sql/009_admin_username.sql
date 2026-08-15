ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS username text;

WITH owners AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at, id) AS number
  FROM admin_users
  WHERE role = 'owner'
    AND username IS NULL
)
UPDATE admin_users AS users
SET username = CASE
  WHEN owners.number = 1 THEN 'admin'
  ELSE 'admin_' || owners.number
END
FROM owners
WHERE users.id = owners.id;

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_username_lower_unique
  ON admin_users (lower(username))
  WHERE username IS NOT NULL;
