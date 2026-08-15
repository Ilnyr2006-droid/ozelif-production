import { categories as defaultCategories } from '../data'
import type { PublicCatalogCategory } from '../api/publicCatalog'

export type CatalogPresentation = {
  slug: string
  title: string
  href: string
  image: string
  imageAvif?: string
  imagePosition: string
  alt: string
  copy: string
}

const knownPresentation = new Map(defaultCategories.map(item => [item.href.slice(1), item]))

function fallbackPresentation(category: PublicCatalogCategory): CatalogPresentation {
  const image = category.coverImage || '/images/hero-leather-wide.jpg'
  return {
    slug: category.slug,
    title: category.name,
    href: `/${category.slug}`,
    image,
    imagePosition: 'center',
    alt: category.name,
    copy: category.description || 'Материалы OZELIF для работы с натуральной кожей.',
  }
}

export function presentCatalogCategory(category: PublicCatalogCategory): CatalogPresentation {
  const known = knownPresentation.get(category.slug)
  if (!known) return fallbackPresentation(category)
  return {
    slug: category.slug,
    title: category.name,
    href: `/${category.slug}`,
    image: category.coverImage || known.image,
    imageAvif: category.coverImage ? undefined : known.imageAvif,
    imagePosition: known.imagePosition,
    alt: known.alt,
    copy: category.description || known.copy,
  }
}

export function defaultCatalogPresentation(): CatalogPresentation[] {
  return defaultCategories.map(item => ({
    slug: item.href.slice(1),
    title: item.title,
    href: item.href,
    image: item.image,
    imageAvif: item.imageAvif,
    imagePosition: item.imagePosition,
    alt: item.alt,
    copy: item.copy,
  }))
}
