// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AI_ASSISTANT_STORAGE_KEY } from '../data/aiAssistant'
import { AiAssistantWidget } from './AiAssistantWidget'

const fetchMock = vi.fn()
const originalRect = HTMLElement.prototype.getBoundingClientRect

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
}

function mockPanelRect() {
  HTMLElement.prototype.getBoundingClientRect = () => ({
    x: 1020, y: 150, left: 1020, top: 150, right: 1420, bottom: 750, width: 400, height: 600, toJSON: () => ({}),
  })
}

function dispatchPointer(target: Element, type: string, clientX: number, clientY: number, pointerId = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: pointerId },
  })
  fireEvent(target, event)
}

beforeEach(() => {
  setViewport(1440, 900)
  mockPanelRect()
  window.localStorage.clear()
  window.sessionStorage.clear()
  fetchMock.mockReset()
  fetchMock.mockRejectedValue(new Error('No assistant endpoint'))
  vi.stubGlobal('fetch', fetchMock)
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() })
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', { configurable: true, value: vi.fn() })
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', { configurable: true, value: () => true })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  HTMLElement.prototype.getBoundingClientRect = originalRect
})

function openWidget() {
  fireEvent.click(screen.getByRole('button', { name: 'Открыть чат с AI-ассистентом' }))
}

function sendQuestion(question: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Сообщение для AI-ассистента' }), { target: { value: question } })
  fireEvent.click(screen.getByRole('button', { name: 'Отправить сообщение' }))
}

describe('AiAssistantWidget', () => {
  it('renders the floating trigger', () => {
    render(<AiAssistantWidget />)
    expect(screen.getByRole('button', { name: 'Открыть чат с AI-ассистентом' })).toHaveClass('ai-assistant-trigger--right-center')
  })

  it('opens a dialog and moves focus to the input', async () => {
    render(<AiAssistantWidget />)
    openWidget()
    expect(screen.getByRole('dialog', { name: 'AI-ассистент OZELIF' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Сообщение для AI-ассистента' })).toHaveFocus())
  })

  it('closes with Escape and returns focus to its trigger', async () => {
    render(<AiAssistantWidget />)
    openWidget()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Открыть чат с AI-ассистентом' })).toHaveFocus())
    expect(window.sessionStorage.getItem('ozelif-ai-chat-ui-v1')).toContain('"isOpen":false')
  })

  it('moves the desktop panel with pointer events and saves its position', async () => {
    render(<AiAssistantWidget />)
    openWidget()
    const dialog = screen.getByRole('dialog')
    const handle = dialog.querySelector<HTMLElement>('.ai-assistant-drag-handle')!
    dispatchPointer(handle, 'pointerdown', 1030, 200)
    dispatchPointer(handle, 'pointermove', 1080, 250)
    dispatchPointer(handle, 'pointerup', 1080, 250)

    expect(dialog).toHaveStyle({ left: '1028px', top: '200px', transform: 'none' })
    await waitFor(() => expect(window.localStorage.getItem('ozelif-ai-chat-position-v1')).toContain('1028'))
  })

  it('keeps the panel inside the top-left and bottom-right viewport bounds', () => {
    render(<AiAssistantWidget />)
    openWidget()
    const dialog = screen.getByRole('dialog')
    const handle = dialog.querySelector<HTMLElement>('.ai-assistant-drag-handle')!

    dispatchPointer(handle, 'pointerdown', 1030, 200)
    dispatchPointer(handle, 'pointermove', 0, 0)
    expect(dialog).toHaveStyle({ left: '12px', top: '12px' })

    dispatchPointer(handle, 'pointermove', 5000, 5000)
    expect(dialog).toHaveStyle({ left: '1028px', top: '288px' })
  })

  it('restores and resets a saved desktop position', async () => {
    window.localStorage.setItem('ozelif-ai-chat-position-v1', JSON.stringify({ x: 600, y: 200 }))
    render(<AiAssistantWidget />)
    openWidget()
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(dialog).toHaveStyle({ left: '600px', top: '200px' }))
    fireEvent.click(screen.getByRole('button', { name: 'Вернуть исходное положение' }))
    expect(dialog).not.toHaveStyle({ left: '600px' })
    expect(window.localStorage.getItem('ozelif-ai-chat-position-v1')).toBeNull()
  })

  it('does not start dragging from the close button', () => {
    render(<AiAssistantWidget />)
    openWidget()
    const dialog = screen.getByRole('dialog')
    const closeButton = screen.getByRole('button', { name: 'Закрыть чат с AI-ассистентом' })
    dispatchPointer(closeButton, 'pointerdown', 1030, 200)
    dispatchPointer(dialog.querySelector<HTMLElement>('.ai-assistant-drag-handle')!, 'pointermove', 1200, 300)
    expect(dialog.style.left).toBe('')
  })

  it('disables dragging and keeps the trigger at bottom-right on mobile', async () => {
    setViewport(390, 844)
    render(<AiAssistantWidget />)
    const trigger = screen.getByRole('button', { name: 'Открыть чат с AI-ассистентом' })
    expect(trigger).toHaveClass('ai-assistant-trigger--right-center')
    openWidget()
    const dialog = screen.getByRole('dialog')
    const handle = dialog.querySelector<HTMLElement>('.ai-assistant-drag-handle')!
    dispatchPointer(handle, 'pointerdown', 100, 100)
    dispatchPointer(handle, 'pointermove', 250, 250)
    expect(dialog.style.left).toBe('')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Вернуть исходное положение' })).not.toBeInTheDocument())
  })

  it('does not send an empty message', () => {
    render(<AiAssistantWidget />)
    openWidget()
    expect(screen.getByRole('button', { name: 'Отправить сообщение' })).toBeDisabled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers a quick question with the local fallback', async () => {
    render(<AiAssistantWidget />)
    openWidget()
    fireEvent.click(screen.getByRole('button', { name: 'Условия доставки' }))
    expect(await screen.findByText(/самовывоз в Москве/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Доставка и оплата' })).toHaveAttribute('href', '/delivery')
  })

  it('uses the local fallback when live chat is unavailable', async () => {
    render(<AiAssistantWidget />)
    openWidget()
    sendQuestion('Как связаться с менеджером?')
    expect(await screen.findByText(/Связаться с менеджерами OZELIF/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/live-chat/session', expect.objectContaining({ method: 'POST' }))
  })

  it('saves and restores chat history', async () => {
    const first = render(<AiAssistantWidget />)
    openWidget()
    sendQuestion('Подобрать кожу для одежды')
    expect((await screen.findAllByText(/Одежная кожа/i)).length).toBeGreaterThan(0)
    first.unmount()

    render(<AiAssistantWidget />)
    expect(screen.getByRole('dialog', { name: 'AI-ассистент OZELIF' })).toBeInTheDocument()
    expect(screen.getByText('Подобрать кожу для одежды')).toBeInTheDocument()
    expect(window.localStorage.getItem(AI_ASSISTANT_STORAGE_KEY)).toContain('Подобрать кожу для одежды')
  })

  it('clears saved history while retaining the welcome message', async () => {
    render(<AiAssistantWidget />)
    openWidget()
    sendQuestion('Подобрать кожу для одежды')
    expect((await screen.findAllByText(/Одежная кожа/i)).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Очистить историю чата' }))

    expect(document.querySelectorAll('.ai-message--user')).toHaveLength(0)
    expect(screen.getByText(/Здравствуйте! Я AI-ассистент OZELIF/i)).toBeInTheDocument()
    expect(window.localStorage.getItem(AI_ASSISTANT_STORAGE_KEY)).not.toContain('Подобрать кожу для одежды')
  })
})
