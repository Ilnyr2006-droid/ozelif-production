
import {
  BarChart3,
  Bot,
  Boxes,
  ChevronRight,
  Edit3,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShoppingBag,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  adminApiV2,
  type AdminUser,
  type Catalog,
  type PricingSettings,
  type Product,
  type Variant,
  type CrmOrder,
  type CrmCustomer,
} from './adminApiV2'
import './admin.css'
import { AdminLiveChats } from './AdminLiveChats'
import { AdminTrafficAnalytics } from './AdminTrafficAnalytics'
import { AdminWholesaleLeads } from './AdminWholesaleLeads'
import { AdminManagerLeads } from './AdminManagerLeads'
import { AdminProductionLeads } from './AdminProductionLeads'
import { ProductEditorV5 } from './ProductEditorV5'
import './admin-v2.css'

type Section = 'overview' | 'catalogs' | 'products' | 'chats' | 'analytics' | 'settings' | 'orders' | 'customers' | 'wholesale-leads' | 'production-leads' | 'manager-leads'

const emptyCatalog: Partial<Catalog> = {
  name: '',
  slug: '',
  description: '',
  cover_image: null,
  sort_order: 0,
  is_published: true,
  show_on_home: true,
  show_in_menu: true,
}

const emptyVariant = (): Variant => ({
  name: 'Основной вариант',
  sourcePriceUsd: '',
  sourceOldPriceUsd: '',
  unit: '',
  stockQuantity: '',
  isActive: true,
})

const orderStatusLabel: Record<string, string> = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  awaiting_payment: 'Ожидает оплаты',
  paid: 'Оплачен',
  assembling: 'Собирается',
  handed_to_delivery: 'Передан в доставку',
  in_transit: 'В пути',
  ready_for_pickup: 'Готов к выдаче',
  completed: 'Завершён',
  cancelled: 'Отменён',
}

const formatCrmDate = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
  : '—'

const formatCrmMoney = (value: string | number | null | undefined) => `${Number(value ?? 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`

function Login({ onLogin }: { onLogin: (user: AdminUser) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      onLogin((await adminApiV2.login(username, password)).user)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось войти')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="admin-login">
      <section className="admin-login-visual">
        <div className="admin-login-brand">OZELIF <span>admin</span></div>
        <div>
          <p className="admin-eyebrow">Единый центр управления</p>
          <h1>Каталоги, товары, цены и аналитика.</h1>
          <p>Изменяйте ассортимент и управляйте ценами из одной панели.</p>
        </div>
      </section>
      <section className="admin-login-panel">
        <form onSubmit={submit}>
          <p className="admin-eyebrow">Защищённый вход</p>
          <h2>OZELIF Admin</h2>
          <label><span>Имя пользователя</span><input type="text" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required /></label>
          <label><span>Пароль</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
          {error && <div className="admin-form-error">{error}</div>}
          <button type="submit" disabled={pending}>{pending ? 'Входим…' : 'Войти'} <ChevronRight size={17} /></button>
        </form>
      </section>
    </main>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="admin-v2-modal-backdrop" role="presentation" onMouseDown={event => {
      if (event.currentTarget === event.target) onClose()
    }}>
      <section className="admin-v2-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button onClick={onClose} aria-label="Закрыть"><X size={20} /></button></header>
        {children}
      </section>
    </div>
  )
}

