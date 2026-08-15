import { ArrowUpRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { usePublicCatalogCategories } from '../hooks/usePublicCatalog'
import {
  defaultCatalogPresentation,
  presentCatalogCategory,
  type CatalogPresentation,
} from '../utils/catalogCategories'

const categoryPlaceholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1448" height="1086" viewBox="0 0 1448 1086"%3E%3Crect width="1448" height="1086" fill="%23d8d0c5"/%3E%3C/svg%3E'

function CategoryImage({ item }: { item: CatalogPresentation }) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    if (typeof IntersectionObserver !== 'function') {
      setShouldLoad(true)
      return undefined
    }

    const node = imageRef.current
    if (!node) return undefined

    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      setShouldLoad(true)
      observer.disconnect()
    }, { rootMargin: '120px 0px' })

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <picture>
      {shouldLoad && item.imageAvif && (
        <source srcSet={item.imageAvif} type="image/avif"/>
      )}
      <img
        ref={imageRef}
        src={shouldLoad ? item.image : categoryPlaceholder}
        alt={item.alt}
        width="1448"
        height="1086"
        loading={shouldLoad ? 'eager' : 'lazy'}
        fetchPriority="low"
        decoding="async"
        style={{ objectPosition: item.imagePosition }}
      />
    </picture>
  )
}

export function Catalog() {
  const { data: publicCategories } = usePublicCatalogCategories()
  const categories = useMemo(() => {
    const visible = publicCategories?.filter(category => category.showOnHome).map(presentCatalogCategory)
    return visible?.length ? visible : defaultCatalogPresentation()
  }, [publicCategories])

  return <section className="section catalog" id="catalog"><div className="section-head reveal"><div><p className="kicker">01 — Ассортимент</p><h2>Материал задаёт<br/><em>характер вещи</em></h2></div><p>Подберите фактуру, цвет и назначение. Каталог разделён по производственному применению.</p></div><div className="category-grid">{categories.map((item, i) => <a className={`category category--${i + 1} reveal`} href={item.href} key={item.slug}><CategoryImage item={item}/><span className="category-overlay"/><span className="category-index">{String(i + 1).padStart(2, '0')}</span><span className="category-text"><b>{item.title}</b><small>{item.copy}</small></span><ArrowUpRight className="category-arrow"/></a>)}</div></section>
}
