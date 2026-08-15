const FALLBACK_REVIEWS = Object.freeze({
  rating: 4.9,
  ratingsCount: 37,
  reviewsCount: 20,
  reviews: [
    {
      author: '457985 Плеханова',
      excerpt: '«Очень хороший магазин, отзывчивые и профессиональные сотрудники.»',
    },
    {
      author: 'Евгения',
      excerpt: '«Отличный магазин, кожа хорошего качества.»',
    },
    {
      author: 'Нелли Федосеева',
      excerpt: '«Замечательный магазин, представлен большой ассортимент кожи.»',
    },
  ],
})

const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000
const DEFAULT_TIMEOUT_MS = 2_500

function positiveNumber(value) {
  const number = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(number) && number > 0 ? number : null
}

function nonEmptyString(value, maxLength) {
  const text = String(value ?? '').trim()
  return text ? text.slice(0, maxLength) : null
}

function getFirstArray(value) {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []
  return [value.reviews, value.items, value.data?.reviews, value.result?.reviews]
    .find(Array.isArray) ?? []
}

export function fallbackYandexReviews() {
  return structuredClone(FALLBACK_REVIEWS)
}

export function normalizeYandexReviews(payload) {
  const root = payload?.result ?? payload?.data ?? payload ?? {}
  const rawReviews = getFirstArray(payload)
  const reviews = rawReviews
    .map(item => ({
      author: nonEmptyString(item?.author ?? item?.authorName ?? item?.user?.name ?? item?.name, 100),
      excerpt: nonEmptyString(item?.excerpt ?? item?.text ?? item?.comment ?? item?.body, 500),
    }))
    .filter(review => review.author && review.excerpt)
    .slice(0, 3)

  const rating = positiveNumber(root.rating ?? root.averageRating ?? root.score)
  const ratingsCount = positiveNumber(root.ratingsCount ?? root.ratingCount ?? root.ratings_count)
  const reviewsCount = positiveNumber(root.reviewsCount ?? root.reviewCount ?? root.reviews_count)

  if (!rating || rating > 5 || !ratingsCount || !reviewsCount || !reviews.length) {
    return fallbackYandexReviews()
  }

  return {
    rating: Math.round(rating * 10) / 10,
    ratingsCount: Math.round(ratingsCount),
    reviewsCount: Math.round(reviewsCount),
    reviews,
  }
}

export function createYandexReviewsService({
  sourceUrl = '',
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  let cache = null
  let pending = null

  const getFallback = () => fallbackYandexReviews()

  async function load() {
    if (!sourceUrl || typeof fetchImpl !== 'function') return getFallback()

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetchImpl(sourceUrl, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
      if (!response?.ok) throw new Error('Yandex reviews source is unavailable')
      return normalizeYandexReviews(await response.json())
    } catch {
      return getFallback()
    } finally {
      clearTimeout(timeout)
    }
  }

  return {
    async getReviews() {
      const timestamp = now()
      if (cache && cache.expiresAt > timestamp) return structuredClone(cache.value)

      if (!pending) {
        pending = load().then(value => {
          cache = { value, expiresAt: now() + cacheTtlMs }
          return value
        }).finally(() => { pending = null })
      }

      return structuredClone(await pending)
    },
  }
}
