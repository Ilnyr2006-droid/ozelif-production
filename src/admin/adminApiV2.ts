
export type AdminUser = {
  id: string
  email: string
  name: string
  role: string
}

export type Catalog = {
  id: string
  name: string
  slug: string
  description: string
  cover_image: string | null
  sort_order: number
  is_published: boolean
  attributes: Record<string, unknown> | null
  show_on_home: boolean
  show_in_menu: boolean
  products_count: number
}

export type Variant = {
  id?: string
  name: string
  sku?: string | null
  sourcePriceUsd: string | number | null
  sourceOldPriceUsd: string | number | null
  priceRub?: string | number | null
  oldPriceRub?: string | number | null
  unit?: string | null
  stockQuantity?: string | number | null
  isActive: boolean
}

export type Product = {
  id: string
  category_id: string
  category_name: string
  category_slug: string
  name: string
  slug: string
  description: string
  sku: string | null
  source_price_usd: string | null
  source_old_price_usd: string | null
  base_price: string | null
  old_price: string | null
  unit: string | null
  stock_quantity: string | null
  min_order: string | null
  primary_image: string | null
  is_published: boolean
  variants: Variant[]
  attributes?: Record<string, unknown> | null
}

export type TrafficAnalytics = {
  summary: {
    online_now: number
    visitors_today: number
    page_views_today: number
    visitors_7d: number
    page_views_7d: number
  }
  daily: Array<{
    date: string
    visitors: number
    page_views: number
  }>
  funnel: Array<{
    event_name: string
    label: string
    sessions: number
  }>
  demand: {
    products: Array<{
      product_id: string
      product_name: string
      category_name: string
      category_slug: string
      views: number
      viewers: number
      cart_adds: number
      requests: number
    }>
    categories: Array<{
      category_name: string
      category_slug: string
      views: number
      viewers: number
    }>
    filters: Array<{
      category_slug: string
      filter: string
      value: string
      uses: number
      users: number
    }>
    emptySearches: Array<{
      category_slug: string
      query: string
      searches: number
      users: number
    }>
    contacts: Array<{
      channel: 'whatsapp' | 'telegram' | 'phone' | 'route'
      clicks: number
      users: number
    }>
  }
  generatedAt: string
}

export type PricingSettings = {
  markup_percent: string
  usd_rate: string | null
  rate_date: string | null
  rate_source: string
  auto_update: boolean
  last_checked_at: string | null
  updated_at: string
}
export type CrmOrder = { id: string; public_number: string; status: string; total_amount: string; currency: string; delivery_city?: string | null; delivery_address?: string | null; desired_delivery_date?: string | null; customer_email_snapshot?: string | null; customer_email?: string | null; customer_comment?: string | null; source?: string; items_summary?: string; delivery_method: string | null; delivery_company: string | null; tracking_number: string | null; created_at: string; updated_at: string; customer_name: string | null; original_phone: string }
export type CrmCustomer = { id: string; name: string | null; original_phone: string; email: string | null; source?: string | null; orders_count: number; chats_count?: number; total_amount: string; last_order_at: string | null; telegram_linked: boolean }

export type WholesaleLead = {
  id: string
  public_number: string
  name: string
  phone: string
  normalized_phone: string
  company: string | null
  city: string | null
  category: string | null
  volume: string | null
  comment: string | null
  source: string
  status: string
  page_path: string | null
  created_at: string
  updated_at: string
}

export type ProductionLead = {
  id: string
  public_number: string
  name: string
  phone: string
  normalized_phone: string
  product_type: string | null
  quantity: string | null
  comment: string | null
  source: string
  status: string
  page_path: string | null
  created_at: string
  updated_at: string
}


export type ManagerLead = {
  id: string
  public_number: string
  name: string
  phone: string
  normalized_phone: string
  comment: string | null
  source: string
  status: string
  page_path: string | null
  created_at: string
  updated_at: string
}


async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: init?.body instanceof FormData
      ? init.headers
      : { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })

  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(body.error || `HTTP ${response.status}`)
  }

  return body as T
}

