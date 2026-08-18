import { useEffect } from 'react'
import { ArrowDown, ArrowUpRight, MapPin } from 'lucide-react'
import { external, telegram } from '../data'
import { Footer } from './Footer'
import { Header } from './Header'
import { SewingProductionForm } from './SewingProductionForm'

const emiliaWhatsapp = 'https://api.whatsapp.com/send/?phone=79033707854&type=phone_number&app_absent=0'

const directions = [
  ['Кожаная верхняя одежда', 'Производство называет своим основным направлением сложную верхнюю одежду из натуральной кожи.'],
  ['Текстильные изделия', 'Текстильное направление развивается на производстве с 2023 года.'],
  ['Деним', 'Производство также принимает серийные задачи по изделиям из денима.'],
]

const capabilities = [
  ['Работа по лекалам', 'В работу принимаются лекала на плотном электрокартоне, предпочтительно в оцифрованном виде.'],
  ['Подготовка лекал', 'Можно заказать перенос готовых лекал на плотный электрокартон.'],
  ['Первый образец', 'Для каждой новой модели производство обязательно шьёт первый образец.'],
  ['Серийный пошив', 'Минимальный объём — 10 изделий одной модели; допускается до двух цветов.'],
  ['Подбор комплектации', 'К модели предлагают варианты кожи и фурнитуры из ассортимента OZELIF или под заказ.'],
]

const steps = [
  ['Знакомство', 'Обсуждаем модель по образцу, фотографии или техническому заданию.'],
  ['Материал и лекала', 'Подбираем кожу и фурнитуру, проверяем готовность лекал к работе.'],
  ['Первый образец', 'Образец помогает проверить конструкцию, расход материала и сложность пошива.'],
  ['Согласование', 'Клиент знакомится с образцом; при необходимости вносятся корректировки.'],
  ['Размещение партии', 'Согласовываются количество, комплектация, дата запуска и предполагаемая отгрузка.'],
  ['Приёмка', 'Дата приёмки согласовывается с менеджером; готовую партию клиент забирает самостоятельно.'],
]

const materials = [
  ['Одежная кожа в Москве', '/odejnayakozha'],
  ['Дублёночный материал', '/dublyonka'],
  ['Замша', '/zamsha'],
  ['Галантерейная кожа', '/galantereynayakozha'],
  ['Фурнитура', '/furnitura'],
]

const clients = [
  ['Бренды', 'Производство работает с брендами премиум- и мидл-ап сегмента и помогает размещать серийные модели.'],
  ['Новые марки', 'Для запуска первой партии можно обсудить конструкцию модели, материал и подготовку лекал.'],
  ['Оптовые заказчики', 'Крупнооптовые партии вне масс-маркета планируются и согласовываются заранее.'],
]

const gallery = [
  ['/images/production/workshop-01.jpg', 'Реальная фотография изделия с производства OZELIF'],
  ['/images/production/workshop-02.jpg', 'Реальная фотография работы швейного производства OZELIF'],
  ['/images/production/workshop-03.jpg', 'Реальная фотография готового изделия OZELIF'],
  ['/images/production/workshop-04.jpg', 'Реальная фотография деталей изделия OZELIF'],
  ['/images/production/workshop-05.jpg', 'Реальная фотография изделия из архива производства OZELIF'],
]

const faq = [
  ['Какие изделия шьёт производство?', 'На старой странице подтверждено производство сложной кожаной верхней одежды, а также развитие текстильного и джинсового направлений. Перечень конкретных моделей согласовывается до размещения заказа.'],
  ['Можно ли работать с материалом клиента?', 'Нет. На старой странице указано, что производство работает исключительно на собственном сырье, приобретённом у «Озелиф Кожа».'],
  ['Какой минимальный тираж?', 'Минимальный заказ — 10 изделий одной модели. В рамках модели допускается до двух цветов, размеры не ограничены.'],
  ['Можно ли заказать один экземпляр?', 'Индивидуальные заказы производство не принимает. Первый экземпляр шьют только как обязательный образец перед серийной партией.'],
  ['Как рассчитывается стоимость?', 'Ориентировочную стоимость образца называют после оценки модели. После пошива образца рассчитывают расход материалов и точную стоимость одной единицы в партии с учётом сложности и времени работы.'],
  ['Какие сроки производства?', 'Образец изготавливается от 4 до 10 рабочих дней. Средний срок изготовления партии — от 2 до 6 недель и зависит от сезонности и текущей загрузки.'],
  ['Можно ли приехать на производство?', 'Производственная зона закрыта для свободного посещения. Визит возможен только по предварительному согласованию.'],
]

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  const node = document.querySelector<HTMLMetaElement>(selector) ?? document.head.appendChild(document.createElement('meta'))
  node.setAttribute(attribute, key)
  node.content = content
}

