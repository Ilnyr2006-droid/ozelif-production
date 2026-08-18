import { useEffect } from 'react'
import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { categories, external, telegram } from '../data'
import { Footer } from './Footer'
import { Header } from './Header'
import { WholesaleForm } from './WholesaleForm'

const raulWhatsapp = 'https://api.whatsapp.com/send/?app_absent=0&phone=79608818725&text=&type=phone_number'

const audiences = [
  ['Бренды одежды', 'Кожа, замша и дублёночный материал для коллекций и серийного пошива.'],
  ['Обувные производства', 'Обувная и отделочная кожа для производственных задач.'],
  ['Ателье', 'Подбор материала под изделие и требуемый объём закупки.'],
  ['Мастерские кожгалантереи', 'Галантерейная кожа и фурнитура для сумок, ремней и аксессуаров.'],
  ['Оптовые покупатели', 'Партии со склада для торговли кожевенным сырьём и снабжения производства.'],
]

const steps = [
  ['Оставить заявку', 'Заполните форму или свяжитесь с менеджером.'],
  ['Уточнить задачу и объём', 'Расскажите о категории материала и предполагаемой закупке.'],
  ['Получить подборку и условия', 'Менеджер предложит подходящие варианты и обсудит условия.'],
  ['Согласовать наличие и заказ', 'Можно посмотреть и выбрать подходящие пачки из партии.'],
  ['Оплата и доставка', 'Способ оплаты и отправки согласовывается для конкретного заказа.'],
]

const faq = [
  ['Какой минимальный объём оптовой закупки?', 'Оптовой считается покупка от одной пачки / 1000 дм² — в зависимости от вида кожи.'],
  ['Как рассчитывается оптовая скидка?', 'Размер снижения стоимости зависит от объёма закупки. Конкретные проценты на сайте не опубликованы и обсуждаются индивидуально.'],
  ['Можно ли проверить наличие до заказа?', 'На сайте заявлено большое количество товара на складе. Актуальное наличие конкретной кожи нужно подтвердить у менеджера.'],
  ['Как выполняется доставка?', 'Заказы отправляют из Москвы курьерами СДЭК по России и в другие страны. Для отправки в регионы РФ и другие страны указана 100% предоплата.'],
  ['Можно ли приехать и выбрать материал?', 'Да. Перед покупкой можно посмотреть и выбрать подходящие пачки из партии. Шоурум и склад находятся в Москве на Краснобогатырской улице, 24.'],
  ['Помогает ли менеджер подобрать материал?', 'Да. Сотрудники помогают выбрать вариант под задачу; рулоны при этом не делятся.'],
  ['Какие документы получают юридические лица?', 'Для юридических лиц доступна оплата переводом на расчётный счёт организации. Точный комплект закрывающих документов лучше подтвердить у менеджера перед оформлением заказа.'],
]

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  const node = document.querySelector<HTMLMetaElement>(selector) ?? document.head.appendChild(document.createElement('meta'))
  node.setAttribute(attribute, key)
  node.content = content
}

