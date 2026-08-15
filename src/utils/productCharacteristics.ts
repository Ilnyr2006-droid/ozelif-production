export type ProductDetail = [string, string]

const labelMap: Record<string, string> = {
  purpose: 'Назначение кожи',
  appointment: 'Назначение кожи',
  material: 'Материал',
  rawMaterial: 'Тип сырья',
  raw_material: 'Тип сырья',
  coating: 'Вид покрытия',
  finish: 'Вид покрытия',
  thickness: 'Толщина (мм)',
  features: 'Особенности',
  feature: 'Особенности',
  grade: 'Сорт',
  origin: 'Происхождение сырья',
  country: 'Страна производства',
  color: 'Цвет',
  hideSize: 'Размер шкур',
  hide_size: 'Размер шкур',
  subtype: 'Тип',
  type: 'Тип',
  brand: 'Бренд',
  zipperType: 'Тип молнии',
  zipper_type: 'Тип молнии',
  connectionType: 'Вид соединения',
  connection_type: 'Вид соединения',
  tapeColor: 'Цвет тесьмы',
  tape_color: 'Цвет тесьмы',
  metalColor: 'Цвет металла',
  metal_color: 'Цвет металла',
  length: 'Длина',
  diameter: 'Диаметр',
}

const priority = [
  'Назначение кожи',
  'Тип сырья',
  'Материал',
  'Вид покрытия',
  'Толщина (мм)',
  'Особенности',
  'Сорт',
  'Происхождение сырья',
  'Страна производства',
  'Цвет',
  'Размер шкур',
  'Тип',
  'Бренд',
  'Тип молнии',
  'Вид соединения',
  'Цвет тесьмы',
  'Цвет металла',
  'Длина',
  'Диаметр',
  'Минимальный заказ',
  'Единица',
]

function visibleText(value: unknown): string | null {
  if (value === null || value === undefined || value === false) return null

  if (Array.isArray(value)) {
    const values = value
      .map(item => visibleText(item))
      .filter((item): item is string => Boolean(item))
    return values.length ? values.join(' · ') : null
  }

  if (typeof value === 'object') return null

  const text = String(value).trim()
  return text ? text : null
}

function normalizeLabel(label: string) {
  return labelMap[label] ?? label.trim()
}

function normalizeDetails(details: readonly (readonly unknown[])[]) {
  const result: ProductDetail[] = []

  for (const [rawLabel, rawValue] of details) {
    const label = normalizeLabel(String(rawLabel ?? ''))
    const value = visibleText(rawValue)
    if (!label || !value) continue
    result.push([label, value])
  }

  return result
}

export function mergeProductDetails(
  attributes: Record<string, unknown> | null | undefined,
  fallback: readonly (readonly unknown[])[],
): ProductDetail[] {
  const managed = attributes?.__managed === true
  const adminDetails = attributes
    ? normalizeDetails(
        Object.entries(attributes)
          .filter(([label]) => !label.startsWith('__')),
      )
    : []

  const source = managed
    ? adminDetails
    : [...adminDetails, ...normalizeDetails(fallback)]

  const deduplicated = new Map<string, ProductDetail>()

  for (const item of source) {
    const key = item[0].trim().toLocaleLowerCase('ru')
    if (!deduplicated.has(key)) deduplicated.set(key, item)
  }

  return [...deduplicated.values()].sort((left, right) => {
    const leftIndex = priority.indexOf(left[0])
    const rightIndex = priority.indexOf(right[0])

    if (leftIndex === -1 && rightIndex === -1) {
      return left[0].localeCompare(right[0], 'ru')
    }
    if (leftIndex === -1) return 1
    if (rightIndex === -1) return -1
    return leftIndex - rightIndex
  })
}