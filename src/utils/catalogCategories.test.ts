import { describe, expect, it } from 'vitest'
import { presentCatalogCategory } from './catalogCategories'

describe('catalog category presentation', () => {
  it('keeps a dynamically added published category local and visible', () => {
    expect(presentCatalogCategory({
      databaseId: 'category-id',
      slug: 'mebelnaya-kozha',
      name: 'Мебельная кожа',
      description: 'Для обивки мебели.',
      coverImage: '/uploads/mebelnaya.webp',
      filterConfig: null,
      seoTitle: null,
      seoDescription: null,
      showOnHome: true,
      showInMenu: true,
    })).toMatchObject({
      href: '/mebelnaya-kozha',
      image: '/uploads/mebelnaya.webp',
      title: 'Мебельная кожа',
    })
  })

  it('keeps the known AVIF when the API cover is the canonical known WebP', () => {
    expect(presentCatalogCategory({
      databaseId: 'known-category-id',
      slug: 'odejnayakozha',
      name: 'Одежная кожа',
      description: 'Одежная кожа.',
      coverImage: '/images/categories/clothing-leather.webp',
      filterConfig: null,
      seoTitle: null,
      seoDescription: null,
      showOnHome: true,
      showInMenu: true,
    })).toMatchObject({
      image: '/images/categories/clothing-leather.webp',
      imageAvif: '/images/categories/clothing-leather.avif',
    })
  })
})
