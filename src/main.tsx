import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

function removeStaticPrerenderContent() {
  document
    .querySelectorAll('[data-seo-prerender="true"]')
    .forEach(node => node.remove())

  if (window.location.pathname !== '/') {
    document
      .querySelectorAll('[data-home-prerender-hero="true"]')
      .forEach(node => node.remove())
  }
}

removeStaticPrerenderContent()

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