export function WholesalePage() {
  useEffect(() => {
    document.title = 'Кожа оптом в Москве — натуральная кожа, цены | OZELIF'
    setMeta('meta[name="description"]', 'name', 'description', 'Кожа оптом в Москве от OZELIF: натуральная одежная и обувная кожа, замша и дублёночный материал для брендов, ателье и производств. От одной пачки, цены и условия опта, подбор партии и доставка по России.')
    setMeta('meta[property="og:title"]', 'property', 'og:title', 'Кожа оптом в Москве — OZELIF')
    setMeta('meta[property="og:description"]', 'property', 'og:description', 'Натуральная кожа оптом со склада OZELIF в Москве: цены и условия опта, закупка от одной пачки, подбор партии и доставка по России.')
    setMeta('meta[property="og:url"]', 'property', 'og:url', 'https://ozelifkoja.ru/kozhaoptom')
    setMeta('meta[property="og:image"]', 'property', 'og:image', 'https://ozelifkoja.ru/images/about-supply.webp')
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]') ?? document.head.appendChild(document.createElement('link'))
    canonical.rel = 'canonical'
    canonical.href = 'https://ozelifkoja.ru/kozhaoptom'
  }, [])

  useEffect(() => {
    const nodes = document.querySelectorAll('.reveal')
    const observer = new IntersectionObserver(entries => entries.forEach(entry => entry.isIntersecting && entry.target.classList.add('is-visible')), { threshold: .1 })
    nodes.forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        '@id': 'https://ozelifkoja.ru/kozhaoptom#service',
        name: 'Кожа оптом в Москве — OZELIF',
        serviceType: 'Оптовые поставки натуральной кожи, замши и дублёночного материала',
        url: 'https://ozelifkoja.ru/kozhaoptom',
        provider: { '@id': 'https://ozelifkoja.ru/#store' },
        areaServed: [
          { '@type': 'City', name: 'Москва' },
          { '@type': 'Country', name: 'Россия' },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': 'https://ozelifkoja.ru/kozhaoptom#faq',
        mainEntity: faq.map(([name, text]) => ({
          '@type': 'Question',
          name,
          acceptedAnswer: { '@type': 'Answer', text },
        })),
      },
    ],
  }

  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}/><Header active="wholesale"/><main className="wholesale-page">
    <section className="about-hero wholesale-hero" id="top">
      <picture className="wholesale-hero-media"><source srcSet="/images/about-supply.avif" type="image/avif"/><img className="about-hero-image" src="/images/about-supply.webp" alt="Натуральная кожа и дублёночный материал для оптовых поставок" width="1672" height="941" fetchPriority="high"/></picture>
      <div className="about-hero-shade wholesale-hero-shade"/>
      <div className="about-hero-content wholesale-hero-content"><p className="eyebrow hero-in hero-in--1">Оптовые поставки • Москва</p><h1 className="hero-in hero-in--2">Натуральная кожа оптом{' '}<br/><em>в Москве</em></h1><p className="hero-in hero-in--3">Кожа оптом для брендов, ателье и производств: одежная и обувная кожа, замша, дублёночный материал и фурнитура со склада OZELIF. Оптовая закупка начинается от одной пачки; актуальные цены опубликованы в каталоге, условия зависят от материала и объёма партии.</p><div className="about-hero-actions hero-in hero-in--4"><a className="btn btn--accent" href="#wholesale-form">Получить оптовые условия</a><a className="text-link text-link--light" href={external('/odejnayakozha')}>Посмотреть каталог <ArrowUpRight size={17}/></a></div></div>
      <div className="about-hero-facts"><span><b>От 1 пачки</b> минимальный оптовый формат</span><span><b>Подбор партии</b> под задачу и объём</span><span><b>Москва</b> шоурум и склад</span><span><b>По России</b> отправка заказов</span></div>
      <a className="about-scroll" href="#wholesale-terms" aria-label="Перейти к оптовым условиям"><ArrowDown size={17}/></a>
    </section>

    <section className="wholesale-terms about-section" id="wholesale-terms"><div className="wholesale-terms-title reveal"><p className="kicker">01 — Оптовые условия</p><h2>Закупка<br/><em>начинается с пачки</em></h2><p>Минимальная оптовая закупка начинается от одной пачки. Для отдельных видов кожи ориентир составляет 1000 дм². Размер скидки зависит от объёма заказа и согласовывается индивидуально.</p></div><div className="wholesale-terms-list reveal"><div><b>1 пачка</b><span>минимальная оптовая закупка</span></div><div><b>1000 дм²</b><span>ориентир для опта в зависимости от вида кожи</span></div><div><b>Индивидуально</b><span>скидка обсуждается с учётом объёма</span></div><div><b>Со склада</b><span>можно посмотреть и выбрать пачки из партии</span></div><div><b>Подбор</b><span>менеджер помогает с выбором материала</span></div></div></section>

    <section className="wholesale-audience about-section"><div className="about-section-head reveal"><p className="kicker">02 — Для кого</p><h2>Материалы<br/><em>для реального производства</em></h2></div><div className="wholesale-audience-grid">{audiences.map(([title, copy], index) => <article className="reveal" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

    <section className="about-assortment about-section wholesale-catalog"><div className="about-assortment-intro reveal"><p className="kicker">03 — Ассортимент для опта</p><h2>По назначению.<br/><em>Под задачу.</em></h2><p>Все направления ведут в действующие категории каталога. Наличие конкретного материала подтвердит менеджер.</p><a className="btn btn--dark" href={external('/odejnayakozha')}>Открыть каталог <ArrowUpRight size={17}/></a></div><div className="about-assortment-list reveal">{categories.map((category, index) => <a href={external(category.href)} key={category.title}><span>0{index + 1}</span><b>{category.title}</b><ArrowUpRight size={20}/></a>)}</div></section>

    <section className="about-process about-section"><div className="about-section-head reveal"><p className="kicker">04 — Как оформить заказ</p><h2>От заявки<br/><em>к поставке</em></h2></div><ol className="about-steps">{steps.map(([title, copy], index) => <li className="reveal" key={title}><span>0{index + 1}</span><div><b>{title}</b><p>{copy}</p></div></li>)}</ol></section>

    <section className="wholesale-proof about-section"><div className="wholesale-proof-copy reveal"><p className="kicker">05 — Почему OZELIF</p><h2>Склад.<br/><em>Ассортимент.</em><br/>География.</h2><div className="wholesale-proof-list"><p><b>с 2011 года</b><span>работа с розничными и оптовыми клиентами</span></p><p><b>от одной пачки</b><span>минимальный формат оптовой закупки в зависимости от материала</span></p><p><b>Москва</b><span>шоурум и склад на Краснобогатырской улице, 24</span></p><p><b>Доставка по России</b><span>способ и стоимость отправки подтверждает менеджер для конкретного заказа</span></p></div></div><figure className="wholesale-proof-media reveal"><picture><source srcSet="/images/about-materials.avif" type="image/avif"/><img src="/images/about-materials.webp" alt="Образцы натуральной кожи в ассортименте OZELIF" width="1122" height="1402" loading="lazy" decoding="async"/></picture></figure></section>

    <section className="wholesale-request about-section"><WholesaleForm/><aside className="wholesale-manager reveal"><p className="kicker">Менеджер по заказам</p><h2>Рауль</h2><p>Менеджер. Оформление заказа и другие вопросы.</p><a className="wholesale-manager-phone" href="tel:+79608818725">+7 (960) 881-87-25</a><div><a className="btn btn--light" href={raulWhatsapp} target="_blank" rel="noreferrer">WhatsApp</a><a className="text-link text-link--light" href={telegram} target="_blank" rel="noreferrer">Telegram</a></div><small>Подтверждённые часы связи на сайте не опубликованы.</small></aside></section>

    <section className="wholesale-faq about-section"><div className="about-section-head reveal"><p className="kicker">06 — Вопросы и ответы</p><h2>Перед<br/><em>оптовым заказом</em></h2></div><div className="wholesale-faq-list reveal">{faq.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section>

    <section className="about-final"><div className="reveal"><p className="kicker">Оптовым клиентам</p><h2>Подберём материалы<br/><em>под ваше производство</em></h2><p>Оставьте заявку с примерным объёмом или напишите менеджеру напрямую.</p><div><a className="btn btn--light" href="#wholesale-form">Получить оптовые условия</a><a className="text-link text-link--light" href={raulWhatsapp} target="_blank" rel="noreferrer">Написать менеджеру <ArrowUpRight size={17}/></a></div></div></section>
  </main><Footer/></>
}
