
import { pool } from '../lib/db.mjs'
import { getPricingSettings, refreshCbrRate } from '../lib/pricing.mjs'

try {
  const settings = await getPricingSettings()

  if (!settings.auto_update && process.argv[2] !== '--force') {
    console.log('Автоматическое обновление курса отключено')
  } else {
    const updated = await refreshCbrRate()
    console.log({
      usdRate: updated.usd_rate,
      rateDate: updated.rate_date,
      markupPercent: updated.markup_percent,
    })
  }
} finally {
  await pool.end()
}
