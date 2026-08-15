import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Menu, MessageCircle, ShoppingBag, X } from 'lucide-react'
import { telegram, whatsapp } from '../data'
import { useCart } from '../cart/CartProvider'
import { usePublicCatalogCategories } from '../hooks/usePublicCatalog'
import { defaultCatalogPresentation, presentCatalogCategory } from '../utils/catalogCategories'

export function Header({ active }: { active?: 'about' | 'wholesale' | 'production' | 'catalog' | 'delivery' | 'contacts' }) {
  const { itemCount, openCart } = useCart()
  const { data: publicCategories } = usePublicCatalogCategories()
  const catalogLinks = useMemo(() => {
    const visible = publicCategories?.filter(category => category.showInMenu).map(presentCatalogCategory)
    return visible?.length ? visible : defaultCatalogPresentation()
  }, [publicCategories])
  const isAbout = active === 'about'
  const isInner = !!active
  const links = [
    ['Швейное производство', '/production'],
    ['Оптовикам', '/kozhaoptom'],
    ['О компании', '/kozhaozelif'],
    ['Доставка и оплата', '/delivery'],
    ['Контакты', '/contacts'],
  ]

  const [open, setOpen] = useState(false)
  const [solid, setSolid] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const catalogRef = useRef<HTMLDivElement>(null)
  const catalogCloseTimer = useRef<number | null>(null)

  const cancelCatalogClose = () => {
    if (catalogCloseTimer.current !== null) {
      window.clearTimeout(catalogCloseTimer.current)
      catalogCloseTimer.current = null
    }
  }

  const openCatalog = () => {
    cancelCatalogClose()
    setCatalogOpen(true)
  }

  const closeCatalogSoon = () => {
    cancelCatalogClose()
    catalogCloseTimer.current = window.setTimeout(() => {
      setCatalogOpen(false)
      catalogCloseTimer.current = null
    }, 320)
  }

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24)
    onScroll()
    addEventListener('scroll', onScroll, { passive: true })
    return () => removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('menu-open', open)

    if (!open) {
      return () => document.body.classList.remove('menu-open')
    }

    const focusable = [...(menuRef.current?.querySelectorAll<HTMLElement>('a, button') ?? [])]
    focusable[0]?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }

      if (event.key === 'Tab' && focusable.length) {
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    addEventListener('keydown', onKey)

    return () => {
      document.body.classList.remove('menu-open')
      removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => () => {
    if (catalogCloseTimer.current !== null) {
      window.clearTimeout(catalogCloseTimer.current)
    }
  }, [])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!catalogRef.current?.contains(event.target as Node)) {
        setCatalogOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCatalogOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const catalogActive = active === 'catalog'

  return (
    <header className={`header ${
      solid || open || catalogActive ? 'header--solid' : ''
    } ${active === 'delivery' || active === 'contacts' ? 'header--hero-overlay' : ''}`}>
      <a className="brand" href={isInner ? '/' : '#top'} aria-label="OZELIF natural leather — на главную">
        OZELIF
        <span>natural leather</span>
      </a>

      <nav className="nav" aria-label="Основная навигация">
        <div
          ref={catalogRef}
          className={`nav-catalog ${catalogOpen ? 'is-open' : ''}`}
          onMouseEnter={openCatalog}
          onMouseLeave={closeCatalogSoon}
          onFocus={openCatalog}
          onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setCatalogOpen(false)
            }
          }}
        >
          <a
            className="nav-catalog-trigger"
            href="/odejnayakozha"
            aria-current={catalogActive ? 'page' : undefined}
            aria-haspopup="true"
            aria-expanded={catalogOpen}
            onClick={event => {
              if (window.matchMedia('(hover: none)').matches && !catalogOpen) {
                event.preventDefault()
                setCatalogOpen(true)
              }
            }}
          >
            Каталог
            <ChevronDown size={14} aria-hidden="true" />
          </a>

          <div
            className="catalog-dropdown"
            role="menu"
            aria-label="Разделы каталога"
            onMouseEnter={cancelCatalogClose}
            onMouseLeave={closeCatalogSoon}
          >
            <div className="catalog-dropdown-links">
              {catalogLinks.map((item, index) => (
                <a
                  href={item.href}
                  role="menuitem"
                  key={item.slug}
                  className="is-local has-image"
                >
                  <span
                    className="catalog-card-image"
                    aria-hidden="true"
                    style={{ backgroundImage: `url(${item.image})`, backgroundPosition: item.imagePosition }}
                  />
                  <span className="catalog-card-number">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <b>{item.title}</b>
                </a>
              ))}
            </div>
          </div>
        </div>

        {links.slice(0, 5).map(([label, href]) => (
          <a
            key={label}
            href={href}
            aria-current={
              (label === 'О компании' && isAbout)
              || (label === 'Оптовикам' && active === 'wholesale')
              || (label === 'Швейное производство' && active === 'production')
              || (label === 'Доставка и оплата' && active === 'delivery')
              || (label === 'Контакты' && active === 'contacts')
                ? 'page'
                : undefined
            }
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="header-actions">
        <button type="button" className="round-link header-cart-button" onClick={openCart} aria-label={`Открыть корзину, товаров: ${itemCount}`}>
          <ShoppingBag size={18}/>{itemCount > 0 && <b>{itemCount > 99 ? '99+' : itemCount}</b>}
        </button>
        <a
          className="round-link"
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          aria-label="Написать в WhatsApp"
        >
          <MessageCircle size={18} />
        </a>

        <a
          className="btn btn--light btn--small"
          href={
            catalogActive
              ? '#catalog-controls'
              : active === 'wholesale'
                ? '#wholesale-form'
                : active === 'production'
                  ? '#production-form'
                  : isAbout
                    ? '#about-contacts'
                    : active === 'contacts'
                      ? '#contacts-team'
                      : active === 'delivery'
                        ? '/contacts#contacts-team'
                        : '#contacts'
          }
        >
          {active === 'wholesale'
            ? 'Получить условия'
            : active === 'production'
              ? 'Обсудить заказ'
              : 'Подобрать материал'}
        </a>

        <button
          ref={triggerRef}
          className="menu-button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      <div
        ref={menuRef}
        id="mobile-menu"
        className={`mobile-menu ${open ? 'is-open' : ''}`}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="mobile-catalog-group">
          <span>Каталог</span>
          {catalogLinks.map(item => (
            <a href={item.href} key={item.slug} onClick={() => setOpen(false)}>
              {item.title}
            </a>
          ))}
        </div>

        {links.map(([label, href]) => (
          <a
            key={label}
            href={href}
            aria-current={
              (label === 'О компании' && isAbout)
              || (label === 'Оптовикам' && active === 'wholesale')
              || (label === 'Швейное производство' && active === 'production')
              || (label === 'Доставка и оплата' && active === 'delivery')
              || (label === 'Контакты' && active === 'contacts')
                ? 'page'
                : undefined
            }
            onClick={() => setOpen(false)}
          >
            {label}
          </a>
        ))}

        <div className="mobile-social">
          <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
          <a href={telegram} target="_blank" rel="noreferrer">Telegram</a>
        </div>
      </div>
    </header>
  )
}
