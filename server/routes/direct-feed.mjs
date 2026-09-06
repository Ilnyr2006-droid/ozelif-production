import { Router } from 'express'
import { DIRECT_FEED_QUERY, renderDirectFeed } from '../lib/direct-feed.mjs'

export function createDirectFeedRouter({ query, siteUrl }) {
  const router = Router()
  router.get('/api/public/direct-feed.xml', async (_request, response, next) => {
    try {
      const result = renderDirectFeed((await query(DIRECT_FEED_QUERY)).rows, siteUrl)
      response.set('Cache-Control', 'public, max-age=300').set('X-Feed-Offers', String(result.count)).set('X-Feed-Unknown-Stock', String(result.excluded.unknownStock)).type('application/xml').send(result.xml)
    } catch (error) { next(error) }
  })
  return router
}
