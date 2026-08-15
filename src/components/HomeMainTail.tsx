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
        <details>
          <summary>О натуральной коже OZELIF</summary>
          <div>
            <p>
              OZELIF предлагает натуральную кожу, замшу и дублёночный материал
              в Москве для пошива одежды, обуви и галантереи. Ассортимент
              распределён по производственному назначению, чтобы быстрее
              подобрать подходящую выделку и фактуру.
            </p>
            <p>
              Компания работает с 2011 года с розничными и оптовыми клиентами.
              Материалы можно выбрать со склада и посмотреть в московском
              шоуруме; условия объёмных закупок обсуждаются индивидуально.
            </p>
          </div>
        </details>
      </section>
    </>
  )
}
