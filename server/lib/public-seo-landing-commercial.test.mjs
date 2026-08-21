import { describe, expect, it } from 'vitest'
import { renderCatalogSeoLandingPage } from './public-seo-landing.mjs'

const template = `<!doctype html><html><head><title>Cluster</title></head><body><div id="root"></div></body></html>`

const landing = {
  path: '/odejnayakozha/krs',
  categorySlug: 'odejnayakozha',
  categoryName: 'Одежная кожа',
  parentPath: '/odejnayakozha',
  title: 'Натуральная кожа КРС',
}

describe('commercial SEO cluster initial HTML', () => {
  it('adds commercial buyer content next to live products', () => {
    const html = renderCatalogSeoLandingPage(template, landing, [{
      id: 'p1',
      name: 'КРС Test',
      url: '/odejnayakozha/tproduct/p1-krs-test',
      attributes: {
        subtype: ['КРС'],
        material: 'КРС',
        color: 'Коричневый',
        thickness: '0,8',
      },
      variants: [{
        id: 'v1',
        price: 700,
        currency: 'RUB',
        unit: 'фут²',
        isActive: true,
      }],
    }])

    expect(html).toContain(
      'Цены и характеристики берутся из опубликованных карточек актуального каталога.',
    )
    expect(html).toContain('Купить натуральную кожу КРС в Москве')
    expect(html).toContain('href="/odejnayakozha"')
    expect(html).toContain('href="/kozhaoptom"')
    expect(html).toContain('href="/contacts"')
    expect(html).toContain('href="/delivery"')
    expect(html).toContain('/odejnayakozha/tproduct/p1-krs-test')
  })

  it.each([
    ['/odejnayakozha/krs', 'Натуральная кожа КРС', 'Купить натуральную кожу КРС в Москве'],
    ['/odejnayakozha/perforirovannaya', 'Перфорированная натуральная кожа', 'Купить перфорированную натуральную кожу в Москве'],
    ['/dublyonka/kerli', 'Дублёночный материал Кёрли', 'Купить дублёночный материал Кёрли в Москве'],
    ['/dublyonka/toskana', 'Дублёночный материал Тоскана', 'Купить дублёночный материал Тоскана в Москве'],
  ])('uses grammatically correct commercial purchase titles for %s', (route, title, expected) => {
    const html = renderCatalogSeoLandingPage(template, {
      ...landing,
      path: route,
      title,
      parentPath: route.startsWith('/dublyonka')
        ? '/dublyonka'
        : '/odejnayakozha',
    }, [{
      id: 'p-test',
      name: 'Test',
      url: `${route.split('/').slice(0, 2).join('/')}/tproduct/p-test`,
      attributes: {},
      variants: [{
        id: 'v-test',
        price: 100,
        currency: 'RUB',
        unit: 'шт.',
        isActive: true,
      }],
    }])

    expect(html).toContain(expected)
  })

})
