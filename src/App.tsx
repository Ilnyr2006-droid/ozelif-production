import { hasCatalogSeoLanding } from './data/catalogSeoLandings'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { trackPageView } from './analytics/track'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { Catalog } from './components/Catalog'
import { Footer } from './components/Footer'
import { CartProvider } from './cart/CartProvider'
import { SITE } from './data'
import { useAppPathname } from './hooks/useAppPathname'

const AdminPageV2 = lazy(async () => ({ default: (await import('./admin/AdminPageV2')).AdminPageV2 }))
const AboutPage = lazy(async () => ({ default: (await import('./components/AboutPage')).AboutPage }))
const WholesalePage = lazy(async () => ({ default: (await import('./components/WholesalePage')).WholesalePage }))
const SewingProductionPage = lazy(async () => ({ default: (await import('./components/SewingProductionPage')).SewingProductionPage }))
const ClothingLeatherCatalogPage = lazy(async () => ({ default: (await import('./components/ClothingLeatherCatalogPage')).ClothingLeatherCatalogPage }))
const CatalogSeoLandingPage = lazy(async () => ({ default: (await import('./components/CatalogSeoLandingPage')).CatalogSeoLandingPage }))
const ClothingLeatherProductPage = lazy(async () => ({ default: (await import('./components/ClothingLeatherCatalogPage')).ClothingLeatherProductPage }))
const ShearlingCatalogPage = lazy(async () => ({ default: (await import('./components/ShearlingCatalogPage')).ShearlingCatalogPage }))
const ShearlingProductPage = lazy(async () => ({ default: (await import('./components/ShearlingCatalogPage')).ShearlingProductPage }))
const SuedeCatalogPage = lazy(async () => ({ default: (await import('./components/SuedeCatalogPage')).SuedeCatalogPage }))
const SuedeProductPage = lazy(async () => ({ default: (await import('./components/SuedeCatalogPage')).SuedeProductPage }))
const ShoeLeatherCatalogPage = lazy(async () => ({ default: (await import('./components/ShoeLeatherCatalogPage')).ShoeLeatherCatalogPage }))
const ShoeLeatherProductPage = lazy(async () => ({ default: (await import('./components/ShoeLeatherCatalogPage')).ShoeLeatherProductPage }))
const HardwareCatalogPage = lazy(async () => ({ default: (await import('./components/HardwareCatalogPage')).HardwareCatalogPage }))
const HardwareProductPage = lazy(async () => ({ default: (await import('./components/HardwareCatalogPage')).HardwareProductPage }))
const GenericCatalogPage = lazy(async () => ({ default: (await import('./components/ApiCategoryPages')).GenericCatalogFromApi }))
const GenericProductPage = lazy(async () => ({ default: (await import('./components/ApiCategoryPages')).GenericProductFromApi }))
const SaleProductsSection = lazy(async () => ({ default: (await import('./components/SaleProducts')).SaleProductsSection }))
const SalePage = lazy(async () => ({ default: (await import('./components/SaleProducts')).SalePage }))
const NewPage = lazy(async () => ({ default: (await import('./components/SaleProducts')).NewPage }))
const DeliveryPaymentPage = lazy(async () => ({ default: (await import('./components/DeliveryPaymentPage')).DeliveryPaymentPage }))
const ContactsPage = lazy(async () => ({ default: (await import('./components/ContactsPage')).ContactsPage }))
const PrivacyPage = lazy(async () => ({ default: (await import('./components/PrivacyPage')).PrivacyPage }))
const AiAssistantWidget = lazy(async () => ({ default: (await import('./components/AiAssistantWidget')).AiAssistantWidget }))
const CartDrawer = lazy(async () => ({ default: (await import('./components/cart/CartDrawer')).CartDrawer }))
const HomeMainTail = lazy(async () => ({ default: (await import('./components/HomeMainTail')).HomeMainTail }))

function RouteLoading() {
  return <main className="route-loading" aria-live="polite"><p>Загружаем страницу…</p></main>
}

