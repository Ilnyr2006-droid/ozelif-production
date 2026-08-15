import { useEffect, useState } from 'react'
import { ArrowUpRight, Star } from 'lucide-react'

const YANDEX_URL = 'https://yandex.ru/maps/org/ozelif_kozha/242632009920/reviews/'

type Review = { author: string; excerpt: string }
type ReviewPayload = { rating: number; ratingsCount: number; reviewsCount: number; reviews: Review[] }

const verifiedFallback: ReviewPayload = {
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
}

export function Reviews() {
  const [data, setData] = useState<ReviewPayload | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/yandex-reviews?v=242632009920', { signal: controller.signal })
      .then(response => {
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Reviews API unavailable')
        return response.json() as Promise<ReviewPayload>
      })
      .then(setData)
      .catch(error => { if (error instanceof Error && error.name !== 'AbortError') setData(verifiedFallback) })
    return () => controller.abort()
  }, [])

  return <section className="reviews section" aria-labelledby="reviews-title">
    <div className="reviews-head reveal">
      <div><p className="kicker">Отзывы • Яндекс Карты</p><h2 id="reviews-title">Материал выбирают<br/><em>с доверием</em></h2></div>
      {data && <div className="reviews-rating" aria-label={`Рейтинг ${data.rating} из 5, ${data.ratingsCount} оценок`}><Star fill="currentColor"/><b>{data.rating.toFixed(1).replace('.', ',')}</b><span>{data.ratingsCount} оценки<br/>{data.reviewsCount} отзывов</span></div>}
    </div>
    {!data ? <div className="reviews-grid" aria-label="Отзывы загружаются" aria-busy="true">{[1, 2, 3].map(item => <div className="review-card review-skeleton" key={item}><i/><i/><i/></div>)}</div> : <div className="reviews-grid">{data.reviews.slice(0, 3).map(review => <a className="review-card reveal is-visible" href={YANDEX_URL} target="_blank" rel="noreferrer" key={review.author}><span className="review-source">Яндекс Карты <ArrowUpRight size={15}/></span><blockquote>{review.excerpt}</blockquote><b>{review.author}</b><small>Подтверждённый отзыв на Яндексе</small></a>)}</div>}
    <a className="btn btn--dark reviews-cta" href={YANDEX_URL} target="_blank" rel="noreferrer">Смотреть все отзывы <ArrowUpRight size={17}/></a>
  </section>
}
