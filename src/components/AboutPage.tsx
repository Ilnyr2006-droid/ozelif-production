import { useEffect } from 'react'
import { ArrowDown, ArrowUpRight, MapPin } from 'lucide-react'
import { contacts, external, telegram, whatsapp } from '../data'
import { Footer } from './Footer'
import { Header } from './Header'
import { Reviews } from './Reviews'

const assortment = [
  ['Одежная кожа в Москве', '/odejnayakozha'],
  ['Дублёночный материал', '/dublyonka'],
  ['Замша', '/zamsha'],
  ['Обувная кожа', '/obuvnayakozha'],
  ['Галантерейная кожа', '/galantereynayakozha'],
  ['Фурнитура', '/furnitura'],
]

const audiences = [
  ['Частные мастера и дизайнеры', 'Помогаем сориентироваться в фактурах и назначении материала для конкретного изделия.'],
  ['Ателье и производства', 'Подбираем кожу, замшу и дублёночный материал под задачи одежды, обуви и галантереи.'],
  ['Оптовые клиенты', 'Предлагаем выбор партий со склада; условия закупки зависят от вида и объёма материала.'],
]

const steps = [
  ['Обращение', 'Позвоните или напишите менеджеру.'],
  ['Задача', 'Расскажите, что планируете изготовить.'],
  ['Подбор', 'Менеджер поможет сузить выбор материала.'],
  ['Согласование', 'Посмотрите варианты в шоуруме или согласуйте их с менеджером.'],
  ['Заказ', 'Оформите покупку и выберите подходящий вариант доставки.'],
]

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  const node = document.querySelector<HTMLMetaElement>(selector) ?? document.head.appendChild(document.createElement('meta'))
  node.setAttribute(attribute, key)
  node.content = content
}

