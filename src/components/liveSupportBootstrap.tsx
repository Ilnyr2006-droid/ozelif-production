import { createRoot } from 'react-dom/client'
import { LiveSupportWidget } from './LiveSupportWidget'

const ID = 'ozelif-live-support-root'

function mount() {
  if (
    window.location.pathname === '/admin'
    || window.location.pathname.startsWith('/admin/')
  ) {
    return
  }

  if (document.getElementById(ID)) return

  const host = document.createElement('div')
  host.id = ID
  document.body.append(host)
  createRoot(host).render(<LiveSupportWidget />)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true })
} else {
  queueMicrotask(mount)
}
