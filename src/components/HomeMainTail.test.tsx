// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { HomeMainTail } from './HomeMainTail'

describe('HomeMainTail', () => {
  it('renders deferred business and verified review content when mounted', async () => {
    render(<HomeMainTail/>)

    expect(
      screen.getByRole('link', { name: /Условия для опта/i }),
    ).toHaveAttribute('href', '/kozhaoptom')

    expect(
      screen.getByText('Купить натуральную кожу в Москве'),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('link', { name: 'Кожа КРС' }),
    ).toHaveAttribute('href', '/odejnayakozha/krs')

    expect(
      screen.getByRole('link', { name: 'Швейное производство в Москве' }),
    ).toHaveAttribute('href', '/production')

    expect(
      screen.getByRole('link', { name: 'Шоурум в Москве' }),
    ).toHaveAttribute('href', '/contacts')

    expect(
      screen.getByText('OZELIF: коротко о магазине'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Магазин и склад натуральной кожи в Москве.'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Где находится магазин и склад OZELIF?'),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        'Актуальные цены и характеристики опубликованы в карточках товаров каталога OZELIF.',
      ),
    ).toBeInTheDocument()

    const excerpt = await screen.findByText(
      '«Очень хороший магазин, отзывчивые и профессиональные сотрудники.»',
    )

    expect(excerpt).toBeInTheDocument()
    expect(excerpt.closest('a')).toHaveAttribute(
      'href',
      'https://yandex.ru/maps/org/ozelif_kozha/242632009920/reviews/',
    )
  })
})
