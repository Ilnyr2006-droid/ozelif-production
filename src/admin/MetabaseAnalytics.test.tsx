// @vitest-environment jsdom
import {
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  MetabaseAnalytics,
} from './MetabaseAnalytics'

describe('MetabaseAnalytics', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads a protected Metabase embed URL', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            url:
              'http://127.0.0.1:3000/embed/dashboard/test-token',
            expiresAt:
              '2026-08-02T00:00:00.000Z',
          }),
          {
            status: 200,
            headers: {
              'Content-Type':
                'application/json',
            },
          },
        ),
    )

    vi.stubGlobal(
      'fetch',
      fetchMock,
    )

    render(
      <MetabaseAnalytics />,
    )

    const iframe =
      await screen.findByTitle(
        'Аналитика OZELIF',
      )

    expect(
      iframe.getAttribute('src'),
    ).toBe(
      'http://127.0.0.1:3000/embed/dashboard/test-token',
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/metabase/embed',
        expect.objectContaining({
          credentials: 'include',
        }),
      )
    })
  })
})
