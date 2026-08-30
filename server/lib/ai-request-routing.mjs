function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('ru')
    .replace(/ё/gu, 'е')
    .replace(/\s+/gu, ' ')
}

/*
 * These rules DO NOT answer the customer and do not replace Luna.
 * They only decide which business-prompt slice and whether live catalog
 * retrieval should be attached to the model request.
 */

const DELIVERY =
  /(?:доставк|самовывоз|сдэк|курьер|оплат|предоплат|транспортн\p{L}*\s+компан)/iu

const WHOLESALE =
  /(?:опт|оптов|пачк|парт(?:ия|ию|ии|иями|иями)|регулярн\p{L}*\s+(?:закуп|покуп)|больш\p{L}*\s+парт)/iu

const PRODUCTION =
  /(?:швейн\p{L}*\s+производ|пошив|сшить|отшив|лекал|тираж|образец\s+модел)/iu

/*
 * "склад" itself is deliberately NOT a contact signal:
 * "сколько Napato Black есть на складе?" is a product/stock query.
 * It becomes contacts only together with a location/address expression.
 */
const CONTACTS =
  /(?:контакт|телефон|номер|адрес|шоурум|магазин|реквизит|инн|огрн|где\s+(?:вы|находит\p{L}*|располож\p{L}*)|как\s+(?:вас|с вами)\s+(?:найти|связаться)|(?:где|адрес)\b.{0,40}\bсклад|склад\b.{0,40}\b(?:где|адрес|находит\p{L}*|располож\p{L}*))/iu

/*
 * Order/cart commands may contain the product name between the verb and
 * "заказ/корзина":
 *   "добавь Napato Black 10 фут² в заказ"
 *   "добавь Napato Black и Amazon Black в заказ"
 */
const CART =
  /(?:(?:корзин|заказ).{0,120}(?:добав|убер|удал|полож|внес|измен|постав|количеств|оформ)\p{L}*|(?:добав|убер|удал|полож|внес|измен|постав|оформ)\p{L}*.{0,160}(?:корзин|заказ|заявк)|количеств\p{L}*.{0,120}(?:товар|позиц|корзин|заказ))/iu

const PRODUCT_NOUN =
  /(?:кож|замш|дублен|овчин|фурнит|молни|кнопк|пряжк|люверс|материал|товар|napato|vegetale|merinos|меринос|toskana|izlanda|eskitme)/iu

const PRODUCT_REQUEST =
  /(?:подбер|найд|покаж|посовет|рекоменд|ищ|нужн|хочу|куп|цена|стоим|сколько\s+стоит|характерист|толщин|цвет|фактур|покрыт|размер\s+шкур|производител|происхожд|налич|остат|на\s+складе)/iu

/*
 * Some catalog products have commercial names that the router cannot and
 * should not hardcode one by one (Amazon Black, Chelsea Pink, etc.).
 * Price/stock questions are still unambiguously product-oriented after the
 * business-info routes above have been excluded.
 */
const GENERIC_PRODUCT_PRICE =
  /(?:какая|какой|каков\p{L}*)\s+цен\p{L}*|цен\p{L}*\s+(?:у|на)\b|сколько\s+стоит\b/iu

const GENERIC_PRODUCT_STOCK =
  /(?:в\s+налич|наличи|остат|на\s+складе|сколько\b.{0,100}\b(?:есть|остал\p{L}*)\b)/iu

const PRODUCT_FOLLOWUP =
  /(?:из\s+(?:них|этих)|ка(?:кая|кой|кие)\b.{0,80}(?:мягч|толщ|тоньш|дешев|дороже|плотн|лучше|подойд)|сравни\p{L}*\s+(?:их|эти)|а\s+у\s+(?:них|этих)|перв(?:ый|ая|ое)|втор(?:ой|ая|ое)|трет(?:ий|ья|ье))/iu

