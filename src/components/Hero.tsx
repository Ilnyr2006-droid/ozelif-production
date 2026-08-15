import {
  ArrowDown,
  ArrowUpRight,
} from 'lucide-react'
import { external } from '../data'

export function Hero() {
  return (
    <section className="hero" id="top">
      <picture className="hero-picture">
        <source
          media="(max-width: 720px)"
          srcSet="/images/hero-leather-mobile.webp"
          type="image/webp"
          width={900}
          height={1200}
        />

        <source
          srcSet="/images/hero-leather-wide.webp"
          type="image/webp"
          width={1600}
          height={900}
        />

        <img
          className="hero-image"
          src="/images/hero-leather-wide.jpg"
          alt="Натуральная кожа разных оттенков OZELIF"
          width={1600}
          height={900}
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      </picture>

      <div className="hero-shade" />

      <div className="hero-content">
        <p className="eyebrow hero-in hero-in--1">
          Натуральные материалы • Москва
        </p>

        <h1 className="hero-in hero-in--2">
          Кожа, которая
          <br />
          <em>становится формой</em>
        </h1>

        <p className="hero-copy hero-in hero-in--3">
          Натуральная кожа и дублёночный материал
          от производителя — для одежды, обуви,
          галантереи и швейного производства.
        </p>

        <div className="hero-cta hero-in hero-in--4">
          <a
            className="btn btn--accent"
            href={external('/odejnayakozha')}
          >
            Перейти в каталог
            <ArrowUpRight size={17} />
          </a>

          <a
            className="text-link text-link--light"
            href="#contacts"
          >
            Подобрать материал
          </a>
        </div>
      </div>

      <div
        className="hero-facts"
        aria-label="Ключевые факты"
      >
        <span>
          <b>1000</b>
          вариантов в наличии
        </span>

        <span>
          <b>с 2011</b>
          розница и опт
        </span>

        <span>
          <b>Москва</b>
          шоурум и склад
        </span>
      </div>

      <a
        className="scroll-cue"
        href="#catalog"
        aria-label="Прокрутить к каталогу"
      >
        <ArrowDown size={17} />
      </a>
    </section>
  )
}
