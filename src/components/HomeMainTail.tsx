import { Business } from './Business'
import { Contact } from './Contact'
import { Editorial } from './Editorial'

export function HomeMainTail() {
  return (
    <>
      <Editorial/>
      <Business/>
      <Contact/>

      <section className="seo section">
        <details open>
          <summary>Купить натуральную кожу в Москве</summary>
          <div>
            <p>
              OZELIF — магазин и склад натуральной кожи в Москве. В каталоге
              представлены одежная и обувная кожа, натуральная замша,
              дублёночный материал и фурнитура для пошива одежды, обуви
              и аксессуаров.
            </p>
            <p>
              Натуральную кожу можно купить в розницу и оптом. В карточках
              опубликованных товаров доступны актуальные цены и характеристики;
              наличие нужной партии и объём заказа можно подтвердить у менеджера.
            </p>
            <p>
              Материалы можно посмотреть в шоуруме OZELIF по адресу:
              Москва, Краснобогатырская улица, 24. Заказы отправляются
              по России.
            </p>
            <nav className="seo-links" aria-label="Каталог натуральной кожи">
              <a href="/odejnayakozha">Одежная кожа</a>
              <a href="/odejnayakozha/krs">Кожа КРС</a>
              <a href="/odejnayakozha/nappa">Кожа Наппа</a>
              <a href="/zamsha">Натуральная замша</a>
              <a href="/dublyonka">Дублёночный материал</a>
              <a href="/obuvnayakozha">Обувная кожа</a>
              <a href="/kozhaoptom">Кожа оптом</a>
              <a href="/production">Швейное производство в Москве</a>
              <a href="/contacts">Шоурум в Москве</a>
            </nav>
          </div>
        </details>

        <section className="geo-facts" aria-labelledby="geo-facts-title">
          <h3 id="geo-facts-title">OZELIF: коротко о магазине</h3>
          <dl>
            <div>
              <dt>Что такое OZELIF</dt>
              <dd>Магазин и склад натуральной кожи в Москве.</dd>
            </div>
            <div>
              <dt>Что продаёт OZELIF</dt>
              <dd>
                Одежную и обувную кожу, натуральную замшу,
                дублёночный материал и фурнитуру.
              </dd>
            </div>
            <div>
              <dt>Формат продаж</dt>
              <dd>Розница и опт.</dd>
            </div>
            <div>
              <dt>Адрес</dt>
              <dd>Москва, Краснобогатырская улица, 24.</dd>
            </div>
            <div>
              <dt>Телефон</dt>
              <dd><a href="tel:+79033707854">+7 903 370-78-54</a></dd>
            </div>
            <div>
              <dt>Доставка</dt>
              <dd>Заказы отправляются из Москвы по России.</dd>
            </div>
          </dl>
        </section>

        <section className="geo-faq" aria-labelledby="geo-faq-title">
          <h3 id="geo-faq-title">Частые вопросы о покупке кожи в OZELIF</h3>

          <details>
            <summary>Где находится магазин и склад OZELIF?</summary>
            <p>
              Шоурум и склад находятся по адресу:
              Москва, Краснобогатырская улица, 24.
            </p>
          </details>

          <details>
            <summary>Можно ли купить натуральную кожу в розницу?</summary>
            <p>
              Да. OZELIF работает с розничными и оптовыми покупателями.
            </p>
          </details>

          <details>
            <summary>Где посмотреть цены и характеристики кожи?</summary>
            <p>
              Актуальные цены и характеристики опубликованы
              в карточках товаров каталога OZELIF.
            </p>
          </details>

          <details>
            <summary>Как узнать наличие конкретной партии?</summary>
            <p>
              Наличие нужного варианта и объём партии подтверждает
              менеджер OZELIF перед заказом.
            </p>
          </details>

          <details>
            <summary>Есть ли доставка по России?</summary>
            <p>
              Да. Заказы отправляются из Москвы по России;
              способ, стоимость и сроки доставки подтверждаются
              для конкретного заказа.
            </p>
          </details>
        </section>
      </section>
    </>
  )
}