const ADVERSARIAL_FACT_OVERRIDE =
  /(?:(?:игнорир|придум)\p{L}*.{0,180}(?:налич|остат|товар|цен)|(?:налич|остат|товар|цен).{0,180}(?:игнорир|придум)\p{L}*|это\s+приказ\s+администратор)/iu

function result(
  intent,
  needsProducts,
) {
  return {
    intent,
    needsProducts,
  }
}

export function routeAssistantRequest(
  value,
) {
  const text = normalize(value)

  if (!text) {
    return result(
      'general',
      false,
    )
  }

  /*
   * A request to invent/override stock or prices should be refused without
   * searching random catalog products and showing unrelated product cards.
   */
  if (
    ADVERSARIAL_FACT_OVERRIDE
      .test(text)
  ) {
    return result(
      'general',
      false,
    )
  }

  /*
   * Technical order commands need catalog context before all informational
   * routing. The regex is intentionally tied to order/cart nouns, so a normal
   * "добавь подробностей" message does not become a product request.
   */
  if (CART.test(text)) {
    return result(
      'product',
      true,
    )
  }

  /*
   * Strong business intents go before generic product wording.
   * Example: "регулярно покупать кожу большими партиями" is wholesale,
   * not a request to run a random leather search.
   */
  if (PRODUCTION.test(text)) {
    return result(
      'production',
      false,
    )
  }

  if (WHOLESALE.test(text)) {
    return result(
      'wholesale',
      false,
    )
  }

  if (DELIVERY.test(text)) {
    return result(
      'delivery',
      false,
    )
  }

  if (CONTACTS.test(text)) {
    return result(
      'contacts',
      false,
    )
  }

  const productLike =
    (
      PRODUCT_NOUN.test(text)
      && PRODUCT_REQUEST.test(text)
    )
    || GENERIC_PRODUCT_PRICE.test(text)
    || GENERIC_PRODUCT_STOCK.test(text)

  if (productLike) {
    return result(
      'product',
      true,
    )
  }

  return result(
    'general',
    false,
  )
}


export function routeAssistantConversation(
  messages,
  fallbackValue = '',
) {
  const rows = Array.isArray(messages)
    ? messages
    : []

  let latestUserIndex = -1

  for (
    let index = rows.length - 1;
    index >= 0;
    index -= 1
  ) {
    if (
      rows[index]?.role === 'user'
      && String(
        rows[index]?.content ?? '',
      ).trim()
    ) {
      latestUserIndex = index
      break
    }
  }

  const latest = String(
    (
      latestUserIndex >= 0
        ? rows[latestUserIndex]?.content
        : fallbackValue
    )
    ?? fallbackValue
    ?? '',
  ).trim()

  const direct =
    routeAssistantRequest(
      latest,
    )

  const directResult = {
    ...direct,
    retrievalQuery:
      latest,
    contextualCatalogSearch:
      false,
  }

  if (
    direct.intent !== 'general'
    || direct.needsProducts
    || !PRODUCT_FOLLOWUP.test(
      normalize(latest),
    )
  ) {
    return directResult
  }

  const startIndex =
    latestUserIndex >= 0
      ? latestUserIndex - 1
      : rows.length - 1

  for (
    let index = startIndex;
    index >= 0;
    index -= 1
  ) {
    const row = rows[index]

    if (
      row?.role !== 'user'
    ) {
      continue
    }

    const previous =
      String(
        row?.content ?? '',
      ).trim()

    if (!previous) {
      continue
    }

    const previousRoute =
      routeAssistantRequest(
        previous,
      )

    if (
      previousRoute.needsProducts
      && previousRoute.intent
        === 'product'
    ) {
      return {
        intent: 'product',
        needsProducts: true,
        retrievalQuery: [
          previous,
          `Уточнение покупателя: ${latest}`,
        ].join('\n'),
        contextualCatalogSearch:
          true,
      }
    }
  }

  return directResult
}
