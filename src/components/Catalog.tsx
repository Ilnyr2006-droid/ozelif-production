import { ArrowUpRight } from 'lucide-react'
import { useMemo } from 'react'
import { usePublicCatalogCategories } from '../hooks/usePublicCatalog'
import { defaultCatalogPresentation, presentCatalogCategory } from '../utils/catalogCategories'

export function Catalog() {
  const { data: publicCategories } = usePublicCatalogCategories()
  const categories = useMemo(() => {
    const visible = publicCategories?.filter(category => category.showOnHome).map(presentCatalogCategory)
    return visible?.length ? visible : defaultCatalogPresentation()
  }, [publicCategories])

  return <section className="section catalog" id="catalog"><div className="section-head reveal"><div><p className="kicker">01 — Ассортимент</p><h2>Материал задаёт<br/><em>характер вещи</em></h2></div><p>Подберите фактуру, цвет и назначение. Каталог разделён по производственному применению.</p></div><div className="category-grid">{categories.map((item, i) => <a className={`category category--${i + 1} reveal`} href={item.href} key={item.slug}><picture>{item.imageAvif && <source srcSet={item.imageAvif} type="image/avif"/>}<img src={item.image} alt={item.alt} width="1448" height="1086" loading="lazy" decoding="async" style={{ objectPosition: item.imagePosition }}/></picture><span className="category-overlay"/><span className="category-index">{String(i + 1).padStart(2, '0')}</span><span className="category-text"><b>{item.title}</b><small>{item.copy}</small></span><ArrowUpRight className="category-arrow"/></a>)}</div></section>
}