export const adminApiV2 = {
  session: () => request<{ user: AdminUser }>('/api/admin/session'),
  login: (username: string, password: string) =>
    request<{ user: AdminUser }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<void>('/api/admin/logout', { method: 'POST' }),
  dashboard: () => request<{
    metrics: Record<string, number>
    recentActivity: Array<Record<string, string>>
  }>('/api/admin/dashboard'),

  trafficAnalytics: () =>
    request<TrafficAnalytics>('/api/admin/analytics/traffic'),

  catalogs: () => request<{ items: Catalog[] }>('/api/admin/v2/catalogs'),
  createCatalog: (payload: Record<string, unknown>) =>
    request<{ item: Catalog }>('/api/admin/v2/catalogs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCatalog: (id: string, payload: Record<string, unknown>) =>
    request<{ item: Catalog }>(`/api/admin/v2/catalogs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteCatalog: (id: string) =>
    request<void>(`/api/admin/v2/catalogs/${id}`, { method: 'DELETE' }),

  products: (categoryId = '', q = '') => {
    const params = new URLSearchParams()
    if (categoryId) params.set('categoryId', categoryId)
    if (q) params.set('q', q)
    const suffix = params.toString() ? `?${params}` : ''
    return request<{ items: Product[] }>(`/api/admin/v2/products${suffix}`)
  },
  createProduct: (payload: Record<string, unknown>) =>
    request<{ item: Product }>('/api/admin/v5/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProduct: (id: string, payload: Record<string, unknown>) =>
    request<{ item: Product }>(`/api/admin/v5/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteProduct: (id: string) =>
    request<void>(`/api/admin/v2/products/${id}`, { method: 'DELETE' }),

  pricing: () =>
    request<{ settings: PricingSettings }>('/api/admin/v2/pricing'),
  updatePricing: (payload: { markupPercent: number; autoUpdate: boolean }) =>
    request<{ settings: PricingSettings }>('/api/admin/v2/pricing', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  refreshPricing: () =>
    request<{ settings: PricingSettings }>('/api/admin/v2/pricing/refresh', {
      method: 'POST',
    }),

  upload: async (file: File) => {
    const data = new FormData()
    data.append('file', file)
    return request<{ url: string }>('/api/admin/uploads', {
      method: 'POST',
      body: data,
    })
  },
  productionLeads: (q = '', status = '') =>
    request<{
      items: ProductionLead[]
      total: number
      newCount: number
    }>(
      '/api/admin/crm/production-leads?'
      + new URLSearchParams({ q, status }).toString(),
    ),

  updateProductionLeadStatus: (
    id: string,
    status: string,
  ) =>
    request<{ item: ProductionLead }>(
      `/api/admin/crm/production-leads/${
        encodeURIComponent(id)
      }/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
    ),

  deleteProductionLead: (id: string) =>
    request<void>(
      `/api/admin/crm/production-leads/${
        encodeURIComponent(id)
      }`,
      {
        method: 'DELETE',
      },
    ),

  wholesaleLeads: (q = '', status = '') =>
    request<{
      items: WholesaleLead[]
      total: number
      newCount: number
    }>(
      '/api/admin/crm/wholesale-leads?'
      + new URLSearchParams({ q, status }).toString(),
    ),

  updateWholesaleLeadStatus: (
    id: string,
    status: string,
  ) =>
    request<{ item: WholesaleLead }>(
      `/api/admin/crm/wholesale-leads/${
        encodeURIComponent(id)
      }/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
    ),

  deleteWholesaleLead: (id: string) =>
    request<void>(
      `/api/admin/crm/wholesale-leads/${
        encodeURIComponent(id)
      }`,
      {
        method: 'DELETE',
      },
    ),

  managerLeads: (
    q = '',
    status = '',
  ) =>
    request<{
      items: ManagerLead[]
      total: number
      newCount: number
    }>(
      '/api/admin/crm/manager-leads?'
      + new URLSearchParams({
        q,
        status,
      }).toString(),
    ),

  updateManagerLeadStatus: (
    id: string,
    status: string,
  ) =>
    request<{ item: ManagerLead }>(
      `/api/admin/crm/manager-leads/${
        encodeURIComponent(id)
      }/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status,
        }),
      },
    ),

  deleteManagerLead: (
    id: string,
  ) =>
    request<void>(
      `/api/admin/crm/manager-leads/${
        encodeURIComponent(id)
      }`,
      {
        method: 'DELETE',
      },
    ),

  crmOrders: (q = '', status = '') => request<{ items: CrmOrder[]; total: number }>('/api/admin/crm/orders?' + new URLSearchParams({ q, status }).toString()),
  crmCustomers: () => request<{ items: CrmCustomer[] }>('/api/admin/crm/customers'),
  crmCustomer: (id: string) => request<{ item: CrmCustomer; orders: CrmOrder[]; chats: Array<{ id: string; visitorName: string | null; visitorPhone: string | null; status: string; lastMessageAt: string | null; createdAt: string }> }>(`/api/admin/crm/customers/${encodeURIComponent(id)}`),
  deleteCustomer: (id: string) =>
    request<void>(
      `/api/admin/crm/customers/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  crmOrder: (id: string) => request<{ item: CrmOrder & Record<string, unknown>; items: Array<Record<string, unknown>>; history: Array<Record<string, unknown>>; chats: Array<Record<string, unknown>>; outbox: Array<Record<string, unknown>> }>(`/api/admin/crm/orders/${encodeURIComponent(id)}`),
  updateOrderStatus: (id: string, payload: Record<string, unknown>) => request<{ item: CrmOrder }>(`/api/admin/crm/orders/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteOrder: (id: string) =>
    request<void>(
      `/api/admin/crm/orders/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
}
