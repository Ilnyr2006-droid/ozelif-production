CREATE TABLE IF NOT EXISTS product_vector_index (
  product_id uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  openai_file_id text,
  vector_store_id text,
  content_hash text,
  indexed_product_updated_at timestamptz,
  sync_status text NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'syncing', 'synced', 'error')),
  last_synced_at timestamptz,
  last_error text,
  stale_file_ids text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_vector_sync_queue (
  product_id uuid PRIMARY KEY,
  operation text NOT NULL DEFAULT 'upsert'
    CHECK (operation IN ('upsert', 'delete')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  old_file_ids text[] NOT NULL DEFAULT '{}'::text[],
  last_error text,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_vector_sync_queue_ready_idx
  ON product_vector_sync_queue (status, available_at, updated_at);

CREATE OR REPLACE FUNCTION enqueue_product_vector_sync(
  target_product_id uuid,
  target_operation text DEFAULT 'upsert',
  inherited_file_ids text[] DEFAULT '{}'::text[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO product_vector_sync_queue (
    product_id,
    operation,
    status,
    attempts,
    available_at,
    old_file_ids,
    last_error,
    locked_at,
    created_at,
    updated_at
  )
  VALUES (
    target_product_id,
    target_operation,
    'pending',
    0,
    now(),
    COALESCE(inherited_file_ids, '{}'::text[]),
    NULL,
    NULL,
    now(),
    now()
  )
  ON CONFLICT (product_id) DO UPDATE
  SET
    operation = EXCLUDED.operation,
    status = 'pending',
    attempts = 0,
    available_at = now(),
    old_file_ids = ARRAY(
      SELECT DISTINCT file_id
      FROM unnest(
        COALESCE(product_vector_sync_queue.old_file_ids, '{}'::text[])
        || COALESCE(EXCLUDED.old_file_ids, '{}'::text[])
      ) AS file_id
      WHERE file_id IS NOT NULL AND file_id <> ''
    ),
    last_error = NULL,
    locked_at = NULL,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION queue_product_vector_after_product_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM enqueue_product_vector_sync(NEW.id, 'upsert', '{}'::text[]);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION queue_product_vector_before_product_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  known_file_ids text[];
BEGIN
  SELECT ARRAY(
    SELECT DISTINCT file_id
    FROM unnest(
      COALESCE(stale_file_ids, '{}'::text[])
      || ARRAY[openai_file_id]
    ) AS file_id
    WHERE file_id IS NOT NULL AND file_id <> ''
  )
  INTO known_file_ids
  FROM product_vector_index
  WHERE product_id = OLD.id;

  PERFORM enqueue_product_vector_sync(
    OLD.id,
    'delete',
    COALESCE(known_file_ids, '{}'::text[])
  );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS products_vector_after_change ON products;
CREATE TRIGGER products_vector_after_change
AFTER INSERT OR UPDATE OF
  category_id,
  name,
  slug,
  description,
  sku,
  primary_image,
  is_published,
  attributes,
  updated_at
ON products
FOR EACH ROW
EXECUTE FUNCTION queue_product_vector_after_product_change();

DROP TRIGGER IF EXISTS products_vector_before_delete ON products;
CREATE TRIGGER products_vector_before_delete
BEFORE DELETE ON products
FOR EACH ROW
EXECUTE FUNCTION queue_product_vector_before_product_delete();

CREATE OR REPLACE FUNCTION queue_product_vector_after_variant_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_id uuid;
BEGIN
  target_id := COALESCE(NEW.product_id, OLD.product_id);
  PERFORM enqueue_product_vector_sync(target_id, 'upsert', '{}'::text[]);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS product_variants_vector_after_change ON product_variants;
CREATE TRIGGER product_variants_vector_after_change
AFTER INSERT OR UPDATE OR DELETE ON product_variants
FOR EACH ROW
EXECUTE FUNCTION queue_product_vector_after_variant_change();

CREATE OR REPLACE FUNCTION queue_category_products_vector_after_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO product_vector_sync_queue (
    product_id,
    operation,
    status,
    attempts,
    available_at,
    old_file_ids,
    last_error,
    locked_at,
    created_at,
    updated_at
  )
  SELECT
    p.id,
    'upsert',
    'pending',
    0,
    now(),
    '{}'::text[],
    NULL,
    NULL,
    now(),
    now()
  FROM products p
  WHERE p.category_id = NEW.id
  ON CONFLICT (product_id) DO UPDATE
  SET
    operation = 'upsert',
    status = 'pending',
    attempts = 0,
    available_at = now(),
    last_error = NULL,
    locked_at = NULL,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS categories_vector_after_change ON categories;
CREATE TRIGGER categories_vector_after_change
AFTER UPDATE OF name, slug ON categories
FOR EACH ROW
EXECUTE FUNCTION queue_category_products_vector_after_change();

DO $$
BEGIN
  IF to_regclass('public.product_images') IS NOT NULL THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION queue_product_vector_after_image_change()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      DECLARE
        target_id uuid;
      BEGIN
        target_id := COALESCE(NEW.product_id, OLD.product_id);
        PERFORM enqueue_product_vector_sync(
          target_id,
          ''upsert'',
          ''{}''::text[]
        );
        RETURN COALESCE(NEW, OLD);
      END;
      $function$;
    ';

    EXECUTE 'DROP TRIGGER IF EXISTS product_images_vector_after_change
             ON product_images';

    EXECUTE '
      CREATE TRIGGER product_images_vector_after_change
      AFTER INSERT OR UPDATE OR DELETE ON product_images
      FOR EACH ROW
      EXECUTE FUNCTION queue_product_vector_after_image_change()
    ';
  END IF;
END;
$$;

INSERT INTO product_vector_sync_queue (
  product_id,
  operation,
  status,
  attempts,
  available_at,
  old_file_ids,
  created_at,
  updated_at
)
SELECT
  p.id,
  'upsert',
  'pending',
  0,
  now(),
  '{}'::text[],
  now(),
  now()
FROM products p
ON CONFLICT (product_id) DO UPDATE
SET
  operation = 'upsert',
  status = 'pending',
  attempts = 0,
  available_at = now(),
  last_error = NULL,
  locked_at = NULL,
  updated_at = now();
