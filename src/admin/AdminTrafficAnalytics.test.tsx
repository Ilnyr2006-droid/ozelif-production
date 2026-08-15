// @vitest-environment jsdom

import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

vi.mock(
  './VisitorTrafficAnalytics',
  () => ({
    VisitorTrafficAnalytics: () => (
      <div>
        visitor-analytics
      </div>
    ),
  }),
)

vi.mock(
  './NativeSalesAnalytics',
  () => ({
    NativeSalesAnalytics: () => (
      <div>
        native-sales-analytics
      </div>
    ),
  }),
)

import {
  AdminTrafficAnalytics,
} from './AdminTrafficAnalytics'

describe('AdminTrafficAnalytics', () => {
  it('switches between traffic and sales analytics', () => {
    render(
      <AdminTrafficAnalytics />,
    )

    expect(
      screen.getByText(
        'visitor-analytics',
      ),
    ).toBeTruthy()

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name:
            /Продажи и товары/i,
        },
      ),
    )

    expect(
      screen.getByText(
        'native-sales-analytics',
      ),
    ).toBeTruthy()
  })
})
