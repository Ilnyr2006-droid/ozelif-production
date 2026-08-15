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