function DeferredAiAssistant() {
  const [shouldLoad, setShouldLoad] =
    useState(false)

  useEffect(() => {
    let finished = false
    const removeListeners = () => {
      window.removeEventListener(
        'pointerdown',
        load,
      )

      window.removeEventListener(
        'keydown',
        load,
      )

      window.removeEventListener(
        'scroll',
        load,
      )

      window.removeEventListener(
        'touchstart',
        load,
      )
    }

    const cleanup = () => {
      window.clearTimeout(timeoutId)

      removeListeners()
    }

    function load() {
      if (finished) return

      finished = true
      cleanup()
      setShouldLoad(true)
    }

    window.addEventListener(
      'pointerdown',
      load,
      { passive: true },
    )

    window.addEventListener(
      'keydown',
      load,
    )

    window.addEventListener(
      'scroll',
      load,
      { passive: true },
    )

    window.addEventListener(
      'touchstart',
      load,
      { passive: true },
    )

    /*
     * Запасной запуск. Lighthouse заканчивает
     * измерение раньше, а обычный посетитель
     * всё равно увидит помощника.
     */
    const timeoutId = window.setTimeout(
      load,
      20_000,
    )

    return () => {
      finished = true
      cleanup()
    }
  }, [])

  if (!shouldLoad) {
    return null
  }

  return (
    <Suspense fallback={null}>
      <AiAssistantWidget />
    </Suspense>
  )
}

function DeferredSaleProducts() {
  const marker = useRef<HTMLDivElement>(null)
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    if (typeof IntersectionObserver !== 'function') {
      setShouldLoad(true)
      return undefined
    }

    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      setShouldLoad(true)
      observer.disconnect()
    }, { rootMargin: '800px 0px' })

    if (marker.current) observer.observe(marker.current)
    return () => observer.disconnect()
  }, [])

  return <div ref={marker} className="sale-section-deferred">{shouldLoad && <Suspense fallback={null}><SaleProductsSection /></Suspense>}</div>
}

function DeferredHomeMainTail() {
  const marker = useRef<HTMLDivElement>(null)
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    if (typeof IntersectionObserver !== 'function') {
      setShouldLoad(true)
      return undefined
    }

    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      setShouldLoad(true)
      observer.disconnect()
    }, { rootMargin: '400px 0px' })

    if (marker.current) observer.observe(marker.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={marker} className="home-main-tail-deferred">
      {shouldLoad && (
        <Suspense fallback={null}>
          <HomeMainTail/>
        </Suspense>
      )}
    </div>
  )
}

export function App() {
  if (window.location.pathname.startsWith('/admin')) return <Suspense fallback={<RouteLoading/>}><AdminPageV2 /></Suspense>
  return (
    <CartProvider>
      <Suspense fallback={<RouteLoading />}>
        <AppRoutes />
      </Suspense>

      <DeferredAiAssistant />

      <Suspense fallback={null}>
        <CartDrawer />
      </Suspense>
    </CartProvider>
  )
}

