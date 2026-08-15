ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS filter_config jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS seo_title text;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS seo_description text;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS source_data jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS legacy_id text;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS seo_title text;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS seo_description text;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS source_data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS products_legacy_id_uidx
  ON products(legacy_id)
  WHERE legacy_id IS NOT NULL;

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS legacy_id text;

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS source_data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_legacy_id_uidx
  ON product_variants(legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_images_product_id_idx
  ON product_images(product_id);

CREATE UNIQUE INDEX IF NOT EXISTS product_images_product_url_uidx
  ON product_images(product_id, url);
