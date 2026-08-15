import { ArrowUpRight, Clock3, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { Footer } from './Footer'
import { Header } from './Header'
import { telegram, whatsapp } from '../data'

const team = [
  {
    name: 'Элхан',
    role: 'Руководитель',
    description: 'По вопросам сотрудничества, жалоб и предложений',
    phone: '+7 985 280-84-84',
    href: 'tel:+79852808484',
    socials: [],
  },
  {
    name: 'Рауль',
    role: 'Менеджер',
    description: 'По оформлению заказа и другим вопросам',
    phone: '+7 960 881-87-25',
    href: 'tel:+79608818725',
    socials: [
      { label: 'WhatsApp', href: 'https://api.whatsapp.com/send/?app_absent=0&phone=79608818725&text=&type=phone_number' },
      { label: 'Telegram', href: 'https://t.me/ozelifleather' },
      { label: 'MAX', href: 'https://max.ru/join/mOjqqa5jy4M69QdlhrUgug2wQc77xXw4sSJHkQycDQE' },
    ],
  },
  {
    name: 'Эмилия',
    role: 'Менеджер',
    description: 'Консультации по ассортименту, наличию и доставке',
    phone: '+7 903 370-78-54',
    href: 'tel:+79033707854',
    socials: [
      { label: 'WhatsApp', href: 'https://api.whatsapp.com/send/?app_absent=0&phone=79033707854&text=&type=phone_number' },
      { label: 'Telegram', href: 'https://t.me/ozelifleather' },
      { label: 'MAX', href: 'https://max.ru/join/mOjqqa5jy4M69QdlhrUgug2wQc77xXw4sSJHkQycDQE' },
    ],
  },
]

export function ContactsPage() {
  return (
    <>
      <Header active="contacts" />

      <main className="contacts-page">
        <section className="contacts-hero contacts-enter">
          <div className="contacts-hero-inner">
            <nav className="clothing-catalog-breadcrumbs contacts-enter-item contacts-enter-item--1" aria-label="Хлебные крошки">
              <a href="/">Главная</a>
              <span>/</span>
              <span>Контакты</span>
            </nav>

            <div className="contacts-hero-copy contacts-enter-item contacts-enter-item--2">
              <p className="kicker">Связаться с OZELIF</p>
              <h1>Контакты<br /><em>и шоурум</em></h1>
              <p>
                Приезжайте выбрать материал лично или напишите менеджеру —
                поможем с ассортиментом, наличием и доставкой.
              </p>
            </div>
          </div>
        </section>

        <section className="contacts-content">
          <div className="contacts-main-grid">
            <article className="contacts-address-card reveal">
              <div className="contacts-card-icon">
                <MapPin size={26} strokeWidth={1.5} />
              </div>
              <p className="kicker">Адрес</p>
              <h2>Москва,<br />Краснобогатырская улица, 24</h2>
              <p>
                Магазин и шоурум натуральной кожи OZELIF. Перед визитом рекомендуем
                уточнить наличие нужного материала у менеджера.
              </p>
              <a
                className="btn btn--dark"
                href="https://yandex.ru/maps/?text=Москва%2C%20Краснобогатырская%20улица%2C%2024"
                target="_blank"
                rel="noreferrer"
              >
                Построить маршрут <ArrowUpRight size={17} />
              </a>
            </article>

            <div className="contacts-info-column">
              <article className="contacts-info-card reveal">
                <Phone size={23} strokeWidth={1.5} />
                <div>
                  <p className="kicker">Телефон</p>
                  <a href="tel:+79033707854">+7 903 370-78-54</a>
                  <span>Звонки и консультации по ассортименту</span>
                </div>
              </article>

              <article className="contacts-info-card reveal">
                <MessageCircle size={23} strokeWidth={1.5} />
                <div>
                  <p className="kicker">Мессенджеры</p>
                  <div className="contacts-inline-links">
                    <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
                    <a href={telegram} target="_blank" rel="noreferrer">Telegram</a>
                  </div>
                  <span>Ответим по наличию, цене и доставке</span>
                </div>
              </article>

              <article className="contacts-info-card reveal">
                <Clock3 size={23} strokeWidth={1.5} />
                <div>
                  <p className="kicker">Режим работы</p>
                  <strong>Уточняйте перед визитом</strong>
                  <span>График может меняться в праздничные дни</span>
                </div>
              </article>

              <article className="contacts-info-card reveal">
                <Mail size={23} strokeWidth={1.5} />
                <div>
                  <p className="kicker">Для организаций</p>
                  <a href="/kozhaoptom">Оптовые условия</a>
                  <span>Счёт, реквизиты и документы предоставит менеджер</span>
                </div>
              </article>
            </div>
          </div>

          <section className="contacts-team reveal" id="contacts-team">
            <div className="contacts-section-head">
              <p className="kicker">Контакты</p>
              <h2>Мы на связи<br /><em>по вашему вопросу</em></h2>
            </div>

            <div className="contacts-person-grid">
              {team.map((person, index) => (
                <article className="contacts-person-card" key={`${person.name}-${index}`}>
                  <div className="contacts-person-card-top">
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <Phone size={22} strokeWidth={1.5} />
                  </div>
                  <p className="kicker">{person.role}</p>
                  <h3>{person.name}</h3>
                  <p>{person.description}</p>
                  <a href={person.href}>
                    {person.phone}
                    <ArrowUpRight size={17} />
                  </a>

                  {person.socials.length > 0 && (
                    <div className="contacts-person-socials">
                      {person.socials.map(item => (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          key={item.label}
                        >
                          {item.label}
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="contacts-cta reveal">
            <div>
              <p className="kicker">Подбор материала</p>
              <h2>Напишите нам<br /><em>прямо сейчас</em></h2>
              <p>
                Пришлите фото, описание изделия или нужный оттенок — менеджер
                предложит подходящие варианты.
              </p>
            </div>

            <div className="contacts-cta-actions">
              <a className="btn btn--accent" href={whatsapp} target="_blank" rel="noreferrer">
                WhatsApp <ArrowUpRight size={17} />
              </a>
              <a className="text-link" href={telegram} target="_blank" rel="noreferrer">
                Telegram <ArrowUpRight size={16} />
              </a>
            </div>
          </section>
        </section>
      </main>

      <Footer />
    </>
  )
}
