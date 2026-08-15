import React from 'react'
import { createRoot } from 'react-dom/client'
import { AiAssistantWidget } from './components/AiAssistantWidget'
import './tilda-widget.css'

const ROOT_ID = 'ozelif-tilda-widget-root'

function removeOldExperimentalWidgets() {
  const selectors = [
    '.ozelif-ai-root',
    '.ozelif-ai-widget',
    '.ozelif-chat',
    '.ozelif-ai',
    '.ozelif-tg-wrap',
  ]

  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(node => {
      if ((node as HTMLElement).id !== ROOT_ID) node.remove()
    })
  })
}

function mountWidget() {
  if (!document.body || document.getElementById(ROOT_ID)) return

  removeOldExperimentalWidgets()

  const host = document.createElement('div')
  host.id = ROOT_ID
  document.body.appendChild(host)

  createRoot(host).render(
    <React.StrictMode>
      <AiAssistantWidget />
    </React.StrictMode>,
  )
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountWidget, { once: true })
} else {
  mountWidget()
}
