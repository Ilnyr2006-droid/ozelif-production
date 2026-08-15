-- The public category was previously a static landing page. Register it in
-- PostgreSQL so it uses the same read-only catalog API as all other categories.
INSERT INTO categories (
  name,
  slug,
  description,
  cover_image,
  sort_order,
  is_published,
  show_on_home,
  show_in_menu
)
SELECT
  'Галантерейная кожа',
  'galantereynayakozha',
  'Материал для сумок, ремней, кошельков и малых кожаных изделий.',
  '/images/categories/leather-goods.webp',
  5,
  true,
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE slug = 'galantereynayakozha'
);
