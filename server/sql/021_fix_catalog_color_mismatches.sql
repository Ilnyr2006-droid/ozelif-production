WITH corrections(legacy_id, expected_name, color, normalized_color) AS (
  VALUES
    ('151420435072', 'Дубленочный материал Izlanda Black', 'Черный', 'Чёрный'),
    ('431965052732', 'Дубленочный материал Кёрли "Eskitme Grey"', 'Серый', 'Серый'),
    ('401467042172', 'Дубленочный материал Меринос "Black"', 'Черный', 'Чёрный'),
    ('538989828242', 'Дубленочный материал Тоскана "Brown"', 'Коричневый', 'Коричневый')
)
UPDATE products AS product
SET
  attributes = jsonb_set(
    jsonb_set(COALESCE(product.attributes, '{}'::jsonb), '{color}', to_jsonb(correction.color), true),
    '{normalizedColor}',
    to_jsonb(correction.normalized_color),
    true
  ),
  source_data = CASE
    WHEN jsonb_typeof(product.source_data) = 'object' THEN jsonb_set(
      jsonb_set(product.source_data, '{rich,color}', to_jsonb(correction.color), true),
      '{rich,normalizedColor}',
      to_jsonb(correction.normalized_color),
      true
    )
    ELSE product.source_data
  END,
  updated_at = NOW()
FROM corrections AS correction
WHERE product.legacy_id = correction.legacy_id
  AND product.name = correction.expected_name;

UPDATE product_variants AS variant
SET
  name = replace(variant.name, 'Оттенок коричневого', 'Оттенок серого'),
  attributes = jsonb_set(
    jsonb_set(COALESCE(variant.attributes, '{}'::jsonb), '{shade}', to_jsonb('Оттенок серого'::text), true),
    '{shadeHex}',
    to_jsonb('#808080'::text),
    true
  ),
  source_data = CASE
    WHEN jsonb_typeof(variant.source_data) = 'object' THEN jsonb_set(
      jsonb_set(
        jsonb_set(variant.source_data, '{shade}', to_jsonb('Оттенок серого'::text), true),
        '{shadeHex}',
        to_jsonb('#808080'::text),
        true
      ),
      '{title}',
      to_jsonb(replace(COALESCE(variant.source_data->>'title', variant.name), 'Оттенок коричневого', 'Оттенок серого')),
      true
    )
    ELSE variant.source_data
  END,
  updated_at = NOW()
FROM products AS product
WHERE variant.product_id = product.id
  AND product.legacy_id = '431965052732'
  AND product.name = 'Дубленочный материал Кёрли "Eskitme Grey"';
