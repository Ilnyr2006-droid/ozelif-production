
import { pool } from './db.mjs'

const CBR_DAILY_URL = 'https://www.cbr.ru/scripts/XML_daily.asp'

function xmlTag(block, name) {
  const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i'))
  return match?.[1]?.trim() ?? null
}

function parseCbrUsd(xml) {
  const valuteBlocks = [...xml.matchAll(/<Valute\b[^>]*>([\s\S]*?)<\/Valute>/gi)]
    .map(match => match[1])

  const usdBlock = valuteBlocks.find(block => xmlTag(block, 'CharCode') === 'USD')
  if (!usdBlock) throw new Error('В ответе Банка России не найден USD')

  const nominal = Number(xmlTag(usdBlock, 'Nominal'))
  const rawValue = xmlTag(usdBlock, 'Value')
  const value = Number(String(rawValue).replace(',', '.'))
  const dateMatch = xml.match(/<ValCurs\b[^>]*\bDate="([^"]+)"/i)

  if (!Number.isFinite(nominal) || nominal <= 0 || !Number.isFinite(value) || value <= 0) {
    throw new Error('Банк России вернул некорректный курс USD')
  }

  const rate = value / nominal
  const [day, month, year] = String(dateMatch?.[1] ?? '').split('.')
  const rateDate = day && month && year
    ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    : new Date().toISOString().slice(0, 10)

  return { rate, nominal, rateDate }
}

export async function fetchCbrUsdRate() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const response = await fetch(CBR_DAILY_URL, {
      headers: {
        'User-Agent': 'OZELIF-Admin/1.0',
        Accept: 'application/xml,text/xml,*/*',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Банк России ответил HTTP ${response.status}`)
    }

    return parseCbrUsd(await response.text())
  } finally {
    clearTimeout(timeout)
  }
}

export async function getPricingSettings(queryable = pool) {
  const result = await queryable.query(`
    SELECT markup_percent, usd_rate, rate_date, rate_source,
           auto_update, last_checked_at, updated_at
      FROM store_pricing_settings
     WHERE id = true
  `)

  if (!result.rowCount) {
    await queryable.query(`
      INSERT INTO store_pricing_settings (id, markup_percent, auto_update)
      VALUES (true, 10, true)
      ON CONFLICT (id) DO NOTHING
    `)
    return getPricingSettings(queryable)
  }

  return result.rows[0]
}

function convertedPrice(sourceUsd, settings) {
  const source = Number(sourceUsd)
  const rate = Number(settings.usd_rate)
  const markup = Number(settings.markup_percent)

  if (!Number.isFinite(source) || source <= 0) return null
  if (!Number.isFinite(rate) || rate <= 0) return null
  if (!Number.isFinite(markup)) return null

  return Math.round(source * rate * (1 + markup / 100) * 100) / 100
}

export async function recalculateProduct(client, productId, settings = null) {
  const current = settings ?? await getPricingSettings(client)

  const variants = await client.query(
    `SELECT id, source_price_usd, source_old_price_usd
       FROM product_variants
      WHERE product_id = $1`,
    [productId],
  )

  for (const variant of variants.rows) {
    await client.query(
      `UPDATE product_variants
          SET price = $2,
              old_price = $3,
              updated_at = now()
        WHERE id = $1`,
      [
        variant.id,
        convertedPrice(variant.source_price_usd, current),
        convertedPrice(variant.source_old_price_usd, current),
      ],
    )
  }

  if (variants.rowCount) {
    await client.query(
      `UPDATE products
          SET base_price = (
                SELECT min(price)
                  FROM product_variants
                 WHERE product_id = $1
                   AND is_active = true
                   AND price IS NOT NULL
              ),
              old_price = (
                SELECT min(old_price)
                  FROM product_variants
                 WHERE product_id = $1
                   AND is_active = true
                   AND old_price IS NOT NULL
              ),
              source_price_usd = COALESCE(
                source_price_usd,
                (
                  SELECT min(source_price_usd)
                    FROM product_variants
                   WHERE product_id = $1
                     AND is_active = true
                     AND source_price_usd IS NOT NULL
                )
              ),
              source_old_price_usd = COALESCE(
                source_old_price_usd,
                (
                  SELECT min(source_old_price_usd)
                    FROM product_variants
                   WHERE product_id = $1
                     AND is_active = true
                     AND source_old_price_usd IS NOT NULL
                )
              ),
              updated_at = now()
        WHERE id = $1`,
      [productId],
    )
  } else {
    const product = await client.query(
      `SELECT source_price_usd, source_old_price_usd
         FROM products
        WHERE id = $1`,
      [productId],
    )

    if (product.rowCount) {
      await client.query(
        `UPDATE products
            SET base_price = $2,
                old_price = $3,
                updated_at = now()
          WHERE id = $1`,
        [
          productId,
          convertedPrice(product.rows[0].source_price_usd, current),
          convertedPrice(product.rows[0].source_old_price_usd, current),
        ],
      )
    }
  }
}

export async function recalculateAllPrices(client, settings = null) {
  const current = settings ?? await getPricingSettings(client)
  const products = await client.query('SELECT id FROM products')

  for (const product of products.rows) {
    await recalculateProduct(client, product.id, current)
  }

  return products.rowCount
}

export async function refreshCbrRate(client = null) {
  const ownClient = !client
  const queryable = client ?? await pool.connect()

  try {
    if (ownClient) await queryable.query('BEGIN')

    const fetched = await fetchCbrUsdRate()

    await queryable.query(
      `INSERT INTO fx_rate_history
        (currency, rate, nominal, rate_date, source)
       VALUES ('USD', $1, $2, $3, 'CBR')
       ON CONFLICT (currency, rate_date, source) DO UPDATE SET
         rate = excluded.rate,
         nominal = excluded.nominal,
         fetched_at = now()`,
      [fetched.rate, fetched.nominal, fetched.rateDate],
    )

    const settingsResult = await queryable.query(
      `UPDATE store_pricing_settings
          SET usd_rate = $1,
              rate_date = $2,
              rate_source = 'CBR',
              last_checked_at = now(),
              updated_at = now()
        WHERE id = true
        RETURNING *`,
      [fetched.rate, fetched.rateDate],
    )

    await recalculateAllPrices(queryable, settingsResult.rows[0])

    if (ownClient) await queryable.query('COMMIT')
    return settingsResult.rows[0]
  } catch (error) {
    if (ownClient) await queryable.query('ROLLBACK')
    throw error
  } finally {
    if (ownClient) queryable.release()
  }
}
