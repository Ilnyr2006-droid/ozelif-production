import { useCallback, useEffect, useState } from 'react'
import { fetchAllPublicCatalogProducts, fetchPublicCatalogCategories, fetchPublicCatalogNewest, fetchPublicCatalogProduct, fetchPublicCatalogSale, normalizePublicCatalogProduct, type PublicCatalogApiProduct, type PublicCatalogCategory, type PublicCatalogListResponse, type PublicCatalogProduct } from '../api/publicCatalog'

type LoadState<T> = { data: T | null; isLoading: boolean; error: Error | null }

function useLoader<T>(load: (signal: AbortSignal) => Promise<T>, key: string): LoadState<T> & { retry(): void } {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<LoadState<T>>({ data: null, isLoading: true, error: null })
  useEffect(() => {
    const controller = new AbortController()
    setState({ data: null, isLoading: true, error: null })
    load(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ data, isLoading: false, error: null })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ data: null, isLoading: false, error: error instanceof Error ? error : new Error('catalog-load-failed') })
    })
    return () => controller.abort()
  }, [key, load, revision])
  return { ...state, retry: () => setRevision(current => current + 1) }
}


function readProductBootstrap(categorySlug: string, identifier: string) {
  if (typeof document === 'undefined') return null

  const node = document.getElementById('ozelif-product-bootstrap')
  if (!node?.textContent) return null

  try {
    const payload = JSON.parse(node.textContent) as {
      categorySlug?: string
      item?: PublicCatalogApiProduct
    }

    if (payload.categorySlug !== categorySlug || !payload.item) return null

    const product = normalizePublicCatalogProduct(payload.item)
    return product.id === identifier || product.slug === identifier
      ? product
      : null
  } catch {
    return null
  }
}

export function usePublicCatalog(categorySlug: string) {
  const load = useCallback((signal: AbortSignal) => fetchAllPublicCatalogProducts(categorySlug, signal), [categorySlug])
  return useLoader<PublicCatalogListResponse>(load, categorySlug)
}

export function usePublicCatalogProduct(categorySlug: string, identifier: string) {
  const [bootstrap] = useState<PublicCatalogProduct | null>(
    () => readProductBootstrap(categorySlug, identifier),
  )
  const load = useCallback(
    (signal: AbortSignal) => fetchPublicCatalogProduct(categorySlug, identifier, signal),
    [categorySlug, identifier],
  )
  const remote = useLoader<PublicCatalogProduct>(load, `${categorySlug}:${identifier}`)

  if (bootstrap && !remote.data) {
    return {
      data: bootstrap,
      isLoading: false,
      error: null,
      retry: remote.retry,
    }
  }

  return remote
}

function waitForInitialPageLoad(signal: AbortSignal) {
  if (
    import.meta.env.MODE === 'test'
    || typeof document === 'undefined'
    || document.readyState === 'complete'
  ) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener('load', onLoad)
      signal.removeEventListener('abort', onAbort)
    }

    const onLoad = () => {
      cleanup()
      resolve()
    }

    const onAbort = () => {
      cleanup()
      reject(new DOMException('Aborted', 'AbortError'))
    }

    window.addEventListener('load', onLoad, { once: true })
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export function usePublicCatalogCategories() {
  const load = useCallback(async (signal: AbortSignal) => {
    await waitForInitialPageLoad(signal)
    return fetchPublicCatalogCategories(signal)
  }, [])
  return useLoader<PublicCatalogCategory[]>(load, 'public-catalog-categories')
}

export function usePublicCatalogSale() {
  const load = useCallback((signal: AbortSignal) => fetchPublicCatalogSale(signal), [])
  return useLoader<PublicCatalogProduct[]>(load, 'public-catalog-sale')
}

export function usePublicCatalogNewest() {
  const load = useCallback((signal: AbortSignal) => fetchPublicCatalogNewest(signal), [])
  return useLoader<PublicCatalogProduct[]>(load, 'public-catalog-newest')
}
