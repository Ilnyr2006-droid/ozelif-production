import { createRoot } from 'react-dom/client'
import { AdminLiveChats } from './AdminLiveChats'

export const OZELIF_ADMIN_LIVE_CHATS_BOOTSTRAP_V2 =
  'OZELIF_ADMIN_LIVE_CHATS_BOOTSTRAP_V2'

const ROOT_ID = 'ozelif-admin-live-chats-root'
const BADGE_CLASS = 'ozelif-admin-chat-badge'

let host: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null
let scheduled = false

function isAdminPath() {
  return (
    window.location.pathname === '/admin'
    || window.location.pathname.startsWith('/admin/')
    || window.location.port === '18091'
  )
}

function normalized(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/\d+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function closeChats() {
  root?.unmount()
  root = null
  host?.remove()
  host = null
}

function openChats() {
  if (!isAdminPath() || root) return

  host = document.createElement('div')
  host.id = ROOT_ID
  document.body.append(host)

  root = createRoot(host)
  root.render(<AdminLiveChats onClose={closeChats} />)
}

function eventElements(event: Event) {
  return event.composedPath().filter(
    item => item instanceof HTMLElement,
  ) as HTMLElement[]
}

function isChatsClick(event: Event) {
  for (const element of eventElements(event)) {
    if (element.closest(`#${ROOT_ID}`)) return false

    if (normalized(element.textContent) !== 'чаты') continue

    if (
      element.matches(
        'a, button, [role="button"], [role="menuitem"], li, div',
      )
    ) {
      return true
    }
  }

  return false
}

document.addEventListener(
  'click',
  event => {
    if (!isChatsClick(event)) return

    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    openChats()
  },
  true,
)

function placeholderVisible() {
  if (!isAdminPath() || root) return false

  const text = normalized(document.body.innerText)

  return (
    text.includes('чаты покупателей')
    && text.includes('раздел будет подключен на следующем этапе')
  )
}

async function updateUnreadBadge() {
  if (!isAdminPath()) return

  const response = await fetch('/api/admin/live-chats?status=active', {
    credentials: 'same-origin',
    cache: 'no-store',
  })

  if (!response.ok) return

  const body = await response.json()
  const total = Number(body.unreadTotal ?? 0)

  const candidates = [
    ...document.querySelectorAll<HTMLElement>(
      'a, button, [role="button"], [role="menuitem"], li, nav div, aside div',
    ),
  ].filter(element => (
    !element.closest(`#${ROOT_ID}`)
    && normalized(element.textContent) === 'чаты'
  ))

  for (const candidate of candidates) {
    candidate.querySelector(`.${BADGE_CLASS}`)?.remove()

    if (total <= 0) continue

    const badge = document.createElement('span')
    badge.className = BADGE_CLASS
    badge.textContent = total > 99 ? '99+' : String(total)
    candidate.append(badge)
  }
}

function sync() {
  if (scheduled) return
  scheduled = true

  window.requestAnimationFrame(() => {
    scheduled = false

    if (placeholderVisible()) {
      openChats()
      return
    }

    void updateUnreadBadge().catch(() => undefined)
  })
}

const badgeStyles = document.createElement('style')
badgeStyles.textContent = `
  .${BADGE_CLASS} {
    display: inline-grid;
    min-width: 20px;
    height: 20px;
    margin-left: auto;
    place-items: center;
    border-radius: 999px;
    padding: 0 5px;
    background: #b6532b;
    color: #fff;
    font-size: 10px;
    font-weight: 800;
  }
`
document.head.append(badgeStyles)

if (isAdminPath()) {
  sync()
  window.setInterval(sync, 5_000)

  new MutationObserver(sync).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  })
}
Object.defineProperty(window, '__OZELIF_ADMIN_LIVE_CHATS_BOOTSTRAP_V2__', {
  configurable: true,
  value: true,
})
