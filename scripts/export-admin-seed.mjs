
import fs from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'

const root = process.cwd()
const outputPath = path.resolve(root, process.argv[2] || 'data/admin-seed.json')

const categoryDefinitions = [
  {
    name: 'Одежная кожа',
    slug: 'odejnayakozha',
    path: '/odejnayakozha',
    module: '/src/data/clothingLeatherProducts.ts',
    exportName: 'clothingLeatherProducts',
    description: 'Мягкая натуральная кожа для одежды, головных уборов и аксессуаров.',
    coverImage: '/images/categories/clothing-leather.webp',
    sortOrder: 10,
  },
  {
    name: 'Дублёночный материал',
    slug: 'dublyonka',
    path: '/dublyonka',
    module: '/src/data/shearlingProducts.ts',
    exportName: 'shearlingProducts',
    description: 'Меринос, тоскана, керли и другие виды натурального мехового материала.',
    coverImage: '/images/categories/shearling-material.webp',
    sortOrder: 20,
  },
  {
    name: 'Замша',
    slug: 'zamsha',
    path: '/zamsha',
    module: '/src/data/suedeProducts.ts',
    exportName: 'suedeProducts',
    description: 'Натуральная замша для одежды, обуви и выразительных деталей.',
    coverImage: '/images/categories/suede.webp',
    sortOrder: 30,
  },
  {
    name: 'Обувная кожа',
    slug: 'obuvnayakozha',
    path: '/obuvnayakozha',
    module: '/src/data/shoeLeatherProducts.ts',
    exportName: 'shoeLeatherProducts',
    description: 'Натуральная кожа для верха обуви, деталей и небольших кожаных изделий.',
    coverImage: '/images/categories/shoe-leather.webp',
    sortOrder: 40,
  },
  {
    name: 'Фурнитура',
    slug: 'furnitura',
    path: '/furnitura',
    module: '/src/data/hardwareProducts.ts',
    exportName: 'hardwareProducts',
    description: 'Молнии, кнопки и комплектующие для изделий из кожи.',
    coverImage: '/images/categories/hardware.webp',
    sortOrder: 60,
  },
]

const categoryByName = new Map(categoryDefinitions.map(item => [item.name, item]))
const categoryBySlug = new Map(categoryDefinitions.map(item => [item.slug, item]))

// These products were audited against their two public offers. Their imported
// source omitted the unit label on both variants, causing the lower dm2 offer
// to inherit ft2. Keep this correction beside the seed conversion so a future
// re-import cannot recreate the production data defect fixed by migration 013.
const clothingDmUnitCorrections = new Set([
  '175006970682', '826043821932', '976103364862', '280430116192',
  '388127392912', '710729180752', '141464265472', '378521427732',
  '540828553512', '559967388212', '564770761822', '929713822342',
  '709019811212', '381247238812', '834445446772', '463601248272',
  '517203864232', '507312357492', '251904725252',
])

function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value, (_key, item) => {
    if (typeof item === 'bigint') return item.toString()
    if (typeof item === 'function' || typeof item === 'symbol') return undefined
    return item
  }))
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function resolveImage(value) {
  if (!value) return null
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = resolveImage(item)
      if (found) return found
    }
    return null
  }
  if (typeof value === 'object') {
    return firstString(
      value.card?.src,
      value.full?.src,
      value.src,
      value.url,
      value.image,
    )
  }
  return null
}

function primitiveAttributes(product) {
  const omitted = new Set([
    'id', 'slug', 'title', 'name', 'variants', 'image', 'legacyUrl',
    'sourcePrice', 'sourceOldPrice', 'priceRub', 'oldPriceRub',
  ])
  const result = {}

  for (const [key, value] of Object.entries(product || {})) {
    if (omitted.has(key) || value == null) continue

    if (['string', 'number', 'boolean'].includes(typeof value)) {
      result[key] = value
      continue
    }

    if (
      Array.isArray(value)
      && value.every(item => ['string', 'number', 'boolean'].includes(typeof item))
    ) {
      result[key] = value
    }
  }

  return result
}

function minPrice(variants, field, unit = null) {
  const values = variants
    .filter(variant => !unit || variant?.unit === unit)
    .map(variant => Number(variant?.[field]))
    .filter(value => Number.isFinite(value) && value > 0)
  return values.length ? Math.min(...values) : null
}

function commonUnit(variants) {
  const units = [...new Set(
    variants
      .map(variant => typeof variant?.unit === 'string' ? variant.unit.trim() : '')
      .filter(Boolean),
  )]
  return units.length === 1 ? units[0] : units[0] || null
}

const vite = await createServer({
  root,
  appType: 'custom',
  server: { middlewareMode: true },
  logLevel: 'error',
})

