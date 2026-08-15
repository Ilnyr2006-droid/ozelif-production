import { ArrowUpRight } from 'lucide-react'

import {
  catalogSeoLandings,
} from '../data/catalogSeoLandings'

export function CatalogSeoSubcategoryLinks({
  categorySlug,
}: {
  categorySlug: string
}) {
  const items =
    catalogSeoLandings.filter(
      item =>
        item.categorySlug === categorySlug,
    )

  if (!items.length) {
    return null
  }

  return (
    <section
      className="clothing-catalog-shell catalog-seo-subcategories"
      aria-labelledby={`catalog-subcategories-${categorySlug}`}
    >
      <header className="catalog-seo-subcategories-head">

        <div>
          <p className="kicker">
            Подборки
          </p>

          <h2
            id={`catalog-subcategories-${categorySlug}`}
          >
            Виды материала
          </h2>
        </div>

        <p>
          Быстрый переход к отдельным
          подборкам из актуального каталога.
        </p>

      </header>

      <div className="catalog-seo-subcategories-grid">

        {items.map(
          (
            item,
            index,
          ) => (
            <a
              className="catalog-seo-subcategory-card"
              href={item.path}
              key={item.path}
            >
              <span className="catalog-seo-subcategory-number">
                {String(index + 1).padStart(2, '0')}
              </span>

              <div>
                <small>
                  {item.badge}
                </small>

                <h3>
                  {item.title}
                </h3>
              </div>

              <span className="catalog-seo-subcategory-link">
                Смотреть
                <ArrowUpRight size={15}/>
              </span>
            </a>
          ),
        )}

      </div>
    </section>
  )
}
