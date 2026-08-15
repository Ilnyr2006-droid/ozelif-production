const VISITOR_SESSION_KEY = 'ozelif-visitor-session-v1'
const HEARTBEAT_INTERVAL_MS = 30_000

let presenceStarted = false
let interactionTrackingStarted = false

export type AnalyticsEventName =
  | 'page_view'
  | 'product_view'
  | 'variant_select'
  | 'add_to_cart'
  | 'cart_open'
  | 'checkout_start'
  | 'checkout_success'
  | 'checkout_error'
  | 'catalog_filter'
  | 'search_no_results'
  | 'contact_click'
  | 'heartbeat'

export type ContactChannel = 'whatsapp' | 'telegram' | 'phone' | 'route'

export function sanitizeCatalogQuery(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ').slice(0, 80)

  if (normalized.length < 2) return null

  const containsPrivateContact = (
    /@/.test(normalized)
    || /(?:https?:\/\/|www\.)/i.test(normalized)
    || /(?:\+?7|8)[\s()-]*\d(?:[\s()-]*\d){7,}/.test(normalized)
  )

  return containsPrivateContact ? null : normalized
}

export function classifyContactLink(
  href: string,
  text = '',
): ContactChannel | null {
  const normalizedHref = href.trim().toLocaleLowerCase('ru')
  const normalizedText = text.trim().toLocaleLowerCase('ru')

  if (normalizedHref.startsWith('tel:')) return 'phone'
  if (/^(?:https?:\/\/)?(?:www\.)?(?:wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)/.test(normalizedHref)) return 'whatsapp'
  if (/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)/.test(normalizedHref)) return 'telegram'
  if (
    normalizedText.includes('построить маршрут')
    || /(?:yandex\.(?:ru|com)\/maps|maps\.yandex\.)/.test(normalizedHref)
  ) return 'route'

  return null
}

function isTestRuntime() {
  return (
    import.meta.env.MODE === 'test'
    || (
      typeof navigator !== 'undefined'
      && navigator.userAgent.toLocaleLowerCase().includes('jsdom')
    )
  )
}

function createClientId() {
  try {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }

    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)

    return Array.from(
      bytes,
      value => value.toString(16).padStart(2, '0'),
    ).join('')
  } catch {
    return [
      Date.now().toString(36),
      Math.random().toString(36).slice(2),
      Math.random().toString(36).slice(2),
    ].join('-')
  }
}

function getSessionId() {
  try {
    const stored = window.localStorage.getItem(VISITOR_SESSION_KEY)

    if (stored) return stored

    const id = createClientId()
    window.localStorage.setItem(VISITOR_SESSION_KEY, id)

    return id
  } catch {
    return createClientId()
  }
}

function isPublicPath(path: string) {
  return path !== '/admin' && !path.startsWith('/admin/')
}

export async function trackEvent(
  eventName: AnalyticsEventName,
  details: {
    path?: string
    entityType?: string
    entityId?: string
    metadata?: Record<string, unknown>
  } = {},
) {
  if (isTestRuntime()) return

  const path = details.path ?? window.location.pathname

  if (!isPublicPath(path)) return

  try {
    await fetch('/api/analytics/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      keepalive: true,
      body: JSON.stringify({
        sessionId: getSessionId(),
        eventName,
        path,
        entityType: details.entityType,
        entityId: details.entityId,
        metadata: details.metadata ?? {},
        referrer: document.referrer,
      }),
    })
  } catch {
    // Недоступность аналитики не должна мешать работе магазина.
  }
}

function sendHeartbeat() {
  if (
    document.visibilityState === 'hidden'
    || !isPublicPath(window.location.pathname)
  ) {
    return
  }

  void trackEvent('heartbeat')
}

function startInteractionTracking() {
  if (interactionTrackingStarted || typeof document === 'undefined') return

  interactionTrackingStarted = true
  document.addEventListener('click', event => {
    const target = event.target
    if (!(target instanceof Element)) return

    const link = target.closest<HTMLAnchorElement>('a[href]')
    if (!link) return

    const channel = classifyContactLink(
      link.getAttribute('href') ?? '',
      link.textContent ?? '',
    )
    if (!channel) return

    void trackEvent('contact_click', {
      entityType: 'contact',
      entityId: channel,
      metadata: { channel },
    })
  }, true)
}

export function startPresenceTracking() {
  if (
    presenceStarted
    || isTestRuntime()
    || !isPublicPath(window.location.pathname)
  ) {
    return
  }

  presenceStarted = true
  startInteractionTracking()
  sendHeartbeat()

  window.setInterval(
    sendHeartbeat,
    HEARTBEAT_INTERVAL_MS,
  )

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      sendHeartbeat()
    }
  })

  window.addEventListener('focus', sendHeartbeat)
}

export function trackPageView(path: string) {
  if (!isPublicPath(path)) return Promise.resolve()

  startPresenceTracking()
  return trackEvent('page_view', { path })
}
