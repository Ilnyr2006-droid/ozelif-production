function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('ru')
    .replace(/ё/gu, 'е')
    .replace(/\s+/gu, ' ')
}

const CONTACTS =
  /(?:контакт|телефон|номер|адрес|шоурум|склад|магазин|где\s+(?:вы|находит\p{L}*|располож\p{L}*)|как\s+(?:вас|с вами)\s+(?:найти|связаться)|реквизит|инн|огрн)/iu

const DELIVERY =
  /(?:доставк|самовывоз|сдэк|курьер|оплат|предоплат|транспортн\p{L}*\s+компан)/iu

const WHOLESALE =
  /(?:опт|оптов|пачк|парт(?:ия|ию|ии)|регулярн\p{L}*\s+закуп)/iu

const PRODUCTION =
  /(?:швейн\p{L}*\s+производ|пошив|сшить|отшив|лекал|тираж|образец\s+модел)/iu

const PRODUCT_NOUN =
  /(?:кож|замш|дублен|овчин|фурнит|молни|кнопк|пряжк|люверс|материал|товар|napato|vegetale|merinos|меринос|toskana|izlanda|eskitme)/iu

const PRODUCT_REQUEST =
  /(?:подбер|найд|покаж|посовет|рекоменд|ищ|нужн|хочу|куп|цена|стоим|сколько\s+стоит|характерист|толщин|цвет|фактур|покрыт|размер\s+шкур|производител|происхожд|налич|остат)/iu

const CART =
  /(?:корзин|добав\p{L}*\s+(?:в\s+)?(?:заказ|корзин)|удал\p{L}*\s+(?:из\s+)?(?:заказ|корзин)|оформ\p{L}*\s+(?:заказ|заявк)|количеств\p{L}*\s+(?:товар|позиц))/iu

export function routeAssistantRequest(value) {
  const text = normalize(value)

  if (!text) {
    return {
      intent: 'general',
      needsProducts: false,
    }
  }

  if (CART.test(text)) {
    return {
      intent: 'product',
      needsProducts: true,
    }
  }

  const productLike =
    PRODUCT_NOUN.test(text)
    && PRODUCT_REQUEST.test(text)

  if (productLike) {
    return {
      intent: 'product',
      needsProducts: true,
    }
  }

  if (PRODUCTION.test(text)) {
    return {
      intent: 'production',
      needsProducts: false,
    }
  }

  if (WHOLESALE.test(text)) {
    return {
      intent: 'wholesale',
      needsProducts: false,
    }
  }

  if (DELIVERY.test(text)) {
    return {
      intent: 'delivery',
      needsProducts: false,
    }
  }

  if (CONTACTS.test(text)) {
    return {
      intent: 'contacts',
      needsProducts: false,
    }
  }

  return {
    intent: 'general',
    needsProducts: false,
  }
}
