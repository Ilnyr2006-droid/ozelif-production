import {
  useState,
} from 'react'

import {
  NativeSalesAnalytics,
} from './NativeSalesAnalytics'
import {
  VisitorTrafficAnalytics,
} from './VisitorTrafficAnalytics'

type AnalyticsTab =
  | 'traffic'
  | 'sales'

export function AdminTrafficAnalytics() {
  const [activeTab, setActiveTab] =
    useState<AnalyticsTab>('traffic')

  return (
    <section className="admin-analytics-page">
      <header className="admin-analytics-page__header">
        <div>
          <p className="admin-analytics-page__eyebrow">
            Business intelligence
          </p>

          <h2 className="admin-analytics-page__title">
            Аналитика OZELIF
          </h2>

          <p className="admin-analytics-page__description">
            Посещаемость сайта, продажи, клиенты
            и популярные товары в одном разделе.
          </p>
        </div>

        <nav
          className="admin-analytics-tabs"
          aria-label="Разделы аналитики"
        >
          <button
            type="button"
            className={
              activeTab === 'traffic'
                ? 'admin-analytics-tab is-active'
                : 'admin-analytics-tab'
            }
            onClick={() =>
              setActiveTab('traffic')
            }
          >
            <span>
              Посещаемость
            </span>

            <small>
              Посетители и страницы
            </small>
          </button>

          <button
            type="button"
            className={
              activeTab === 'sales'
                ? 'admin-analytics-tab is-active'
                : 'admin-analytics-tab'
            }
            onClick={() =>
              setActiveTab('sales')
            }
          >
            <span>
              Продажи и товары
            </span>

            <small>
              Заказы, выручка и клиенты
            </small>
          </button>
        </nav>
      </header>

      <div className="admin-analytics-page__content">
        {activeTab === 'traffic' && (
          <section
            aria-label="Аналитика посещаемости"
            className="admin-analytics-panel"
          >
            <header className="admin-analytics-panel__heading">
              <div>
                <p>
                  Аналитика сайта
                </p>

                <h3>
                  Посещаемость
                </h3>
              </div>

              <span>
                Данные из OZELIF
              </span>
            </header>

            <VisitorTrafficAnalytics />
          </section>
        )}

        {activeTab === 'sales' && (
          <section
            aria-label="Аналитика продаж"
            className="admin-analytics-panel"
          >
            <header className="admin-analytics-panel__heading">
              <div>
                <p>
                  OZELIF CRM
                </p>

                <h3>
                  Продажи и товары
                </h3>
              </div>

              <span>
                Обновляется автоматически
              </span>
            </header>

            <NativeSalesAnalytics />
          </section>
        )}
      </div>
    </section>
  )
}