try {
  const catalogIndex = await vite.ssrLoadModule('/src/data/catalogIndex.ts')
  const normalizedProducts = catalogIndex.getAllProducts()

  const richById = new Map()

  for (const definition of categoryDefinitions) {
    const module = await vite.ssrLoadModule(definition.module)
    const products = module[definition.exportName]

    if (!Array.isArray(products)) {
      throw new Error(
        `${definition.module}: export ${definition.exportName} is not an array`,
      )
    }

    for (const product of products) {
      richById.set(String(product.id), {
        categorySlug: definition.slug,
        product: jsonSafe(product),
      })
    }
  }

  const categories = categoryDefinitions.map(definition => ({
    name: definition.name,
    slug: definition.slug,
    path: definition.path,
    description: definition.description,
    coverImage: definition.coverImage,
    sortOrder: definition.sortOrder,
    isPublished: true,
    showOnHome: true,
    showInMenu: true,
    filterConfig: [],
    sourceData: {
      source: 'static-catalog',
      sourceModule: definition.module,
      exportedAt: new Date().toISOString(),
    },
  }))

  const products = normalizedProducts.map(normalized => {
    const legacyId = String(normalized.id)
    const richRecord = richById.get(legacyId)
    const rich = richRecord?.product || {}
    const category = categoryByName.get(normalized.category)
      || categoryBySlug.get(richRecord?.categorySlug)

    if (!category) {
      throw new Error(
        `Не найдена категория для товара ${legacyId}: ${normalized.category}`,
      )
    }

    const variants = Array.isArray(normalized.variants)
      ? normalized.variants.map((variant, index) => ({
          legacyId: String(variant.id),
          name: firstString(variant.title, variant.shade, `Вариант ${index + 1}`),
          sku: null,
          price: Number.isFinite(Number(variant.priceRub))
            ? Number(variant.priceRub)
            : null,
          oldPrice: Number.isFinite(Number(variant.oldPriceRub))
            ? Number(variant.oldPriceRub)
            : null,
          unit: firstString(variant.unit),
          stockQuantity: null,
          sortOrder: index,
          isActive: true,
          attributes: {
            shade: variant.shade ?? null,
            shadeHex: variant.shadeHex ?? null,
            currency: variant.currency ?? null,
            priceSource: variant.priceSource ?? null,
          },
          sourceData: jsonSafe(variant),
        }))
      : []

    if (category.slug === 'odejnayakozha' && clothingDmUnitCorrections.has(legacyId)) {
      const lowerOffer = variants
        .filter(variant => Number.isFinite(variant.price) && variant.price > 0)
        .sort((left, right) => left.price - right.price)[0]
      if (lowerOffer?.unit === 'фут²') lowerOffer.unit = 'дм²'
    }

    const title = firstString(
      normalized.title,
      rich.title,
      rich.name,
      legacyId,
    )

    const unit = commonUnit(variants)

    return {
      legacyId,
      categorySlug: category.slug,
      name: title,
      slug: firstString(normalized.slug, rich.slug, legacyId),
      description: firstString(
        rich.description,
        rich.copy,
        category.description,
      ) || '',
      sku: firstString(rich.article, rich.sku, legacyId),
      basePrice: minPrice(variants, 'price', unit),
      oldPrice: minPrice(variants, 'oldPrice', unit),
      currency: 'RUB',
      unit,
      stockQuantity: null,
      minOrder: Number.isFinite(Number(rich.minimumOrder))
        ? Number(rich.minimumOrder)
        : null,
      attributes: primitiveAttributes(rich),
      primaryImage: resolveImage(normalized.image) || resolveImage(rich.image),
      seoTitle: `${title} — OZELIF`,
      seoDescription: firstString(
        rich.description,
        category.description,
      ),
      isPublished: true,
      sourceData: {
        source: 'static-catalog',
        normalized: jsonSafe(normalized),
        rich,
        importedAt: new Date().toISOString(),
      },
      variants,
    }
  })

  // В статическом магазине URL товара содержит legacy ID перед slug,
  // поэтому одинаковые slug допустимы. В PostgreSQL slug уникален внутри
  // каталога, поэтому для всех дублей добавляем стабильный legacy ID.
  const slugGroups = new Map()

  for (const product of products) {
    const key = `${product.categorySlug}::${product.slug}`
    const group = slugGroups.get(key) ?? []
    group.push(product)
    slugGroups.set(key, group)
  }

  const duplicateSlugGroups = []

  for (const [key, group] of slugGroups) {
    if (group.length < 2) continue

    group.sort((left, right) =>
      String(left.legacyId).localeCompare(String(right.legacyId)),
    )

    duplicateSlugGroups.push({
      key,
      products: group.map(product => ({
        legacyId: product.legacyId,
        originalSlug: product.slug,
      })),
    })

    for (const product of group) {
      product.slug = `${product.slug}-${product.legacyId}`
    }
  }

  const uniqueKeys = new Set()

  for (const product of products) {
    const key = `${product.categorySlug}::${product.slug}`

    if (uniqueKeys.has(key)) {
      throw new Error(`После нормализации остался повтор slug: ${key}`)
    }

    uniqueKeys.add(key)
  }

  const seed = {
    version: 1,
    generatedAt: new Date().toISOString(),
    categories,
    products,
    statistics: {
      categories: categories.length,
      products: products.length,
      variants: products.reduce((sum, product) => sum + product.variants.length, 0),
      productsWithoutImage: products.filter(product => !product.primaryImage).length,
      productsWithoutVariants: products.filter(product => !product.variants.length).length,
    },
  }

  if (!seed.products.length) {
    throw new Error('Экспорт остановлен: не найдено ни одного товара')
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify(seed, null, 2) + '\n')

  console.log(`Seed создан: ${outputPath}`)
  console.log(seed.statistics)
} finally {
  await vite.close()
}
