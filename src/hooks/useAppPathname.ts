import { useEffect, useState } from 'react'

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
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const updatePathname = () => setPathname(window.location.pathname)
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
