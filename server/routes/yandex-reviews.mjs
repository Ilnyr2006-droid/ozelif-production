import express from 'express'
import { createYandexReviewsService, fallbackYandexReviews } from '../lib/yandex-reviews.mjs'

export function createYandexReviewsRouter({ service = createYandexReviewsService() } = {}) {
  const router = express.Router()

  router.get('/', async (_request, response) => {
    try {
      const reviews = await service.getReviews()
      response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
      response.json(reviews)
    } catch {
      response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
      response.json(fallbackYandexReviews())
    }
  })

  return router
}
