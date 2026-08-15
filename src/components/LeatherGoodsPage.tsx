import { ArrowUpRight } from 'lucide-react'
import { Footer } from './Footer'
import { Header } from './Header'

const uses = ['Сумки', 'Ремни', 'Кошельки и аксессуары']

export function LeatherGoodsPage() {
  return <>
    <Header active="catalog" />
    <main className="leather-goods-page">
      <section className="leather-goods-hero">
        <picture>
          <source srcSet="/images/categories/leather-goods.avif" type="image/avif" />
          <img src="/images/categories/leather-goods.webp" alt="Галантерейная кожа для сумок, ремней и аксессуаров" width="1448" height="1086" fetchPriority="high" decoding="async" />
        </picture>
        <div className="leather-goods-hero-scrim" />
        <div className="leather-goods-shell leather-goods-hero-copy">
          <nav className="clothing-catalog-breadcrumbs" aria-label="Хлебные крошки"><a href="/">Главная</a><span>/</span><span>Галантерейная кожа</span></nav>
          <p className="kicker">Каталог материалов</p>
          <h1>Галантерейная<br /><em>кожа</em></h1>
          <p>Материал для сумок, ремней, кошельков и малых кожаных изделий.</p>
          <div className="leather-goods-hero-actions">
            <a className="btn btn--light" href="/contacts">Подобрать материал <ArrowUpRight size={17} /></a>
            <a className="text-link text-link--light" href="/furnitura">Посмотреть фурнитуру <ArrowUpRight size={16} /></a>
          </div>
        </div>
      </section>

      <section className="leather-goods-shell leather-goods-content">
        <div className="leather-goods-intro">
          <p className="kicker">01 — Назначение</p>
          <h2>Кожа для деталей,<br /><em>которые служат долго</em></h2>
          <p>Подберите материал по фактуре, цвету и назначению вместе с менеджером OZELIF.</p>
        </div>
        <div className="leather-goods-uses" aria-label="Изделия из галантерейной кожи">
          {uses.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item}</strong></div>)}
        </div>
      </section>

      <section className="leather-goods-shell leather-goods-cta">
        <div>
          <p className="kicker">Нужна консультация?</p>
          <h2>Подберём материал<br /><em>под вашу задачу</em></h2>
        </div>
        <div className="leather-goods-cta-actions">
          <a className="btn btn--accent" href="/contacts">Связаться с менеджером <ArrowUpRight size={17} /></a>
          <a className="text-link" href="/furnitura">Перейти к фурнитуре <ArrowUpRight size={16} /></a>
        </div>
      </section>
    </main>
    <Footer />
  </>
}
