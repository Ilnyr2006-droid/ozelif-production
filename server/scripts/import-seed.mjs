
import fs from 'node:fs/promises'
import path from 'node:path'
import { pool, transaction } from '../lib/db.mjs'

const inputPath = path.resolve(
  process.cwd(),
  process.argv[2] || '../data/admin-seed.json',
)

const seed = JSON.parse(await fs.readFile(inputPath, 'utf8'))

if (!Array.isArray(seed.categories) || !Array.isArray(seed.products)) {
  throw new Error('Некорректный seed: отсутствуют categories или products')
}

const result = await transaction(async client => {
  const categoryIds = new Map()
  let categoriesUpserted = 0
  let productsUpserted = 0
  let variantsUpserted = 0
  let imagesUpserted = 0

  for (const category of seed.categories) {
    const categoryResult = await client.query(
      `INSERT INTO categories
        (name, slug, description, cover_image, sort_order, is_published,
         show_on_home, show_in_menu, filter_config, seo_title,
         seo_description, source_data)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (slug) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         cover_image = excluded.cover_image,
         sort_order = excluded.sort_order,
         is_published = excluded.is_published,
         show_on_home = excluded.show_on_home,
         show_in_menu = excluded.show_in_menu,
         filter_config = excluded.filter_config,
         seo_title = coalesce(categories.seo_title, excluded.seo_title),
         seo_description = coalesce(categories.seo_description, excluded.seo_description),
         source_data = excluded.source_data,
         updated_at = now()
       RETURNING id`,
      [
        category.name,
        category.slug,
        category.description ?? '',
        category.coverImage ?? null,
        Number(category.sortOrder ?? 0),
        category.isPublished !== false,
        category.showOnHome !== false,
        category.showInMenu !== false,
        category.filterConfig ?? [],
        category.seoTitle ?? `${category.name} — OZELIF`,
        category.seoDescription ?? category.description ?? '',
        category.sourceData ?? {},
      ],
    )

    categoryIds.set(category.slug, categoryResult.rows[0].id)
    categoriesUpserted += 1
  }

  for (const product of seed.products) {
    const categoryId = categoryIds.get(product.categorySlug)
    if (!categoryId) {
      throw new Error(
        `Для товара ${product.legacyId} не найдена категория ${product.categorySlug}`,
      )
    }

    const productResult = await client.query(
      `INSERT INTO products
        (legacy_id, category_id, name, slug, description, sku, base_price,
         old_price, currency, unit, stock_quantity, min_order, attributes,
         primary_image, seo_title, seo_description, is_published, source_data)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (legacy_id) WHERE legacy_id IS NOT NULL DO UPDATE SET
         category_id = excluded.category_id,
         name = excluded.name,
         slug = excluded.slug,
         description = excluded.description,
         sku = excluded.sku,
         base_price = excluded.base_price,
         old_price = excluded.old_price,
         currency = excluded.currency,
         unit = excluded.unit,
         stock_quantity = coalesce(products.stock_quantity, excluded.stock_quantity),
         min_order = excluded.min_order,
         attributes = excluded.attributes,
         primary_image = excluded.primary_image,
         seo_title = excluded.seo_title,
         seo_description = excluded.seo_description,
         is_published = excluded.is_published,
         source_data = excluded.source_data,
         updated_at = now()
       RETURNING id`,
      [
        product.legacyId,
        categoryId,
        product.name,
        product.slug,
        product.description ?? '',
        product.sku ?? null,
        product.basePrice ?? null,
        product.oldPrice ?? null,
        product.currency ?? 'RUB',
        product.unit ?? null,
        product.stockQuantity ?? null,
        product.minOrder ?? null,
        product.attributes ?? {},
        product.primaryImage ?? null,
        product.seoTitle ?? null,
        product.seoDescription ?? null,
        product.isPublished !== false,
        product.sourceData ?? {},
      ],
    )

    const productId = productResult.rows[0].id
    productsUpserted += 1

    if (product.primaryImage) {
      await client.query(
        `INSERT INTO product_images (product_id, url, alt, sort_order)
         VALUES ($1,$2,$3,0)
         ON CONFLICT (product_id, url) DO UPDATE SET
           alt = excluded.alt,
           sort_order = excluded.sort_order`,
        [productId, product.primaryImage, product.name],
      )
      imagesUpserted += 1
    }

    for (const variant of product.variants ?? []) {
      await client.query(
        `INSERT INTO product_variants
          (legacy_id, product_id, name, sku, price, old_price, unit,
           stock_quantity, attributes, is_active, sort_order, source_data)
         VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (legacy_id) WHERE legacy_id IS NOT NULL DO UPDATE SET
           product_id = excluded.product_id,
           name = excluded.name,
           sku = excluded.sku,
           price = excluded.price,
           old_price = excluded.old_price,
           unit = excluded.unit,
           stock_quantity = coalesce(product_variants.stock_quantity, excluded.stock_quantity),
           attributes = excluded.attributes,
           is_active = excluded.is_active,
           sort_order = excluded.sort_order,
           source_data = excluded.source_data,
           updated_at = now()`,
        [
          variant.legacyId,
          productId,
          variant.name,
          variant.sku ?? null,
          variant.price ?? null,
          variant.oldPrice ?? null,
          variant.unit ?? null,
          variant.stockQuantity ?? null,
          variant.attributes ?? {},
          variant.isActive !== false,
          Number(variant.sortOrder ?? 0),
          variant.sourceData ?? {},
        ],
      )
      variantsUpserted += 1
    }
  }

  await client.query(
    `INSERT INTO audit_log
      (action, entity_type, entity_id, before_data, after_data)
     VALUES ('import', 'catalog_seed', $1, NULL, $2)`,
    [
      String(seed.generatedAt ?? new Date().toISOString()),
      {
        categories: categoriesUpserted,
        products: productsUpserted,
        variants: variantsUpserted,
        images: imagesUpserted,
      },
    ],
  )

  return {
    categories: categoriesUpserted,
    products: productsUpserted,
    variants: variantsUpserted,
    images: imagesUpserted,
  }
})

console.log('Импорт завершён:', result)
await pool.end()
