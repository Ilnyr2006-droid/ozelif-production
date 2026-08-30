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