export function AboutPage() {
  useEffect(() => {
    document.title = 'О компании OZELIF — натуральная кожа и материалы в Москве'
    setMeta('meta[name="description"]', 'name', 'description', 'OZELIF — натуральная кожа, замша и дублёночный материал в Москве. С 2011 года, розница и опт, шоурум и поставки по России.')
    setMeta('meta[property="og:title"]', 'property', 'og:title', 'О компании OZELIF — натуральная кожа в Москве')
    setMeta('meta[property="og:description"]', 'property', 'og:description', 'Материалы для мастеров, ателье, производств и оптовых клиентов. Работаем с 2011 года.')
    setMeta('meta[property="og:url"]', 'property', 'og:url', 'https://ozelifkoja.ru/kozhaozelif')
    setMeta('meta[property="og:image"]', 'property', 'og:image', 'https://ozelifkoja.ru/images/hero-leather-wide.jpg')
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]') ?? document.head.appendChild(document.createElement('link'))
    canonical.rel = 'canonical'
    canonical.href = 'https://ozelifkoja.ru/kozhaozelif'
  }, [])

  useEffect(() => {
    const nodes = document.querySelectorAll('.reveal')
    const observer = new IntersectionObserver(entries => entries.forEach(entry => entry.isIntersecting && entry.target.classList.add('is-visible')), { threshold: .12 })
    nodes.forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  const schema = { '@context': 'https://schema.org', '@type': 'AboutPage', name: 'О компании OZELIF', url: 'https://ozelifkoja.ru/kozhaozelif', about: { '@type': 'Organization', name: 'OZELIF', telephone: '+7-903-370-78-54', address: { '@type': 'PostalAddress', addressLocality: 'Москва', streetAddress: 'Краснобогатырская улица, 24', addressCountry: 'RU' } } }

  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}/><Header active="about"/><main className="about-main">
    <section className="about-hero" id="top">
      <img className="about-hero-image" src="/images/hero-leather-wide.jpg" alt="Натуральная кожа разных оттенков в ассортименте OZELIF" fetchPriority="high"/>
      <div className="about-hero-shade"/>
      <div className="about-hero-content">
        <p className="eyebrow hero-in hero-in--1">О компании</p>
        <h1 className="hero-in hero-in--2">Натуральная кожа.<br/><em>Работа с материалом</em><br/>с 2011 года.</h1>
        <p className="hero-in hero-in--3">OZELIF работает с натуральной кожей, замшей и дублёночным материалом для частных мастеров, ателье, производств и оптовых клиентов.</p>
        <div className="about-hero-actions hero-in hero-in--4"><a className="btn btn--accent" href={external('/odejnayakozha')}>Перейти в каталог <ArrowUpRight size={17}/></a><a className="text-link text-link--light" href="#about-contacts">Подобрать материал</a></div>
      </div>
      <div className="about-hero-facts" aria-label="Подтверждённые факты"><span><b>с 2011</b> года</span><span><b>≈1000</b> вариантов</span><span><b>Москва</b> склад и шоурум</span><span><b>Розница</b> и опт</span></div>
      <a className="about-scroll" href="#about-story" aria-label="Перейти к разделу о компании"><ArrowDown size={17}/></a>
    </section>

    <section className="about-story about-section" id="about-story">
      <div className="about-story-copy reveal"><p className="kicker">01 — OZELIF</p><h2>Материал для вещи,<br/><em>которая задумана вами</em></h2><p>OZELIF — магазин и склад натуральной кожи в Москве. Компания занимается производством и продажей натуральной кожи в разных фактурах и цветах, а также предлагает замшу, дублёночный материал и фурнитуру.</p><p>С материалами работают частные покупатели, дизайнеры, ателье, производители одежды и обуви, а также клиенты, которым нужны оптовые партии.</p></div>
      <figure className="about-media reveal"><picture><source srcSet="/images/about-materials.avif" type="image/avif"/><img src="/images/about-materials.webp" alt="Натуральная кожа тёплых коричневых и бежевых оттенков" width="1122" height="1402" loading="lazy" decoding="async"/></picture></figure>
    </section>

    <section className="about-facts about-section" aria-labelledby="about-facts-title"><div className="about-section-head reveal"><p className="kicker">02 — В цифрах и фактах</p><h2 id="about-facts-title">Работаем с материалом<br/><em>и реальными задачами</em></h2></div><div className="about-facts-list reveal"><div><b>2011</b><span>год начала работы с розничными и оптовыми клиентами</span></div><div><b>≈1000</b><span>вариантов кожи и дублёночного материала заявлено в наличии</span></div><div><b>Розница<br/>и опт</b><span>форматы работы, указанные компанией</span></div><div><b>Россия<br/>и ближнее зарубежье</b><span>география поставок, указанная OZELIF</span></div></div></section>

    <section className="about-assortment about-section"><div className="about-assortment-intro reveal"><p className="kicker">03 — Ассортимент</p><h2>По назначению.<br/><em>По характеру.</em></h2><p>Каталог разделён по применению материала — так проще перейти сразу к нужному направлению.</p><a className="btn btn--dark" href={external('/odejnayakozha')}>Перейти в каталог <ArrowUpRight size={17}/></a></div><div className="about-assortment-list reveal">{assortment.map(([title, href], index) => <a href={external(href)} key={title}><span>0{index + 1}</span><b>{title}</b><ArrowUpRight size={20}/></a>)}</div></section>

    <section className="about-supply"><picture className="about-supply-media"><source srcSet="/images/about-supply.avif" type="image/avif"/><img src="/images/about-supply.webp" alt="Натуральная кожа и дублёночный материал тёплых оттенков" width="1672" height="941" loading="lazy" decoding="async"/></picture><div className="about-supply-shade"/><div className="about-supply-copy reveal"><p className="kicker">04 — Производители и поставки</p><h2>Материалы<br/><em>для разных задач</em></h2><p>OZELIF предлагает натуральную кожу и дублёночный материал от производителей. Ассортимент поступает на московский склад; перед оптовой покупкой можно посмотреть и выбрать подходящие пачки из партии.</p><p>Статус официального или эксклюзивного представителя на этой странице не заявляется: отдельного подтверждающего документа в открытых материалах не найдено.</p></div></section>

    <section className="about-audience about-section"><div className="about-section-head reveal"><p className="kicker">05 — Для кого работаем</p><h2>От одного изделия<br/><em>до партии</em></h2></div><div className="about-audience-list">{audiences.map(([title, copy], index) => <article className="reveal" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

    <section className="about-process about-section"><div className="about-section-head reveal"><p className="kicker">06 — Как проходит работа</p><h2>От запроса<br/><em>к выбранному материалу</em></h2></div><ol className="about-steps">{steps.map(([title, copy], index) => <li className="reveal" key={title}><span>0{index + 1}</span><div><b>{title}</b><p>{copy}</p></div></li>)}</ol></section>

    <section className="about-contact about-section" id="about-contacts"><div className="about-contact-copy reveal"><p className="kicker">07 — Шоурум и контакты</p><h2>Посмотрите кожу<br/><em>в Москве</em></h2><div className="about-address"><MapPin/><div><b>Краснобогатырская улица, 24</b><span>Москва. Адрес указан на актуальных страницах «Контакты» и «Доставка и оплата».</span></div></div><div className="about-contact-people">{contacts.slice(1).map(contact => <div key={contact.phone}><a href={contact.href}>{contact.phone}</a><small>{contact.name} / {contact.role}</small></div>)}</div><div className="about-contact-links"><a className="btn btn--dark" href="https://yandex.ru/maps/org/ozelif_kozha/1130318238/" target="_blank" rel="noreferrer">Построить маршрут <ArrowUpRight size={17}/></a><a className="text-link" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a><a className="text-link" href={telegram} target="_blank" rel="noreferrer">Telegram</a></div></div><figure className="about-contact-media reveal"><picture><source srcSet="/images/production-workshop.avif" type="image/avif"/><img src="/images/production-workshop.webp" alt="Рабочий стол с кожей и инструментами в мастерской" width="1672" height="941" loading="lazy" decoding="async"/></picture></figure></section>

    <Reviews/>

    <section className="about-final"><div className="reveal"><p className="kicker">Подбор материала</p><h2>Найдём кожу<br/><em>под вашу задачу</em></h2><p>Расскажите менеджеру, что планируете изготовить, или перейдите в каталог и начните с нужной категории.</p><div><a className="btn btn--light" href="#about-contacts">Подобрать материал</a><a className="text-link text-link--light" href={external('/odejnayakozha')}>Перейти в каталог <ArrowUpRight size={17}/></a></div></div></section>
  </main><Footer/></>
}
