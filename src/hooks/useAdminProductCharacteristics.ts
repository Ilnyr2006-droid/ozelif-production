import { useEffect, useState } from 'react'

type PublicProduct = {
  attributes?: Record<string, unknown> | null
}

export function useAdminProductCharacteristics(legacyId?: string | null) {
  const [attributes, setAttributes] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!legacyId) {
      setAttributes(null)
      return () => {
        cancelled = true
      }
    }

    fetch(`/api/public/products/${encodeURIComponent(legacyId)}`)
      .then(async response => {
        if (response.status === 404) return null
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<{ item: PublicProduct }>
      })
      .then(result => {
        if (!cancelled) setAttributes(result?.item?.attributes ?? null)
      })
      .catch(() => {
        if (!cancelled) setAttributes(null)
      })

    return () => {
      cancelled = true
    }
  }, [legacyId])

  return attributes
}