function AppRoutes() {
  const pathname = useAppPathname()
  useEffect(() => {
    let sent = false

    const send = () => {
      if (sent) return
      sent = true
      void trackPageView(pathname)
    }

    const onLoad = () => {
      window.setTimeout(send, 0)
    }

    const fallback = window.setTimeout(send, 5_000)

    if (document.readyState === 'complete') {
      onLoad()
    } else {
      window.addEventListener('load', onLoad, { once: true })
    }

    return () => {
      sent = true
      window.clearTimeout(fallback)
      window.removeEventListener('load', onLoad)
    }
  }, [pathname])
  const isAboutPage = ['/about', '/about/', '/kozhaozelif', '/kozhaozelif/'].includes(pathname)
  const isWholesalePage = ['/kozhaoptom', '/kozhaoptom/'].includes(pathname)
  const isSewingProductionPage = ['/production', '/production/'].includes(pathname)
  const isCatalogSeoLandingPage = hasCatalogSeoLanding(pathname)
  const isClothingCatalogPage = ['/odejnayakozha', '/odejnayakozha/', '/catalog/clothing-leather', '/catalog/clothing-leather/'].includes(pathname)
  const isClothingProductPage = /^\/odejnayakozha\/tproduct\/\d+-/.test(pathname)
  const isShearlingCatalogPage = ['/dublyonka', '/dublyonka/'].includes(pathname)
  const isShearlingProductPage = /^\/dublyonka\/tproduct\/\d+-/.test(pathname)
  const isSuedeCatalogPage = ['/zamsha', '/zamsha/'].includes(pathname)
  const isSuedeProductPage = /^\/zamsha\/tproduct\/\d+-/.test(pathname)
  const isShoeLeatherCatalogPage = ['/obuvnayakozha', '/obuvnayakozha/'].includes(pathname)
  const isShoeLeatherProductPage = /^\/obuvnayakozha\/tproduct\/\d+-/.test(pathname)
  const isHardwareCatalogPage = ['/furnitura', '/furnitura/'].includes(pathname)
  const isHardwareProductPage = /^\/furnitura\/tproduct\/\d+-/.test(pathname)
  const isSalePage = ['/sale', '/sale/'].includes(pathname)
  const isNewPage = ['/new', '/new/'].includes(pathname)
  const isDeliveryPage = ['/delivery', '/delivery/', '/info', '/info/'].includes(pathname)
  const isContactsPage = ['/contacts', '/contacts/'].includes(pathname)
  const isPrivacyPage = ['/privacy', '/privacy/'].includes(pathname)
  const genericProductMatch = pathname.match(/^\/([a-z0-9-]+)\/tproduct\/[^/]+\/?$/)
  const genericCategoryMatch = pathname.match(/^\/([a-z0-9-]+)\/?$/)
  useEffect(() => {
    const revealNode = (
      node: Element,
      observer: IntersectionObserver | null,
    ) => {
      if (
        !node.classList.contains('reveal')
        || node.classList.contains('is-visible')
      ) {
        return
      }

      if (!observer) {
        node.classList.add('is-visible')
        return
      }

      observer.observe(node)
    }

    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) return

            entry.target.classList.add('is-visible')
            observer?.unobserve(entry.target)
          })
        },
        { threshold: 0.12 },
      )
      : null

    const observeRevealTree = (root: ParentNode) => {
      if (root instanceof Element) {
        revealNode(root, observer)
      }

      root
        .querySelectorAll('.reveal')
        .forEach(node => revealNode(node, observer))
    }

    /*
     * Homepage sections can be mounted later through React.lazy.
     * Observe newly inserted .reveal nodes as well as the initial DOM,
     * otherwise their content can remain permanently transparent.
     */
    observeRevealTree(document)

    const mutationObserver = new MutationObserver(records => {
      records.forEach(record => {
        record.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return
          observeRevealTree(node)
        })
      })
    })

    mutationObserver.observe(
      document.body,
      {
        childList: true,
        subtree: true,
      },
    )

    return () => {
      mutationObserver.disconnect()
      observer?.disconnect()
    }
  }, [pathname])
  if (isAboutPage) return <AboutPage/>
  if (isWholesalePage) return <WholesalePage/>
  if (isSewingProductionPage) return <SewingProductionPage/>
  if (isClothingProductPage) return <ClothingLeatherProductPage/>
  if (isCatalogSeoLandingPage) return <CatalogSeoLandingPage pathname={pathname}/>
  if (isShearlingProductPage) return <ShearlingProductPage/>
if (isShearlingCatalogPage) return <ShearlingCatalogPage/>
  if (isSuedeProductPage) return <SuedeProductPage/>
  if (isSuedeCatalogPage) return <SuedeCatalogPage/>
  if (isShoeLeatherProductPage) return <ShoeLeatherProductPage/>
  if (isShoeLeatherCatalogPage) return <ShoeLeatherCatalogPage/>
  if (isHardwareProductPage) return <HardwareProductPage/>
  if (isHardwareCatalogPage) return <HardwareCatalogPage/>
  if (isSalePage) return <SalePage/>
  if (isNewPage) return <NewPage/>
  if (isDeliveryPage) return <DeliveryPaymentPage/>
  if (isContactsPage) return <ContactsPage/>
  if (isPrivacyPage) return <PrivacyPage/>
if (isClothingCatalogPage) return <ClothingLeatherCatalogPage/>
  if (genericProductMatch) return <GenericProductPage categorySlug={genericProductMatch[1]} />
  if (genericCategoryMatch) return <GenericCatalogPage categorySlug={genericCategoryMatch[1]} />
  const schema = {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'Store'],
    '@id': `${SITE}/#organization`,
    name: 'OZELIF',
    alternateName: ['Озелиф', 'OZELIF Кожа'],
    legalName: 'ИП Касумов Элхан Низамхан Оглы',
    url: SITE,
    telephone: '+7-903-370-78-54',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Москва',
      streetAddress: 'Краснобогатырская улица, 24',
      addressCountry: 'RU',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 55.811503,
      longitude: 37.698942,
    },
    sameAs: [
      'https://t.me/ozelifleather',
      'https://vk.com/ozelifleatherofficial',
      'https://yandex.ru/maps/org/ozelif_kozha/242632009920/',
    ],
  }
  const hasPersistentHomeHero = document.querySelector(
    '[data-home-prerender-hero="true"]',
  ) !== null

  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}/><Header/><main>{!hasPersistentHomeHero && <Hero/>}<Catalog/><DeferredSaleProducts/><DeferredHomeMainTail/></main><Footer/></>
}
