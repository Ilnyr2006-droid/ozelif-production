import { useCallback, useEffect, useState } from 'react'
import { fetchAllPublicCatalogProducts, fetchPublicCatalogCategories, fetchPublicCatalogProduct, fetchPublicCatalogSale, type PublicCatalogCategory, type PublicCatalogListResponse, type PublicCatalogProduct } from '../api/publicCatalog'

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

export function usePublicCatalog(categorySlug: string) {
  const load = useCallback((signal: AbortSignal) => fetchAllPublicCatalogProducts(categorySlug, signal), [categorySlug])
  return useLoader<PublicCatalogListResponse>(load, categorySlug)
}

export function usePublicCatalogProduct(categorySlug: string, identifier: string) {
  const load = useCallback((signal: AbortSignal) => fetchPublicCatalogProduct(categorySlug, identifier, signal), [categorySlug, identifier])
  return useLoader<PublicCatalogProduct>(load, `${categorySlug}:${identifier}`)
}

export function usePublicCatalogCategories() {
  const load = useCallback((signal: AbortSignal) => fetchPublicCatalogCategories(signal), [])
  return useLoader<PublicCatalogCategory[]>(load, 'public-catalog-categories')
}

export function usePublicCatalogSale() {
  const load = useCallback((signal: AbortSignal) => fetchPublicCatalogSale(signal), [])
  return useLoader<PublicCatalogProduct[]>(load, 'public-catalog-sale')
}
