const VISITOR_SESSION_KEY = 'ozelif-visitor-session-v1'
const HEARTBEAT_INTERVAL_MS = 30_000

let presenceStarted = false

export type AnalyticsEventName =
  | 'page_view'
  | 'product_view'
  | 'variant_select'
  | 'add_to_cart'
  | 'cart_open'
  | 'checkout_start'
  | 'checkout_success'
  | 'checkout_error'
  | 'heartbeat'

export type AnalyticsEventDetails = {
  path?: string
  entityType?: 'product' | 'variant' | 'cart'
  entityId?: string
  metadata?: Record<string, string | number | boolean | null>
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
  details: AnalyticsEventDetails = {},
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

export function startPresenceTracking() {
  if (
    presenceStarted
    || isTestRuntime()
    || !isPublicPath(window.location.pathname)
  ) {
    return
  }

  presenceStarted = true
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
