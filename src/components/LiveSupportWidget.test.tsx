// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { LiveSupportWidget } from './LiveSupportWidget'

type MockResponseBody = Record<string, unknown>

function mockResponse(
  body: MockResponseBody,
  status = 200,
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

describe('LiveSupportWidget', () => {
  beforeEach(() => {
    Object.defineProperty(
      HTMLElement.prototype,
      'scrollIntoView',
      {
        configurable: true,
        value: vi.fn(),
      },
    )

    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'test-random-uuid'),
    })

    window.localStorage.clear()
    window.localStorage.setItem(
      'ozelif_live_chat_visitor',
      'test-visitor',
    )
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    window.localStorage.clear()
  })

  it('opens the new persistent OZELIF chat', async () => {
    const fetchMock = vi.fn(async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (
        url === '/api/live-chat/session'
        && method === 'POST'
      ) {
        return mockResponse({
          conversation: {
            id: 'conversation-1',
            status: 'open',
            aiEnabled: true,
          },
          conversationId: 'conversation-1',
          token: 'public-token',
        })
      }

      if (
        url.startsWith(
          '/api/live-chat/conversations/conversation-1/messages?',
        )
        && method === 'GET'
      ) {
        return mockResponse({
          conversation: {
            id: 'conversation-1',
            status: 'open',
            aiEnabled: true,
          },
          messages: [],
        })
      }

      throw new Error(`Unexpected request: ${method} ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<LiveSupportWidget />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Открыть чат' }),
    )

    expect(
      screen.getByText('Консультант OZELIF'),
    ).toBeInTheDocument()

    expect(
      screen.getByPlaceholderText('Напишите сообщение…'),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/live-chat/session',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  it('saves the visitor message and renders the AI reply', async () => {
    const fetchMock = vi.fn(async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (
        url === '/api/live-chat/session'
        && method === 'POST'
      ) {
        return mockResponse({
          conversation: {
            id: 'conversation-2',
            status: 'open',
            aiEnabled: true,
          },
          conversationId: 'conversation-2',
          token: 'public-token',
        })
      }

      if (
        url.startsWith(
          '/api/live-chat/conversations/conversation-2/messages?',
        )
        && method === 'GET'
      ) {
        return mockResponse({
          conversation: {
            id: 'conversation-2',
            status: 'open',
            aiEnabled: true,
          },
          messages: [],
        })
      }

      if (
        url
          === '/api/live-chat/conversations/conversation-2/messages'
        && method === 'POST'
      ) {
        return mockResponse({
          conversation: {
            id: 'conversation-2',
            status: 'open',
            aiEnabled: true,
          },
          userMessage: {
            id: '1',
            role: 'user',
            content: 'Нужна мягкая чёрная кожа для сумки',
            createdAt: '2026-07-25T10:00:00.000Z',
          },
          assistant: {
            message: {
              id: '2',
              role: 'assistant',
              content: 'Подберу подходящие варианты из каталога.',
              createdAt: '2026-07-25T10:00:01.000Z',
              metadata: {
                actions: [],
              },
            },
          },
          assistantError: null,
        })
      }

      throw new Error(`Unexpected request: ${method} ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<LiveSupportWidget />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Открыть чат' }),
    )

    const textbox = screen.getByPlaceholderText(
      'Напишите сообщение…',
    )

    fireEvent.change(textbox, {
      target: {
        value: 'Нужна мягкая чёрная кожа для сумки',
      },
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Отправить' }),
    )

    expect(
      await screen.findByText(
        'Нужна мягкая чёрная кожа для сумки',
      ),
    ).toBeInTheDocument()

    expect(
      await screen.findByText(
        'Подберу подходящие варианты из каталога.',
      ),
    ).toBeInTheDocument()

    expect(
      fetchMock.mock.calls.some(([input, init]) => (
        String(input)
          === '/api/live-chat/conversations/conversation-2/messages'
        && (init as RequestInit | undefined)?.method === 'POST'
      )),
    ).toBe(true)
  })
})