export function SewingProductionPage() {
  useEffect(() => {
    document.title = 'Швейное производство в Москве — пошив одежды | OZELIF'
    setMeta('meta[name="description"]', 'name', 'description', 'Швейное производство OZELIF в Москве: серийный пошив одежды и изделий из натуральной кожи для брендов. От 10 изделий одной модели, первый образец, лекала, подбор кожи и фурнитуры.')
    setMeta('meta[property="og:title"]', 'property', 'og:title', 'Швейное производство в Москве — OZELIF')
    setMeta('meta[property="og:description"]', 'property', 'og:description', 'Серийный пошив одежды и изделий из натуральной кожи для брендов в Москве: первый образец, лекала и партии от 10 изделий одной модели.')
    setMeta('meta[property="og:url"]', 'property', 'og:url', 'https://ozelifkoja.ru/production')
    setMeta('meta[property="og:image"]', 'property', 'og:image', 'https://ozelifkoja.ru/images/production-workshop.webp')
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]') ?? document.head.appendChild(document.createElement('link'))
    canonical.rel = 'canonical'
    canonical.href = 'https://ozelifkoja.ru/production'
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
        '@id': 'https://ozelifkoja.ru/production#service',
        name: 'Швейное производство в Москве — OZELIF',
        serviceType: 'Серийный пошив одежды и изделий из натуральной кожи для брендов',
        url: 'https://ozelifkoja.ru/production',
        provider: { '@id': 'https://ozelifkoja.ru/#store' },
        areaServed: [
          { '@type': 'City', name: 'Москва' },
          { '@type': 'Country', name: 'Россия' },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': 'https://ozelifkoja.ru/production#faq',
        mainEntity: faq.map(([name, text]) => ({
          '@type': 'Question',
          name,
          acceptedAnswer: { '@type': 'Answer', text },
        })),
      },
    ],
  }

  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}/><Header active="production"/><main className="sewing-page">
    <section className="about-hero sewing-hero" id="top">
      <picture className="sewing-hero-media"><source srcSet="/images/production-workshop.avif" type="image/avif"/><img className="about-hero-image" src="/images/production-workshop.webp" alt="Рабочий стол швейного производства с кожей, лекалами и инструментами" width="1672" height="941" fetchPriority="high"/></picture>
      <div className="about-hero-shade sewing-hero-shade"/>
      <div className="about-hero-content sewing-hero-content"><p className="eyebrow hero-in hero-in--1">Серийный пошив • Москва</p><h1 className="hero-in hero-in--2">Швейное производство{' '}<br/><em>в Москве</em></h1><p className="hero-in hero-in--3">Серийный пошив одежды и изделий из натуральной кожи для брендов: работа по готовым лекалам, подбор материала и фурнитуры, обязательный первый образец и партии от 10 изделий одной модели.</p><div className="about-hero-actions hero-in hero-in--4"><a className="btn btn--accent" href="#production-form">Обсудить заказ</a><a className="text-link text-link--light" href="#production-materials">Посмотреть материалы <ArrowUpRight size={17}/></a></div></div>
      <a className="about-scroll" href="#production-directions" aria-label="Перейти к направлениям производства"><ArrowDown size={17}/></a>
    </section>

    <section className="sewing-directions about-section" id="production-directions"><div className="about-section-head reveal"><p className="kicker">01 — Что производим</p><h2>Сложные изделия.<br/><em>Серийный подход.</em></h2></div><div className="sewing-direction-grid">{directions.map(([title, copy], index) => <article className="reveal" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

    <section className="sewing-capabilities about-section"><div className="sewing-capabilities-copy reveal"><p className="kicker">02 — Возможности</p><h2>Модель должна быть<br/><em>готова к серии</em></h2><p>Работа начинается с лекал и обязательного первого образца. Это позволяет проверить конструкцию, расход материала и технологию до размещения партии.</p></div><div className="sewing-capabilities-list reveal">{capabilities.map(([title, copy], index) => <div key={title}><span>0{index + 1}</span><b>{title}</b><p>{copy}</p></div>)}</div></section>

    <section className="about-process about-section sewing-process"><div className="about-section-head reveal"><p className="kicker">03 — Как проходит работа</p><h2>От знакомства<br/><em>к готовой партии</em></h2></div><ol className="about-steps sewing-steps">{steps.map(([title, copy], index) => <li className="reveal" key={title}><span>0{index + 1}</span><div><b>{title}</b><p>{copy}</p></div></li>)}</ol></section>

    <section className="about-assortment about-section sewing-materials" id="production-materials"><div className="about-assortment-intro reveal"><p className="kicker">04 — Материалы OZELIF</p><h2>Материал<br/><em>из своего ассортимента</em></h2><p>Производство принимает в работу только сырьё OZELIF. Подходящий вид кожи и фурнитуру для модели подтверждает специалист.</p><a className="btn btn--dark" href="#production-form">Подобрать материал <ArrowUpRight size={17}/></a></div><div className="about-assortment-list reveal">{materials.map(([title, href], index) => <a href={external(href)} key={title}><span>0{index + 1}</span><b>{title}</b><ArrowUpRight size={20}/></a>)}</div></section>

    <section className="about-audience about-section sewing-clients"><div className="about-section-head reveal"><p className="kicker">05 — Для кого</p><h2>Производственный партнёр<br/><em>для брендов</em></h2></div><div className="about-audience-list">{clients.map(([title, copy], index) => <article className="reveal" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div><p className="sewing-client-note reveal">Индивидуальные заказы и единичные изделия производство не принимает.</p></section>

    <section className="sewing-gallery about-section"><div className="about-section-head reveal"><p className="kicker">06 — Примеры работ</p><h2>Из архива<br/><em>производства</em></h2></div><div className="sewing-gallery-grid">{gallery.map(([src, alt], index) => <figure className={`reveal sewing-gallery-item sewing-gallery-item--${index + 1}`} key={src}><img src={src} alt={alt} loading="lazy" decoding="async"/><figcaption>Фото с действующей страницы производства OZELIF</figcaption></figure>)}</div></section>

    <section className="sewing-proof"><picture><source srcSet="/images/about-supply.avif" type="image/avif"/><img src="/images/about-supply.webp" alt="Натуральная кожа из ассортимента OZELIF" width="1672" height="941" loading="lazy" decoding="async"/></picture><div className="sewing-proof-shade"/><div className="sewing-proof-copy reveal"><p className="kicker">07 — Подтверждённые преимущества</p><h2>Производство<br/><em>внутри экосистемы OZELIF</em></h2><div><p><b>С 2020 года</b><span>работает собственное швейное производство полного цикла</span></p><p><b>Москва</b><span>город размещения производства</span></p><p><b>Сырьё OZELIF</b><span>кожа и фурнитура подбираются из собственного ассортимента или под заказ</span></p><p><b>Конфиденциальность</b><span>лекала и техническая документация не передаются третьим лицам</span></p></div></div></section>

    <section className="sewing-request about-section"><SewingProductionForm/><aside className="sewing-contact reveal" id="production-contacts"><p className="kicker">Контакт производства</p><h2>Эмилия</h2><p>Операционный директор. Вопросы по размещению производственного заказа.</p><a className="wholesale-manager-phone" href="tel:+79033707854">+7 (903) 370-78-54</a><div><a className="btn btn--light" href={emiliaWhatsapp} target="_blank" rel="noreferrer">WhatsApp</a><a className="text-link text-link--light" href={telegram} target="_blank" rel="noreferrer">Telegram</a></div><div className="sewing-contact-address"><MapPin size={18}/><span>Москва, Краснобогатырская улица, 24</span></div><a className="text-link text-link--light" href="https://yandex.ru/maps/org/ozelif_kozha/1130318238/" target="_blank" rel="noreferrer">Построить маршрут <ArrowUpRight size={17}/></a><small>Режим работы производства на старой странице не опубликован.</small></aside></section>

    <section className="wholesale-faq about-section sewing-faq"><div className="about-section-head reveal"><p className="kicker">08 — Вопросы и ответы</p><h2>До размещения<br/><em>заказа</em></h2></div><div className="wholesale-faq-list reveal">{faq.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section>

    <section className="about-final sewing-final"><div className="reveal"><p className="kicker">Запуск модели</p><h2>Обсудим изделие<br/><em>и будущую партию</em></h2><p>Подготовьте фотографию, физический образец или техническое задание и свяжитесь с производством.</p><div><a className="btn btn--light" href="#production-form">Обсудить заказ</a><a className="text-link text-link--light" href={emiliaWhatsapp} target="_blank" rel="noreferrer">Написать в WhatsApp <ArrowUpRight size={17}/></a></div></div></section>
  </main><Footer/></>
}
