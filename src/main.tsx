import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

function removeStaleHomePrerenderHero() {
  if (window.location.pathname === '/') return

  document
    .querySelectorAll('[data-home-prerender-hero="true"]')
    .forEach(node => node.remove())
}

removeStaleHomePrerenderHero()

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
