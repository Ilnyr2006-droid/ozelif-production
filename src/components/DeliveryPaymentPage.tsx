import { ArrowUpRight, Banknote, MapPin, PackageCheck, Truck } from 'lucide-react'
import { Footer } from './Footer'
import { Header } from './Header'
import { telegram, whatsapp } from '../data'

const deliveryItems = [
  {
    icon: MapPin,
    index: '01',
    title: 'Самовывоз в Москве',
    text: 'Забрать заказ можно в нашем магазине по адресу: Москва, Краснобогатырская улица, 24.',
  },
  {
    icon: Truck,
    index: '02',
    title: 'Доставка по Москве',
    text: 'Доставка курьером по Москве стоит от 350 ₽. Итоговая стоимость зависит от адреса и объёма заказа.',
  },
  {
    icon: PackageCheck,
    index: '03',
    title: 'Доставка по России и миру',
    text: 'Отправляем заказы из Москвы курьерской службой СДЭК по России и в другие страны. Для международной доставки свяжитесь с менеджером.',
  },
]

const paymentItems = [
  'Отправка заказов в регионы России и другие страны производится на условиях 100% предоплаты.',
  'При самовывозе из офиса заказ можно оплатить наличными.',
  'Доступен перевод денежных средств на расчётный счёт организации по реквизитам.',
]

export function DeliveryPaymentPage() {
  return (
    <>
      <Header active="delivery" />
      <main className="delivery-page">
        <section className="delivery-hero delivery-enter">
          <div className="delivery-hero-inner">
            <nav className="clothing-catalog-breadcrumbs delivery-enter-item delivery-enter-item--1" aria-label="Хлебные крошки">
              <a href="/">Главная</a>
              <span>/</span>
              <span>Доставка и оплата</span>
            </nav>

            <div className="delivery-hero-copy delivery-enter-item delivery-enter-item--2">
              <p className="kicker">Информация для покупателей</p>
              <h1>Доставка<br /><em>и оплата</em></h1>
              <p>
                Заберите заказ в московском шоуруме или оформите доставку по Москве,
                России и в другие страны.
              </p>
            </div>
          </div>
        </section>

        <section className="delivery-content">
          <div className="delivery-intro reveal">
            <p className="kicker">01 — Получение заказа</p>
            <h2>Выберите удобный<br /><em>способ доставки</em></h2>
          </div>

          <div className="delivery-grid">
            {deliveryItems.map(item => {
              const Icon = item.icon
              return (
                <article className="delivery-card reveal" key={item.title}>
                  <div className="delivery-card-top">
                    <span>{item.index}</span>
                    <Icon size={24} strokeWidth={1.5} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              )
            })}
          </div>

          <section className="payment-panel reveal">
            <div className="payment-panel-title">
              <Banknote size={28} strokeWidth={1.4} />
              <div>
                <p className="kicker">02 — Оплата</p>
                <h2>Условия оплаты</h2>
              </div>
            </div>

            <div className="payment-list">
              {paymentItems.map((item, index) => (
                <div key={item}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="delivery-contact reveal">
            <div>
              <p className="kicker">Нужна помощь?</p>
              <h2>Уточните условия<br /><em>у менеджера</em></h2>
              <p>
                Подскажем стоимость доставки, сроки и подходящий способ оплаты
                для вашего заказа.
              </p>
            </div>

            <div className="delivery-contact-actions">
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
