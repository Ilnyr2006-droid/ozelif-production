import fs from 'node:fs'
import dotenv from 'dotenv'

dotenv.config({
  path: '.env.admin',
  quiet: true,
})

const {
  classifyAssistantIntent,
} = await import('../lib/ai-query-intent.mjs')

const {
  findLiveProductCandidates,
  inferExplicitUse,
  selectExactProductScope,
} = await import('../lib/ai-product-retrieval.mjs')

const {
  enforceCriticalIntentFacts,
  productActions,
  sanitizeUnverifiedStockClaims,
} = await import('../lib/ai-assistant-format.mjs')

const {
  findSalesQualityViolations,
  sanitizeSalesReply,
} = await import('../lib/ai-sales-quality.mjs')

const {
  closePool,
} = await import('../lib/db.mjs')

const reportPath = String(
  process.env.OZELIF_QA_REPORT_PATH ?? '',
).trim()

const results = []

async function scenario(name, check) {
  try {
    await check()
    results.push({ name, ok: true })
    console.log(`PASS ${String(results.length).padStart(2, '0')}: ${name}`)
  } catch (error) {
    results.push({
      name,
      ok: false,
      error: error instanceof Error
        ? error.message
        : String(error),
    })

    console.error(
      `FAIL ${String(results.length).padStart(2, '0')}: ${name}`,
    )

    throw error
  }
}

function expect(value, message) {
  if (!value) {
    throw new Error(message)
  }
}

