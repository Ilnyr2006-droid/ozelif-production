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
              <a href="/contacts">Шоурум в Москве</a>
            </nav>
          </div>
        </details>
      </section>
    </>
  )
}
