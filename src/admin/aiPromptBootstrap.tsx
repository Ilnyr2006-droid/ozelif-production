import { createRoot, type Root } from 'react-dom/client'
import { AiPromptSettings } from './AiPromptSettings'

export const AI_PROMPT_BOOTSTRAP_MARKER = 'OZELIF_AI_PROMPT_BOOTSTRAP_V1G'

const HOST_ID = 'ozelif-ai-prompt-admin-root'
const LOCATION_EVENT = 'ozelif:locationchange'

let root: Root | null = null
let host: HTMLDivElement | null = null

function isAdminPath() {
  return (
    window.location.pathname === '/admin'
    || window.location.pathname.startsWith('/admin/')
  )
}

function ensureHost() {
  if (host?.isConnected) return host

  const existing = document.getElementById(HOST_ID)

  if (existing instanceof HTMLDivElement) {
    host = existing
    return host
  }

  host = document.createElement('div')
  host.id = HOST_ID
  host.dataset.bootstrap = AI_PROMPT_BOOTSTRAP_MARKER
  document.body.append(host)

  return host
}

function unmount() {
  root?.unmount()
  root = null
  host?.remove()
  host = null
}

function syncAiPromptMount() {
  if (!isAdminPath()) {
    unmount()
    return
  }

  if (root) return

  root = createRoot(ensureHost())
  root.render(<AiPromptSettings />)
}

function dispatchLocationChange() {
  window.dispatchEvent(new Event(LOCATION_EVENT))
}

function patchHistory() {
  const historyWithFlag = window.history as History & {
    __ozelifAiPromptPatched?: boolean
  }

  if (historyWithFlag.__ozelifAiPromptPatched) return

  historyWithFlag.__ozelifAiPromptPatched = true

  const originalPushState = window.history.pushState.bind(window.history)
  const originalReplaceState = window.history.replaceState.bind(window.history)

  window.history.pushState = function pushState(
    ...args: Parameters<History['pushState']>
  ) {
    const result = originalPushState(...args)
    dispatchLocationChange()
    return result
  }

  window.history.replaceState = function replaceState(
    ...args: Parameters<History['replaceState']>
  ) {
    const result = originalReplaceState(...args)
    dispatchLocationChange()
    return result
  }
}

patchHistory()

window.addEventListener('popstate', syncAiPromptMount)
window.addEventListener('hashchange', syncAiPromptMount)
window.addEventListener(LOCATION_EVENT, syncAiPromptMount)

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    syncAiPromptMount,
    { once: true },
  )
} else {
  queueMicrotask(syncAiPromptMount)
}