try {
  await scenario('general greeting routes as general', () => {
    expect(
      classifyAssistantIntent('Привет').type === 'general',
      'Greeting did not route to general',
    )
  })

  await scenario('public phone request routes as contacts', () => {
    expect(
      classifyAssistantIntent('Какой у вас телефон?').type === 'contacts',
      'Phone request did not route to contacts',
    )
  })

  await scenario('delivery to named city routes as delivery', () => {
    expect(
      classifyAssistantIntent(
        'Сколько стоит доставка в Казань?',
      ).type === 'delivery',
      'Delivery request did not route to delivery',
    )
  })

  await scenario('wholesale volume remains wholesale', () => {
    expect(
      classifyAssistantIntent(
        'Нужно 1500 дм² кожи оптом для производства',
      ).type === 'wholesale',
      'Wholesale request did not route to wholesale',
    )
  })

  await scenario('sewing order routes as production', () => {
    expect(
      classifyAssistantIntent(
        'Нужно сшить 20 кожаных курток',
      ).type === 'production',
      'Sewing request did not route to production',
    )
  })

  await scenario('exact product price routes as product', () => {
    expect(
      classifyAssistantIntent(
        'Сколько стоит Amazon Black?',
      ).type === 'product',
      'Exact price request did not route to product',
    )
  })

  const exact = await findLiveProductCandidates(
    'Сколько стоит Amazon Black?',
    { limit: 3 },
  )

  await scenario('exact Amazon Black returns exactly one product', () => {
    expect(
      exact.products.length === 1,
      `Expected one exact product, got ${exact.products.length}`,
    )

    expect(
      String(exact.products[0]?.name).toLowerCase()
        === 'amazon black',
      `Unexpected exact product: ${exact.products[0]?.name}`,
    )
  })

  await scenario('exact product needs no clarification', () => {
    expect(
      exact.clarificationQuestion === null,
      'Exact product received clarification',
    )
  })

  await scenario('exact scope removes unsolicited analogs', () => {
    const names = selectExactProductScope(
      [
        { name: 'Amazon Black' },
        { name: 'Vip Black' },
      ],
      'Цена Amazon Black',
    ).map(item => item.name)

    expect(
      names.length === 1 && names[0] === 'Amazon Black',
      `Unexpected exact scope: ${names.join(', ')}`,
    )
  })

  await scenario('explicit analog request keeps alternatives', () => {
    const names = selectExactProductScope(
      [
        { name: 'Amazon Black' },
        { name: 'Vip Black' },
      ],
      'Amazon Black и похожие аналоги',
    ).map(item => item.name)

    expect(
      names.length === 2,
      `Alternatives were unexpectedly narrowed: ${names.join(', ')}`,
    )
  })

  const jacket = await findLiveProductCandidates(
    'мягкая черная натуральная кожа 0,8 мм для женской куртки',
    { limit: 6 },
  )

  await scenario('seller selection returns at most three', () => {
    expect(
      jacket.products.length >= 1
        && jacket.products.length <= 3,
      `Seller returned ${jacket.products.length} products`,
    )
  })

  await scenario('pure black selection excludes White-Black', () => {
    expect(
      !jacket.products.some(product => (
        /white[-\s]?black|black[-\s]?white/iu.test(
          String(product?.name ?? ''),
        )
      )),
      'Multi-color product leaked into pure-black query',
    )
  })

  await scenario('every seller recommendation has a reason', () => {
    expect(
      jacket.products.every(product => (
        String(product?.recommendationReason ?? '').trim()
      )),
      'Recommendation reason is missing',
    )
  })

  const vague = await findLiveProductCandidates(
    'покажи черную кожу',
    { limit: 3 },
  )

  await scenario('vague black leather routes to product and asks one useful question', () => {
    const intent = classifyAssistantIntent(
      'Покажи черную кожу',
    )

    expect(
      intent.type === 'product'
        && intent.needsProducts === true,
      `Short leather request routed as ${intent.type}`,
    )

    expect(
      /Что вы планируете изготовить/u.test(
        vague.clarificationQuestion ?? '',
      ),
      `Unexpected clarification: ${vague.clarificationQuestion}`,
    )
  })

  const suede = await findLiveProductCandidates(
    'натуральная замша коричневого цвета',
    { limit: 3 },
  )

  await scenario('explicit suede stays in suede category', () => {
    expect(
      suede.constraints?.categorySlug === 'zamsha',
      `Unexpected suede category: ${suede.constraints?.categorySlug}`,
    )

    expect(
      suede.products.every(
        product => product.categorySlug === 'zamsha',
      ),
      'Non-suede product leaked into suede request',
    )
  })

  const shoes = await findLiveProductCandidates(
    'обувная кожа черного цвета',
    { limit: 3 },
  )

  await scenario('explicit shoe leather stays in shoe category', () => {
    expect(
      shoes.constraints?.categorySlug === 'obuvnayakozha',
      `Unexpected shoe category: ${shoes.constraints?.categorySlug}`,
    )

    expect(
      shoes.products.every(
        product => product.categorySlug === 'obuvnayakozha',
      ),
      'Non-shoe leather leaked into shoe request',
    )
  })

  await scenario('bag purpose is recognized', () => {
    expect(
      inferExplicitUse('кожа для женской сумки') === 'bag',
      'Bag use was not recognized',
    )
  })

  await scenario('ideal/excellent claims are softened', () => {
    const reply = sanitizeSalesReply(
      'Эта кожа идеально подойдет. '
        + 'Вторая отлично подойдет.',
    )

    expect(
      findSalesQualityViolations(reply).length === 0,
      `Violations remain: ${findSalesQualityViolations(reply)}`,
    )
  })

  await scenario('best-choice claims are softened', () => {
    const reply = sanitizeSalesReply(
      'Это лучший вариант для куртки.',
    )

    expect(
      !/лучш\p{L}*\s+вариант/iu.test(reply),
      `Best-choice language remains: ${reply}`,
    )
  })

  await scenario('guaranteed and 100 percent claims are softened', () => {
    const reply = sanitizeSalesReply(
      'Первая гарантированно подойдет, '
        + 'вторая 100% подходит.',
    )

    expect(
      findSalesQualityViolations(reply).length === 0,
      `Certainty violations remain: ${reply}`,
    )
  })

  await scenario('generic filler closing is removed', () => {
    const reply = sanitizeSalesReply(
      'Цена — 437 ₽. '
        + 'Если у вас есть дополнительные вопросы, дайте знать!',
    )

    expect(
      reply === 'Цена — 437 ₽.',
      `Generic closing remains: ${reply}`,
    )
  })

  await scenario('numbered products are formatted on separate lines', () => {
    const reply = sanitizeSalesReply(
      '1. **Vip** — 393 ₽. 2. **Andas** — 437 ₽. '
        + '3. **Soft** — 437 ₽.',
    )

    expect(
      reply.includes('\n2. **Andas**')
        && reply.includes('\n3. **Soft**'),
      `Numbered list was not normalized: ${reply}`,
    )
  })

  await scenario('production hard facts remain enforced', () => {
    const reply = enforceCriticalIntentFacts(
      'Можем обсудить модель и материалы.',
      'production',
    )

    expect(
      /10\s+издел/iu.test(reply),
      'Production minimum is missing',
    )

    expect(
      /перв\p{L}*\s+образ/iu.test(reply),
      'First sample fact is missing',
    )
  })

  await scenario('product actions remain max three and attributable', () => {
    const actions = productActions([
      ...jacket.products,
      ...jacket.products,
    ])

    expect(
      actions.length <= 3,
      `Too many actions: ${actions.length}`,
    )

    expect(
      actions.every(action => action.productId),
      'Action without productId',
    )
  })

  if (results.length !== 24) {
    throw new Error(
      `Expected 24 local scenarios, got ${results.length}`,
    )
  }

  const report = {
    total: results.length,
    passed: results.filter(item => item.ok).length,
    failed: results.filter(item => !item.ok).length,
    results,
  }

  if (reportPath) {
    fs.writeFileSync(
      reportPath,
      JSON.stringify(report, null, 2),
      'utf8',
    )
  }

  console.log()
  console.log(
    `LOCAL SALES QA: ${report.passed}/${report.total} PASS`,
  )
} finally {
  await closePool()
}
