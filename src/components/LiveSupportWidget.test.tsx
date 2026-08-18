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

  it('attributes a recommendation click to its product', async () => {
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
            id: 'conversation-click',
            status: 'open',
            aiEnabled: true,
          },
          conversationId: 'conversation-click',
          token: 'public-token',
        })
      }

      if (
        url.startsWith(
          '/api/live-chat/conversations/conversation-click/messages?',
        )
        && method === 'GET'
      ) {
        return mockResponse({
          conversation: {
            id: 'conversation-click',
            status: 'open',
            aiEnabled: true,
          },
          messages: [],
        })
      }

      if (
        url
          === '/api/live-chat/conversations/conversation-click/messages'
        && method === 'POST'
      ) {
        return mockResponse({
          conversation: {
            id: 'conversation-click',
            status: 'open',
            aiEnabled: true,
          },
          userMessage: {
            id: '10',
            role: 'user',
            content: 'Покажи Amazon Black',
            createdAt: '2026-08-18T10:00:00.000Z',
          },
          assistant: {
            message: {
              id: '11',
              role: 'assistant',
              content: 'Подходит Amazon Black.',
              createdAt: '2026-08-18T10:00:01.000Z',
              metadata: {
                products: [{
                  id: '11111111-1111-4111-8111-111111111111',
                  name: 'Amazon Black',
                }],
                actions: [{
                  label: 'Открыть Amazon Black',
                  href: '/odejnayakozha/tproduct/1-amazon-black',
                  productId:
                    '11111111-1111-4111-8111-111111111111',
                }],
              },
            },
          },
          assistantError: null,
        })
      }

      if (
        url
          === '/api/live-chat/conversations/conversation-click/recommendation-click'
        && method === 'POST'
      ) {
        return mockResponse({}, 204)
      }

      throw new Error(
        `Unexpected request: ${method} ${url}`,
      )
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<LiveSupportWidget />)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Открыть чат',
      }),
    )

    const textbox = screen.getByPlaceholderText(
      'Напишите сообщение…',
    )

    fireEvent.change(textbox, {
      target: { value: 'Покажи Amazon Black' },
    })

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Отправить',
      }),
    )

    const link = await screen.findByRole('link', {
      name: 'Открыть Amazon Black',
    })

    fireEvent.click(link)

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([input, init]) => (
          String(input)
            === '/api/live-chat/conversations/conversation-click/recommendation-click'
          && (init as RequestInit | undefined)?.method
            === 'POST'
        ),
      )

      expect(call).toBeTruthy()

      const body = JSON.parse(
        String(
          (call?.[1] as RequestInit | undefined)
            ?.body ?? '{}',
        ),
      )

      expect(body).toMatchObject({
        messageId: '11',
        productId:
          '11111111-1111-4111-8111-111111111111',
        href:
          '/odejnayakozha/tproduct/1-amazon-black',
      })
    })
  })


  it('renders a real order confirmation returned by the contact form', async () => {
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
            id: 'conversation-order-profile',
            status: 'open',
            aiEnabled: true,
          },
          conversationId: 'conversation-order-profile',
          token: 'public-token',
        })
      }

      if (
        url.startsWith(
          '/api/live-chat/conversations/conversation-order-profile/messages?',
        )
        && method === 'GET'
      ) {
        return mockResponse({
          conversation: {
            id: 'conversation-order-profile',
            status: 'open',
            aiEnabled: true,
          },
          messages: [],
        })
      }

      if (
        url
          === '/api/live-chat/conversations/conversation-order-profile/messages'
        && method === 'POST'
      ) {
        return mockResponse({
          conversation: {
            id: 'conversation-order-profile',
            status: 'open',
            aiEnabled: true,
          },
          userMessage: {
            id: '20',
            role: 'user',
            content: 'Оформляй',
            createdAt: '2026-08-18T15:00:00.000Z',
          },
          assistant: {
            message: {
              id: '21',
              role: 'assistant',
              content:
                'Чтобы создать заказ, напишите ваше имя и контактный телефон.',
              createdAt: '2026-08-18T15:00:01.000Z',
            },
          },
          conversion: null,
          orderFlow: {
            type: 'order',
            status: 'awaiting_contact',
            created: false,
          },
        })
      }

      if (
        url.startsWith(
          '/api/live-chat/conversations/conversation-order-profile/profile?',
        )
        && method === 'POST'
      ) {
        return mockResponse({
          profile: {
            visitorName: 'Ильнур',
            visitorPhone: '89990000000',
          },
          managerRequested: true,
          orderFlow: {
            type: 'order',
            status: 'created',
            created: true,
          },
          assistant: {
            message: {
              id: '22',
              role: 'assistant',
              content:
                'Заказ создан.\n\n• Chelsea Grey — 8 фут² — 3 496,8 ₽',
              createdAt: '2026-08-18T15:00:02.000Z',
            },
          },
        })
      }

      throw new Error(
        `Unexpected request: ${method} ${url}`,
      )
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<LiveSupportWidget />)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Открыть чат',
      }),
    )

    const textbox = screen.getByPlaceholderText(
      'Напишите сообщение…',
    )

    fireEvent.change(textbox, {
      target: { value: 'Оформляй' },
    })

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Отправить',
      }),
    )

    const nameInput = await screen.findByPlaceholderText(
      'Имя',
    )

    const phoneInput = screen.getByPlaceholderText(
      '+7 999 000-00-00',
    )

    fireEvent.change(nameInput, {
      target: { value: 'Ильнур' },
    })

    fireEvent.change(phoneInput, {
      target: { value: '89990000000' },
    })

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Передать менеджеру',
      }),
    )

    expect(
      await screen.findByText(
        /Заказ создан\./u,
      ),
    ).toBeInTheDocument()

    const profileCall = fetchMock.mock.calls.find(
      ([input, init]) => (
        String(input).includes(
          '/conversation-order-profile/profile?',
        )
        && (init as RequestInit | undefined)?.method
          === 'POST'
      ),
    )

    expect(profileCall).toBeTruthy()
  })

})
