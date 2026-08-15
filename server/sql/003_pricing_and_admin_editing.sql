
CREATE TABLE IF NOT EXISTS store_pricing_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  markup_percent numeric(8,3) NOT NULL DEFAULT 10,
  usd_rate numeric(14,6),
  rate_date date,
  rate_source text NOT NULL DEFAULT 'CBR',
  auto_update boolean NOT NULL DEFAULT true,
  last_checked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO store_pricing_settings (id, markup_percent, auto_update)
VALUES (true, 10, true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS fx_rate_history (
  id bigserial PRIMARY KEY,
  currency text NOT NULL,
  rate numeric(14,6) NOT NULL,
  nominal integer NOT NULL DEFAULT 1,
  rate_date date NOT NULL,
  source text NOT NULL DEFAULT 'CBR',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(currency, rate_date, source)
);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS source_price_usd numeric(14,4);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS source_old_price_usd numeric(14,4);

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS source_price_usd numeric(14,4);

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS source_old_price_usd numeric(14,4);

UPDATE product_variants
   SET source_price_usd = CASE
         WHEN source_data->>'sourcePrice' ~ '^[0-9]+([.,][0-9]+)?$'
         THEN replace(source_data->>'sourcePrice', ',', '.')::numeric
         ELSE source_price_usd
       END,
       source_old_price_usd = CASE
         WHEN source_data->>'sourceOldPrice' ~ '^[0-9]+([.,][0-9]+)?$'
         THEN replace(source_data->>'sourceOldPrice', ',', '.')::numeric
         ELSE source_old_price_usd
       END
 WHERE source_price_usd IS NULL
    OR source_old_price_usd IS NULL;

UPDATE products p
   SET source_price_usd = COALESCE(
         p.source_price_usd,
         (
           SELECT min(v.source_price_usd)
             FROM product_variants v
            WHERE v.product_id = p.id
              AND v.source_price_usd IS NOT NULL
         )
       ),
       source_old_price_usd = COALESCE(
         p.source_old_price_usd,
         (
           SELECT min(v.source_old_price_usd)
             FROM product_variants v
            WHERE v.product_id = p.id
              AND v.source_old_price_usd IS NOT NULL
         )
       );
