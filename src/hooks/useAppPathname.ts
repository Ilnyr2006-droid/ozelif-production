import { useEffect, useState } from 'react'

function removeStaleHomePrerenderHero(pathname: string) {
  if (pathname === '/') return

  document
    .querySelectorAll('[data-home-prerender-hero="true"]')
    .forEach(node => node.remove())
}

function isInternalNavigation(event: MouseEvent, link: HTMLAnchorElement) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  if (link.target && link.target !== '_self' || link.hasAttribute('download')) return false

  const href = link.getAttribute('href')
  if (!href || href.startsWith('#')) return false

  const destination = new URL(link.href, window.location.href)
  return destination.origin === window.location.origin && ['http:', 'https:'].includes(destination.protocol)
}

/**
 * Minimal SPA navigation for local OZELIF routes. External, contact and download
 * links retain native browser behaviour.
 */
export function useAppPathname() {
  const [pathname, setPathname] = useState(() => {
    const initialPathname = window.location.pathname
    removeStaleHomePrerenderHero(initialPathname)
    return initialPathname
  })

  useEffect(() => {
    const updatePathname = () => {
      const nextPathname = window.location.pathname
      removeStaleHomePrerenderHero(nextPathname)
      setPathname(nextPathname)
    }
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const link = target.closest<HTMLAnchorElement>('a[href]')
      if (!link || !isInternalNavigation(event, link)) return

      const destination = new URL(link.href, window.location.href)
      event.preventDefault()
      window.history.pushState(null, '', `${destination.pathname}${destination.search}${destination.hash}`)
      updatePathname()
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }

    window.addEventListener('popstate', updatePathname)
    document.addEventListener('click', onDocumentClick)
    return () => {
      window.removeEventListener('popstate', updatePathname)
      document.removeEventListener('click', onDocumentClick)
    }
  }, [])

  return pathname
}