function CatalogEditor({
  catalog,
  onClose,
  onSaved,
}: {
  catalog: Partial<Catalog>
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [state, setState] = useState({ ...emptyCatalog, ...catalog })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function upload(file?: File) {
    if (!file) return
    setPending(true)
    try {
      const result = await adminApiV2.upload(file)
      setState(current => ({ ...current, cover_image: result.url }))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ошибка загрузки')
    } finally {
      setPending(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    const payload = {
      name: state.name,
      slug: state.slug,
      description: state.description,
      coverImage: state.cover_image,
      sortOrder: state.sort_order,
      isPublished: state.is_published,
      showOnHome: state.show_on_home,
      showInMenu: state.show_in_menu,
    }

    try {
      if (catalog.id) await adminApiV2.updateCatalog(catalog.id, payload)
      else await adminApiV2.createCatalog(payload)
      await onSaved()
      onClose()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось сохранить')
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal title={catalog.id ? 'Редактировать каталог' : 'Новый каталог'} onClose={onClose}>
      <form className="admin-v2-form" onSubmit={submit}>
        <label><span>Название</span><input value={state.name ?? ''} onChange={e => setState({ ...state, name: e.target.value })} required /></label>
        <label><span>Адрес</span><input value={state.slug ?? ''} onChange={e => setState({ ...state, slug: e.target.value })} placeholder="mebelnaya-kozha" /></label>
        <label className="is-wide"><span>Описание</span><textarea rows={4} value={state.description ?? ''} onChange={e => setState({ ...state, description: e.target.value })} /></label>
        <label><span>Порядок</span><input type="number" value={state.sort_order ?? 0} onChange={e => setState({ ...state, sort_order: Number(e.target.value) })} /></label>
        <label><span>Обложка</span><input type="file" accept="image/*" onChange={e => void upload(e.target.files?.[0])} /></label>
        {state.cover_image && <img className="admin-v2-preview" src={state.cover_image} alt="" />}
        <label className="admin-v2-check"><input type="checkbox" checked={state.is_published ?? true} onChange={e => setState({ ...state, is_published: e.target.checked })} /><span>Опубликован</span></label>
        <label className="admin-v2-check"><input type="checkbox" checked={state.show_on_home ?? true} onChange={e => setState({ ...state, show_on_home: e.target.checked })} /><span>На главной</span></label>
        <label className="admin-v2-check"><input type="checkbox" checked={state.show_in_menu ?? true} onChange={e => setState({ ...state, show_in_menu: e.target.checked })} /><span>В меню</span></label>
        {error && <div className="admin-form-error is-wide">{error}</div>}
        <footer className="is-wide"><button type="button" onClick={onClose}>Отмена</button><button className="admin-primary-button" disabled={pending}><Save size={16} />{pending ? 'Сохраняем…' : 'Сохранить'}</button></footer>
      </form>
    </Modal>
  )
}

export function ProductEditor({
  product,
  catalogs,
  pricing,
  onClose,
  onSaved,
}: {
  product: Partial<Product>
  catalogs: Catalog[]
  pricing: PricingSettings | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [state, setState] = useState({
    category_id: product.category_id ?? catalogs[0]?.id ?? '',
    name: product.name ?? '',
    slug: product.slug ?? '',
    description: product.description ?? '',
    sku: product.sku ?? '',
    source_price_usd: product.source_price_usd ?? '',
    source_old_price_usd: product.source_old_price_usd ?? '',
    unit: product.unit ?? '',
    stock_quantity: product.stock_quantity ?? '',
    min_order: product.min_order ?? '',
    primary_image: product.primary_image ?? '',
    is_published: product.is_published ?? true,
  })
  const [variants, setVariants] = useState<Variant[]>(
    product.variants?.length ? product.variants : [emptyVariant()],
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const rate = Number(pricing?.usd_rate ?? 0)
  const markup = Number(pricing?.markup_percent ?? 0)
  const preview = (usd: string | number | null) => {
    const amount = Number(usd)
    if (!amount || !rate) return '—'
    return `${(amount * rate * (1 + markup / 100)).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`
  }

  async function upload(file?: File) {
    if (!file) return
    setPending(true)
    try {
      const result = await adminApiV2.upload(file)
      setState(current => ({ ...current, primary_image: result.url }))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ошибка загрузки')
    } finally {
      setPending(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')

    const payload = {
      categoryId: state.category_id,
      name: state.name,
      slug: state.slug,
      description: state.description,
      sku: state.sku,
      sourcePriceUsd: state.source_price_usd,
      sourceOldPriceUsd: state.source_old_price_usd,
      unit: state.unit,
      stockQuantity: state.stock_quantity,
      minOrder: state.min_order,
      primaryImage: state.primary_image,
      isPublished: state.is_published,
      variants,
    }

    try {
      if (product.id) await adminApiV2.updateProduct(product.id, payload)
      else await adminApiV2.createProduct(payload)
      await onSaved()
      onClose()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось сохранить')
    } finally {
      setPending(false)
    }
  }

  function patchVariant(index: number, patch: Partial<Variant>) {
    setVariants(current => current.map((variant, variantIndex) =>
      variantIndex === index ? { ...variant, ...patch } : variant,
    ))
  }

  return (
    <Modal title={product.id ? 'Редактировать товар' : 'Новый товар'} onClose={onClose}>
      <form className="admin-v2-form" onSubmit={submit}>
        <label><span>Каталог</span><select value={state.category_id} onChange={e => setState({ ...state, category_id: e.target.value })} required>{catalogs.map(catalog => <option value={catalog.id} key={catalog.id}>{catalog.name}</option>)}</select></label>
        <label><span>Название</span><input value={state.name} onChange={e => setState({ ...state, name: e.target.value })} required /></label>
        <label><span>Адрес</span><input value={state.slug} onChange={e => setState({ ...state, slug: e.target.value })} /></label>
        <label><span>Артикул</span><input value={state.sku} onChange={e => setState({ ...state, sku: e.target.value })} /></label>
        <label><span>Базовая цена, $</span><input type="number" min="0" step="0.0001" value={state.source_price_usd} onChange={e => setState({ ...state, source_price_usd: e.target.value })} /><small>Итого: {preview(state.source_price_usd)}</small></label>
        <label><span>Старая цена, $</span><input type="number" min="0" step="0.0001" value={state.source_old_price_usd} onChange={e => setState({ ...state, source_old_price_usd: e.target.value })} /></label>
        <label><span>Единица</span><input value={state.unit} onChange={e => setState({ ...state, unit: e.target.value })} placeholder="фут², шт." /></label>
        <label><span>Остаток</span><input type="number" min="0" step="0.001" value={state.stock_quantity} onChange={e => setState({ ...state, stock_quantity: e.target.value })} /></label>
        <label><span>Минимальный заказ</span><input type="number" min="0" step="0.001" value={state.min_order} onChange={e => setState({ ...state, min_order: e.target.value })} /></label>
        <label><span>Фотография</span><input type="file" accept="image/*" onChange={e => void upload(e.target.files?.[0])} /></label>
        {state.primary_image && <img className="admin-v2-preview" src={state.primary_image} alt="" />}
        <label className="is-wide"><span>Описание</span><textarea rows={4} value={state.description} onChange={e => setState({ ...state, description: e.target.value })} /></label>
        <label className="admin-v2-check"><input type="checkbox" checked={state.is_published} onChange={e => setState({ ...state, is_published: e.target.checked })} /><span>Опубликован</span></label>

        <section className="admin-v2-variants is-wide">
          <header><div><h3>Варианты товара</h3><p>Цена в рублях считается автоматически по курсу ЦБ и общей наценке.</p></div><button type="button" onClick={() => setVariants(current => [...current, emptyVariant()])}><Plus size={15} />Вариант</button></header>
          {variants.map((variant, index) => (
            <div className="admin-v2-variant-row" key={variant.id ?? index}>
              <input value={variant.name} onChange={e => patchVariant(index, { name: e.target.value })} placeholder="Название варианта" />
              <label><span>Цена, $</span><input type="number" min="0" step="0.0001" value={variant.sourcePriceUsd ?? ''} onChange={e => patchVariant(index, { sourcePriceUsd: e.target.value })} /><small>{preview(variant.sourcePriceUsd)}</small></label>
              <label><span>Старая, $</span><input type="number" min="0" step="0.0001" value={variant.sourceOldPriceUsd ?? ''} onChange={e => patchVariant(index, { sourceOldPriceUsd: e.target.value })} /></label>
              <input value={variant.unit ?? ''} onChange={e => patchVariant(index, { unit: e.target.value })} placeholder="Единица" />
              <button type="button" className="is-danger" onClick={() => setVariants(current => current.filter((_, i) => i !== index))}><Trash2 size={16} /></button>
            </div>
          ))}
        </section>

        {error && <div className="admin-form-error is-wide">{error}</div>}
        <footer className="is-wide"><button type="button" onClick={onClose}>Отмена</button><button className="admin-primary-button" disabled={pending}><Save size={16} />{pending ? 'Сохраняем…' : 'Сохранить товар'}</button></footer>
      </form>
    </Modal>
  )
}

function PricingPanel({
  pricing,
  onReload,
}: {
  pricing: PricingSettings | null
  onReload: () => Promise<void>
}) {
  const [markup, setMarkup] = useState(pricing?.markup_percent ?? '10')
  const [autoUpdate, setAutoUpdate] = useState(pricing?.auto_update ?? true)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setMarkup(pricing?.markup_percent ?? '10')
    setAutoUpdate(pricing?.auto_update ?? true)
  }, [pricing])

  async function save() {
    setPending(true)
    setMessage('')
    try {
      await adminApiV2.updatePricing({ markupPercent: Number(markup), autoUpdate })
      await onReload()
      setMessage('Настройки сохранены, цены пересчитаны.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ошибка')
    } finally {
      setPending(false)
    }
  }

  async function refresh() {
    setPending(true)
    setMessage('')
    try {
      await adminApiV2.refreshPricing()
      await onReload()
      setMessage('Курс ЦБ обновлён, цены пересчитаны.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ошибка')
    } finally {
      setPending(false)
    }
  }

  const rate = Number(pricing?.usd_rate ?? 0)
  const example = rate ? 10 * rate * (1 + Number(markup) / 100) : 0

  return (
    <section className="admin-card admin-v2-pricing">
      <header><div><p className="admin-eyebrow">Ценообразование</p><h2>Курс доллара и общая наценка</h2><p>Формула: цена в USD × официальный курс ЦБ × (1 + наценка).</p></div></header>
      <div className="admin-v2-pricing-grid">
        <article><span>Курс USD</span><strong>{rate ? `${rate.toLocaleString('ru-RU', { maximumFractionDigits: 4 })} ₽` : 'Не загружен'}</strong><small>{pricing?.rate_date ? `Дата курса: ${new Date(pricing.rate_date).toLocaleDateString('ru-RU')}` : 'Нажмите «Обновить курс»'}</small></article>
        <label><span>Общая наценка, %</span><input type="number" min="-100" max="1000" step="0.1" value={markup} onChange={e => setMarkup(e.target.value)} /><small>Пример: $10 → {example ? `${example.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽` : '—'}</small></label>
        <label className="admin-v2-check"><input type="checkbox" checked={autoUpdate} onChange={e => setAutoUpdate(e.target.checked)} /><span>Автоматически проверять курс</span></label>
      </div>
      <footer><button onClick={() => void refresh()} disabled={pending}><RefreshCw size={16} />Обновить курс ЦБ сейчас</button><button className="admin-primary-button" onClick={() => void save()} disabled={pending}><Save size={16} />Сохранить и пересчитать</button></footer>
      {message && <p className="admin-v2-message">{message}</p>}
    </section>
  )
}

export function AdminPageV2() {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState<Section>('overview')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [catalogs, setCatalogs] = useState<Catalog[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [pricing, setPricing] = useState<PricingSettings | null>(null)
  const [selectedCatalogId, setSelectedCatalogId] = useState('')
  const [search, setSearch] = useState('')
  const [crmOrders, setCrmOrders] = useState<CrmOrder[]>([])
  const [crmCustomers, setCrmCustomers] = useState<CrmCustomer[]>([])
  const [crmCustomerPending, setCrmCustomerPending] =
    useState<string | null>(null)
  const [crmStatus, setCrmStatus] = useState('')
  const [crmOrderPending, setCrmOrderPending] =
    useState<string | null>(null)
  const [selectedCrmCustomer, setSelectedCrmCustomer] = useState<{ item: CrmCustomer; orders: CrmOrder[]; chats: Array<{ id: string; visitorName: string | null; visitorPhone: string | null; status: string; lastMessageAt: string | null; createdAt: string }> } | null>(null)
  const [catalogEditor, setCatalogEditor] = useState<Partial<Catalog> | null>(null)
  const [productEditor, setProductEditor] = useState<Partial<Product> | null>(null)
  const [error, setError] = useState('')

  async function loadCatalogs() {
    setCatalogs((await adminApiV2.catalogs()).items)
  }

  async function loadProducts(categoryId = selectedCatalogId, q = search) {
    setProducts((await adminApiV2.products(categoryId, q)).items)
  }

  async function loadPricing() {
    setPricing((await adminApiV2.pricing()).settings)
  }

  async function reloadAll() {
    setError('')
    try {
      await Promise.all([loadCatalogs(), loadProducts(), loadPricing()])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить данные')
    }
  }
  async function loadCrm() { const [orders, customers] = await Promise.all([adminApiV2.crmOrders(search, crmStatus), adminApiV2.crmCustomers()]); setCrmOrders(orders.items); setCrmCustomers(customers.items) }
  async function openCustomer(id: string) { try { setSelectedCrmCustomer(await adminApiV2.crmCustomer(id)) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Не удалось открыть клиента') } }

  async function updateCrmOrderStatus(
    order: CrmOrder,
    status: string,
  ) {
    if (status === order.status) return

    let comment = ''

    if (status === 'cancelled') {
      const reason = window.prompt(
        'Укажите причину отмены заказа',
      )

      if (reason === null) return

      comment = reason.trim()

      if (!comment) {
        window.alert(
          'Для отмены заказа необходимо указать причину.',
        )
        return
      }
    }

    setCrmOrderPending(order.id)
    setError('')

    try {
      await adminApiV2.updateOrderStatus(
        order.id,
        {
          status,
          ...(comment ? { comment } : {}),
        },
      )

      await loadCrm()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось изменить статус заказа',
      )
    } finally {
      setCrmOrderPending(null)
    }
  }


  async function deleteCrmOrder(order: CrmOrder) {
    const approved = window.confirm(
      'Удалить выбранный заказ?\n\n'
      + 'Заказ, его товары и история статусов '
      + 'будут удалены.',
    )

    if (!approved) return

    setCrmOrderPending(order.id)
    setError('')

    try {
      await adminApiV2.deleteOrder(order.id)
      await loadCrm()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось удалить заказ',
      )
    } finally {
      setCrmOrderPending(null)
    }
  }




  async function deleteCrmCustomer(
    customer: CrmCustomer,
  ) {
    const orderCount = Number(
      customer.orders_count ?? 0,
    )

    if (orderCount > 0) {
      window.alert(
        `Нельзя удалить клиента: `
        + `у него осталось заказов — ${orderCount}.\n\n`
        + 'Сначала удалите все его заказы.',
      )

      return
    }

    const label =
      customer.name?.trim()
      || customer.original_phone

    const approved = window.confirm(
      `Удалить клиента «${label}» из CRM?`,
    )

    if (!approved) return

    setCrmCustomerPending(customer.id)
    setError('')

    try {
      await adminApiV2.deleteCustomer(
        customer.id,
      )

      if (
        selectedCrmCustomer?.item.id
        === customer.id
      ) {
        setSelectedCrmCustomer(null)
      }

      await loadCrm()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось удалить клиента',
      )
    } finally {
      setCrmCustomerPending(null)
    }
  }


  useEffect(() => {
    document.title = 'OZELIF Admin'
    adminApiV2.session()
      .then(result => setUser(result.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (user) void reloadAll()
  }, [user])

  useEffect(() => {
    if (user && section === 'products') void loadProducts()
  }, [selectedCatalogId, section])
  useEffect(() => { if (user && (section === 'orders' || section === 'customers')) void loadCrm() }, [user, section, crmStatus])

  const selectedCatalog = catalogs.find(catalog => catalog.id === selectedCatalogId)
  const visibleProducts = useMemo(() => products, [products])

  async function deleteCatalog(catalog: Catalog) {
    if (!window.confirm(`Удалить каталог «${catalog.name}»?`)) return
    try {
      await adminApiV2.deleteCatalog(catalog.id)
      await loadCatalogs()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось удалить')
    }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Удалить товар «${product.name}»?`)) return
    try {
      await adminApiV2.deleteProduct(product.id)
      await Promise.all([loadProducts(), loadCatalogs()])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось удалить')
    }
  }

  if (loading) return <div className="admin-loading"><span />Загрузка…</div>
  if (!user) return <Login onLogin={setUser} />

  const nav = [
    { id: 'overview' as const, label: 'Обзор', icon: <LayoutDashboard size={19} /> },
    { id: 'catalogs' as const, label: 'Каталоги', icon: <Boxes size={19} /> },
    { id: 'products' as const, label: 'Товары', icon: <ShoppingBag size={19} /> },
    { id: 'chats' as const, label: 'Чаты', icon: <Bot size={19} /> },
    { id: 'orders' as const, label: 'Заказы', icon: <ShoppingBag size={19} /> },
    { id: 'wholesale-leads' as const, label: 'Оптовые заявки', icon: <Users size={19} /> },
    { id: 'manager-leads' as const, label: 'Запросы менеджеру', icon: <Users size={19} /> },
    { id: 'production-leads' as const, label: 'Заявки на производство', icon: <PackagePlus size={19} /> },
    { id: 'customers' as const, label: 'Клиенты', icon: <Users size={19} /> },
    { id: 'analytics' as const, label: 'Аналитика', icon: <BarChart3 size={19} /> },
    { id: 'settings' as const, label: 'Настройки', icon: <Settings size={19} /> },
  ]

  const titles: Record<Section, string> = {
    overview: 'Обзор',
    catalogs: 'Каталоги',
    products: selectedCatalog ? `Товары: ${selectedCatalog.name}` : 'Товары',
    chats: 'Чаты',
    orders: 'Заказы',
    'wholesale-leads': 'Оптовые заявки',
    'manager-leads': 'Запросы менеджеру',
    'production-leads': 'Заявки на производство',
    customers: 'Клиенты',
    analytics: 'Аналитика',
    settings: 'Настройки',
  }

  return (
    <div className="admin-app">
      <aside className={`admin-sidebar ${mobileMenu ? 'is-open' : ''}`}>
        <div className="admin-sidebar-brand">OZELIF<span>admin panel</span></div>
        <nav>{nav.map(item => <button className={section === item.id ? 'is-active' : ''} key={item.id} onClick={() => { setSection(item.id); setMobileMenu(false) }}>{item.icon}<span>{item.label}</span></button>)}</nav>
        <div className="admin-sidebar-user"><span>{user.name[0]?.toUpperCase()}</span><div><b>{user.name}</b><small>{user.email}</small></div><button onClick={() => void adminApiV2.logout().then(() => setUser(null))}><LogOut size={18} /></button></div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-button" onClick={() => setMobileMenu(true)}><Menu size={22} /></button>
          <div><p className="admin-eyebrow">OZELIF Admin</p><h1>{titles[section]}</h1></div>
          <a href="/" target="_blank" rel="noreferrer">Открыть сайт <ChevronRight size={16} /></a>
        </header>

        {error && <div className="admin-global-error">{error}</div>}

        <div className="admin-content">
          {section === 'overview' && (
            <section className="admin-metrics">
              <article className="admin-metric-card"><Users size={20} /><p>Каталогов</p><strong>{catalogs.length}</strong></article>
              <article className="admin-metric-card"><ShoppingBag size={20} /><p>Товаров</p><strong>{catalogs.reduce((sum, catalog) => sum + Number(catalog.products_count), 0)}</strong></article>
              <article className="admin-metric-card"><BarChart3 size={20} /><p>Курс USD</p><strong>{pricing?.usd_rate ? Number(pricing.usd_rate).toFixed(2) : '—'}</strong></article>
              <article className="admin-metric-card"><Settings size={20} /><p>Наценка</p><strong>{pricing?.markup_percent ?? 10}%</strong></article>
            </section>
          )}

          {section === 'catalogs' && (
            <section className="admin-card admin-table-card">
              <header className="admin-section-head"><div><p className="admin-eyebrow">Структура сайта</p><h2>Каталоги</h2><p>Двойной клик открывает товары каталога.</p></div><button className="admin-primary-button" onClick={() => setCatalogEditor({ ...emptyCatalog })}><Plus size={17} />Новый каталог</button></header>
              <div className="admin-table admin-v2-catalog-table">
                <div className="admin-table-row admin-table-header"><span>Каталог</span><span>Адрес</span><span>Товары</span><span>Действия</span></div>
                {catalogs.map(catalog => (
                  <div className="admin-table-row admin-v2-clickable" key={catalog.id} onDoubleClick={() => { setSelectedCatalogId(catalog.id); setSection('products') }}>
                    <span className="admin-catalog-cell">{catalog.cover_image ? <img src={catalog.cover_image} alt="" /> : <i><Boxes size={18} /></i>}<b>{catalog.name}</b></span>
                    <span>/{catalog.slug}</span><span>{catalog.products_count}</span>
                    <span className="admin-v2-actions"><button onClick={() => setCatalogEditor(catalog)}><Edit3 size={16} /></button><button className="is-danger" onClick={() => void deleteCatalog(catalog)}><Trash2 size={16} /></button></span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {section === 'products' && (
            <section className="admin-card admin-table-card">
              <header className="admin-section-head"><div><p className="admin-eyebrow">Ассортимент</p><h2>{selectedCatalog?.name ?? 'Все товары'}</h2></div><button className="admin-primary-button" onClick={() => setProductEditor({ category_id: selectedCatalogId || catalogs[0]?.id, variants: [emptyVariant()] })}><PackagePlus size={17} />Новый товар</button></header>
              <div className="admin-v2-toolbar">
                <select value={selectedCatalogId} onChange={e => setSelectedCatalogId(e.target.value)}><option value="">Все каталоги</option>{catalogs.map(catalog => <option value={catalog.id} key={catalog.id}>{catalog.name}</option>)}</select>
                <div className="admin-search"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Название или артикул" onKeyDown={e => { if (e.key === 'Enter') void loadProducts() }} /></div>
                <button onClick={() => void loadProducts()}><RefreshCw size={16} />Найти</button>
              </div>
              <div className="admin-table admin-product-table">
                <div className="admin-table-row admin-table-header"><span>Товар</span><span>Каталог</span><span>Цена</span><span>Действия</span></div>
                {visibleProducts.map(product => (
                  <div className="admin-table-row admin-v2-clickable" key={product.id} onDoubleClick={() => setProductEditor(product)}>
                    <span className="admin-catalog-cell">{product.primary_image ? <img src={product.primary_image} alt="" /> : <i><ImagePlus size={18} /></i>}<b>{product.name}</b></span>
                    <span>{product.category_name}</span>
                    <span>{product.base_price ? `${Number(product.base_price).toLocaleString('ru-RU')} ₽` : '—'}<small>{product.source_price_usd ? ` · $${product.source_price_usd}` : ''}</small></span>
                    <span className="admin-v2-actions"><button onClick={() => setProductEditor(product)}><Edit3 size={16} /></button><button className="is-danger" onClick={() => void deleteProduct(product)}><Trash2 size={16} /></button></span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {section === 'settings' && <PricingPanel pricing={pricing} onReload={loadPricing} />}

          {section === 'chats' && (
            <AdminLiveChats
              embedded
              onClose={() => setSection('overview')}
            />
          )}

          {section === 'wholesale-leads' && (
            <AdminWholesaleLeads />
          )}

          {section === 'manager-leads' && (
            <AdminManagerLeads />
          )}

          {section === 'production-leads' && (
            <AdminProductionLeads />
          )}

          {section === 'orders' && (
            <section className="admin-card admin-table-card">
              <header className="admin-section-head">
                <div>
                  <p className="admin-eyebrow">CRM</p>
                  <h2>Заказы</h2>
                </div>
              </header>

              <div className="admin-v2-toolbar">
                <div className="admin-search">
                  <Search size={17} />
                  <input
                    value={search}
                    onChange={event => setSearch(
                      event.target.value,
                    )}
                    placeholder="Имя или телефон"
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        void loadCrm()
                      }
                    }}
                  />
                </div>

                <select
                  value={crmStatus}
                  onChange={event => setCrmStatus(
                    event.target.value,
                  )}
                >
                  <option value="">Все статусы</option>
                  {Object.entries(orderStatusLabel).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>

                <button onClick={() => void loadCrm()}>
                  <RefreshCw size={16} />
                  Найти
                </button>
              </div>

              <div className="admin-table admin-crm-orders-table">
                <div className="admin-table-row admin-table-header">
                  <span>Дата и время</span>
                  <span>Клиент</span>
                  <span>Телефон</span>
                  <span>Получение</span><span>Товары · кол-во</span>
                  <span>Цена</span>
                  <span>Комментарий</span>
                  <span>Статус и действия</span>
                </div>

                {crmOrders.map(order => (
                  <div
                    className="admin-table-row"
                    key={order.id}
                  >
                    <span>
                      {formatCrmDate(order.created_at)}
                      <small>
                        {order.source === 'website_cart'
                          ? 'Корзина сайта'
                          : order.source ?? '—'}
                      </small>
                    </span>

                    <span>
                      {order.customer_name ?? '—'}
                      <small>
                        {order.delivery_city
                          ?? 'Город не указан'}
                      </small><small className="admin-order-email">
  {order.customer_email_snapshot
    ?? order.customer_email
    ?? 'Без email'}
</small>
                    </span>

                    <span>
                      {order.original_phone || '—'}
                    </span><span className="admin-order-delivery">
  <b>
    {order.delivery_method === 'pickup'
      ? 'Самовывоз'
      : order.delivery_method === 'courier'
        ? 'Доставка'
        : 'Не указано'}
  </b>

  {order.delivery_method === 'courier' && (
    <>
      <small>
        {[order.delivery_city, order.delivery_address]
          .filter(Boolean)
          .join(' · ') || 'Адрес не указан'}
      </small>

      {order.desired_delivery_date && (
        <small>
          Желаемая дата:{' '}
          {new Date(
            `${order.desired_delivery_date}T00:00:00`,
          ).toLocaleDateString('ru-RU')}
        </small>
      )}
    </>
  )}
</span>

                    <span>
                      {order.items_summary ?? '—'}
                    </span>

                    <span>
                      <b>
                        {formatCrmMoney(
                          order.total_amount,
                        )}
                      </b>
                      <small>
                        {order.currency ?? 'RUB'}
                      </small>
                    </span>

                    <span className="admin-crm-comment">
                      {order.customer_comment?.trim()
                        || '—'}
                    </span>

                    <span className="admin-crm-order-actions">
                      <select
                        aria-label={
                          `Статус заказа №`
                          + order.public_number
                        }
                        value={order.status}
                        disabled={
                          crmOrderPending === order.id
                        }
                        onChange={event => {
                          void updateCrmOrderStatus(
                            order,
                            event.target.value,
                          )
                        }}
                      >
                        {Object.entries(
                          orderStatusLabel,
                        ).map(([value, label]) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        className="is-danger"
                        disabled={
                          crmOrderPending === order.id
                        }
                        aria-label={
                          `Удалить заказ №`
                          + order.public_number
                        }
                        title={
                          `Удалить заказ №`
                          + order.public_number
                        }
                        onClick={() => {
                          void deleteCrmOrder(order)
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}


          {section === 'customers' && (
            <section className="admin-card admin-table-card">
              <header className="admin-section-head">
                <div>
                  <p className="admin-eyebrow">
                    CRM
                  </p>
                  <h2>Клиенты</h2>
                </div>

                <button
                  type="button"
                  onClick={() => void loadCrm()}
                >
                  <RefreshCw size={16} />
                  Обновить
                </button>
              </header>

              <div className="admin-table admin-crm-customers-table">
                <div className="admin-table-row admin-table-header">
                  <span>Клиент</span>
                  <span>Телефон</span>
                  <span>Заказов</span>
                  <span>Чатов</span>
                  <span>Последний заказ</span>
                  <span>Источник</span>
                  <span>Действия</span>
                </div>

                {crmCustomers.map(customer => {
                  const hasOrders =
                    Number(
                      customer.orders_count ?? 0,
                    ) > 0

                  return (
                    <div
                      className="admin-table-row admin-v2-clickable"
                      key={customer.id}
                      onDoubleClick={() => {
                        void openCustomer(customer.id)
                      }}
                    >
                      <span>
                        <b>{customer.name ?? '—'}</b>
                        <small>
                          {customer.email
                            ?? 'Без email'}
                        </small>
                      </span>

                      <span>
                        {customer.original_phone
                          || '—'}
                      </span>

                      <span>
                        {customer.orders_count}
                      </span>

                      <span>
                        {customer.chats_count ?? 0}
                      </span>

                      <span>
                        {formatCrmDate(
                          customer.last_order_at,
                        )}
                      </span>

                      <span>
                        {customer.source === 'ai_chat'
                          ? 'AI-чат'
                          : customer.telegram_linked
                            ? 'Telegram'
                            : customer.source ?? '—'}
                      </span>

                      <span className="admin-crm-customer-actions">
                        <button
                          type="button"
                          onClick={() => {
                            void openCustomer(
                              customer.id,
                            )
                          }}
                        >
                          Открыть
                        </button>

                        <button
                          type="button"
                          className="is-danger"
                          disabled={
                            hasOrders
                            || crmCustomerPending
                              === customer.id
                          }
                          title={
                            hasOrders
                              ? 'Сначала удалите заказы клиента'
                              : 'Удалить клиента'
                          }
                          aria-label={
                            hasOrders
                              ? 'Удаление недоступно: у клиента есть заказы'
                              : `Удалить клиента ${
                                  customer.name
                                  ?? customer.original_phone
                                }`
                          }
                          onClick={() => {
                            void deleteCrmCustomer(
                              customer,
                            )
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {section === 'analytics' && (
            <AdminTrafficAnalytics />
          )}
        </div>
      </main>

      {catalogEditor && <CatalogEditor catalog={catalogEditor} onClose={() => setCatalogEditor(null)} onSaved={async () => { await loadCatalogs() }} />}
      {productEditor && <ProductEditorV5 product={productEditor} catalogs={catalogs} pricing={pricing} onClose={() => setProductEditor(null)} onSaved={async () => { await Promise.all([loadProducts(), loadCatalogs()]) }} />}
      {selectedCrmCustomer && <Modal title={selectedCrmCustomer.item.name ?? selectedCrmCustomer.item.original_phone} onClose={() => setSelectedCrmCustomer(null)}><section className="admin-v2-customer-detail"><p>{selectedCrmCustomer.item.original_phone}</p><p>Источник: {selectedCrmCustomer.item.source === 'ai_chat' ? 'AI-чат' : selectedCrmCustomer.item.source ?? '—'}</p><h3>Связанные чаты</h3>{selectedCrmCustomer.chats.length ? selectedCrmCustomer.chats.map(chat => <p key={chat.id}>Чат · {chat.status} · {chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleString('ru-RU') : 'без сообщений'}</p>) : <p>Нет связанных чатов.</p>}<h3>Заказы</h3>{selectedCrmCustomer.orders.length ? selectedCrmCustomer.orders.map(order => <p key={order.id}>{orderStatusLabel[order.status] ?? order.status}</p>) : <p>Заказов пока нет.</p>}</section></Modal>}
    </div>
  )
}
