-- Correct a confirmed import defect: for these clothing-leather products the
-- lower-priced dm2 offer was imported with the same ft2 unit as the primary
-- offer. The guards below keep the update limited to the audited two-offer
-- pattern and make the migration safe to re-run.
WITH affected_products(legacy_id) AS (
  VALUES
    ('175006970682'), ('826043821932'), ('976103364862'),
    ('280430116192'), ('388127392912'), ('710729180752'),
    ('141464265472'), ('378521427732'), ('540828553512'),
    ('559967388212'), ('564770761822'), ('929713822342'),
    ('709019811212'), ('381247238812'), ('834445446772'),
    ('463601248272'), ('517203864232'), ('507312357492'),
    ('251904725252')
), candidates AS (
  SELECT
    p.id AS product_id,
    (
      SELECT v.id
      FROM product_variants v
      WHERE v.product_id = p.id AND v.is_active = true
      ORDER BY v.price ASC NULLS LAST, v.sort_order DESC, v.id
      LIMIT 1
    ) AS lower_variant_id
  FROM products p
  JOIN categories c ON c.id = p.category_id
  JOIN affected_products affected ON affected.legacy_id = p.legacy_id
  WHERE c.slug = 'odejnayakozha'
    AND (
      SELECT count(*)
      FROM product_variants v
      WHERE v.product_id = p.id
        AND v.is_active = true
        AND v.price > 0
        AND v.unit = 'фут²'
    ) = 2
    AND (
      SELECT max(v.price) / NULLIF(min(v.price), 0)
      FROM product_variants v
      WHERE v.product_id = p.id AND v.is_active = true AND v.price > 0
    ) BETWEEN 8 AND 11
)
UPDATE product_variants variant
SET unit = 'дм²', updated_at = now()
FROM candidates
WHERE variant.id = candidates.lower_variant_id
  AND variant.unit = 'фут²';

-- Keep the product-level offer paired with its primary (first sorted) active
-- variant. Public product cards may still show the lower variant as "from",
-- but never with the primary variant's unit.
WITH affected_products(legacy_id) AS (
  VALUES
    ('175006970682'), ('826043821932'), ('976103364862'),
    ('280430116192'), ('388127392912'), ('710729180752'),
    ('141464265472'), ('378521427732'), ('540828553512'),
    ('559967388212'), ('564770761822'), ('929713822342'),
    ('709019811212'), ('381247238812'), ('834445446772'),
    ('463601248272'), ('517203864232'), ('507312357492'),
    ('251904725252')
), primary_offers AS (
  SELECT DISTINCT ON (p.id)
    p.id AS product_id,
    v.price,
    v.old_price,
    v.unit
  FROM products p
  JOIN categories c ON c.id = p.category_id
  JOIN affected_products affected ON affected.legacy_id = p.legacy_id
  JOIN product_variants v ON v.product_id = p.id AND v.is_active = true
  WHERE c.slug = 'odejnayakozha' AND v.price > 0
  ORDER BY p.id, v.sort_order, v.created_at, v.id
)
UPDATE products product
SET
  base_price = primary_offers.price,
  old_price = primary_offers.old_price,
  unit = primary_offers.unit,
  updated_at = now()
FROM primary_offers
WHERE product.id = primary_offers.product_id;
