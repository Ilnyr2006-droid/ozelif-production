
import {
  BadgeDollarSign,
  ImagePlus,
  ListChecks,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import {
  adminApiV2,
  type Catalog,
  type PricingSettings,
  type Product,
  type Variant,
} from './adminApiV2'

type CharacteristicRow = {
  id: string
  label: string
  value: string
}

type PriceRow = {
  priceUsd: string
  oldPriceUsd: string
  unit: string
}

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
  connectionType: 'Вид соединения',
  tapeColor: 'Цвет тесьмы',
  metalColor: 'Цвет металла',
  length: 'Длина',
  diameter: 'Диаметр',
}

const leatherPreset = [
  'Назначение кожи',
  'Тип сырья',
  'Материал',
  'Вид покрытия',
  'Толщина (мм)',
  'Особенности',
  'Сорт',
  'Происхождение сырья',
  'Цвет',
  'Размер шкур',
]

const hardwarePreset = [
  'Тип',
  'Бренд',
  'Страна производства',
  'Тип молнии',
  'Вид соединения',
  'Цвет тесьмы',
  'Цвет металла',
  'Длина',
  'Диаметр',
]

function valueText(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map(item => String(item ?? '').trim())
      .filter(Boolean)
      .join(' · ')
  }

  if (value === null || value === undefined || typeof value === 'object') return ''
  return String(value).trim()
}

function initialCharacteristics(
  attributes: Record<string, unknown> | null | undefined,
  categorySlug: string,
): CharacteristicRow[] {
  const existing = Object.entries(attributes ?? {})
    .filter(([label]) => !label.startsWith('__'))
    .map(([label, value], index) => ({
      id: `stored-${index}-${label}`,
      label: labelMap[label] ?? label,
      value: valueText(value),
    }))

  const preset = categorySlug === 'furnitura' ? hardwarePreset : leatherPreset
  const labels = new Set(existing.map(item => item.label.trim().toLocaleLowerCase('ru')))

  for (const label of preset) {
    if (!labels.has(label.toLocaleLowerCase('ru'))) {
      existing.push({
        id: `preset-${label}`,
        label,
        value: '',
      })
    }
  }

  return existing
}

function cleanAttributes(rows: CharacteristicRow[]) {
  const result: Record<string, string | boolean> = {
    __managed: true,
    __pricingManaged: true,
  }

  for (const row of rows) {
    const label = row.label.trim()
    const value = row.value.trim()
    if (label && value) result[label] = value
  }

  return result
}

function normalizeUnit(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase()

  if (!normalized) return ''
  if (['FOT', 'FT2', 'FT²', 'ФУТ2', 'ФУТ²'].includes(normalized)) return 'фут²'
  if (['DM2', 'DM²', 'ДМ2', 'ДМ²'].includes(normalized)) return 'дм²'
  if (['M2', 'M²', 'М2', 'М²'].includes(normalized)) return 'м²'
  if (['PCE', 'PCS', 'PC', 'ШТ', 'ШТ.'].includes(normalized)) return 'шт.'

  return value?.trim() ?? ''
}

function activeVariants(product: Partial<Product>) {
  return (product.variants ?? [])
    .filter(variant => variant.isActive !== false)
    .sort((left, right) => {
      const leftUnit = normalizeUnit(left.unit)
      const rightUnit = normalizeUnit(right.unit)

      const rank = (unit: string) => {
        if (unit === 'фут²') return 0
        if (unit === 'дм²') return 1
        if (unit === 'м²') return 2
        if (unit === 'шт.' || !unit) return 3
        return 4
      }

      return rank(leftUnit) - rank(rightUnit)
    })
}

function priceRowFromVariant(
  variant: Variant | undefined,
  fallback: {
    price?: string | number | null
    oldPrice?: string | number | null
    unit?: string | null
  } = {},
): PriceRow {
  return {
    priceUsd: String(variant?.sourcePriceUsd ?? fallback.price ?? ''),
    oldPriceUsd: String(variant?.sourceOldPriceUsd ?? fallback.oldPrice ?? ''),
    unit: normalizeUnit(variant?.unit ?? fallback.unit),
  }
}

export function ProductEditorV5({
  product,
  catalogs,
  pricing,
  onClose,
  onSaved,
}: {
  product: Partial<Product>
  catalogs: Catalog[]
  pricing: PricingSettings | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const currentCatalog = catalogs.find(item => item.id === product.category_id)
    ?? catalogs[0]
  const variants = activeVariants(product)
  const initialCategorySlug = currentCatalog?.slug ?? ''

  const primary = priceRowFromVariant(variants[0], {
    price: product.source_price_usd,
    oldPrice: product.source_old_price_usd,
    unit: initialCategorySlug === 'furnitura' ? '' : product.unit,
  })

  const secondary = priceRowFromVariant(variants[1])

  const [state, setState] = useState({
    categoryId: product.category_id ?? currentCatalog?.id ?? '',
    name: product.name ?? '',
    description: product.description ?? '',
    sku: product.sku ?? '',
    primary,
    secondary,
    primaryImage: product.primary_image ?? '',
    isPublished: product.is_published ?? true,
  })

  const [characteristics, setCharacteristics] = useState<CharacteristicRow[]>(
    initialCharacteristics(product.attributes, initialCategorySlug),
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const rate = Number(pricing?.usd_rate ?? 0)
  const markup = Number(pricing?.markup_percent ?? 0)

  const preview = (value: string | number | null | undefined) => {
    const usd = Number(String(value ?? '').replace(',', '.'))
    if (!Number.isFinite(usd) || usd <= 0 || !rate) return '—'

    return `${(usd * rate * (1 + markup / 100)).toLocaleString('ru-RU', {
      maximumFractionDigits: 2,
    })} ₽`
  }

  const computedBasePrice = useMemo(() => {
    const usd = Number(String(state.primary.priceUsd).replace(',', '.'))
    if (!Number.isFinite(usd) || usd <= 0 || !rate) return null
    return usd * rate * (1 + markup / 100)
  }, [markup, rate, state.primary.priceUsd])

  function patchPriceRow(key: 'primary' | 'secondary', patch: Partial<PriceRow>) {
    setState(current => ({
      ...current,
      [key]: {
        ...current[key],
        ...patch,
      },
    }))
  }

  function addPresetFields() {
    const catalog = catalogs.find(item => item.id === state.categoryId)
    const preset = catalog?.slug === 'furnitura' ? hardwarePreset : leatherPreset
    const labels = new Set(
      characteristics.map(item => item.label.trim().toLocaleLowerCase('ru')),
    )

    setCharacteristics(current => [
      ...current,
      ...preset
        .filter(label => !labels.has(label.toLocaleLowerCase('ru')))
        .map(label => ({
          id: `preset-${Date.now()}-${label}`,
          label,
          value: '',
        })),
    ])
  }

  async function upload(file?: File) {
    if (!file) return
    setPending(true)
    setError('')

    try {
      const result = await adminApiV2.upload(file)
      setState(current => ({ ...current, primaryImage: result.url }))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ошибка загрузки')
    } finally {
      setPending(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')

    const catalog = catalogs.find(item => item.id === state.categoryId)
    const primaryUnit = catalog?.slug === 'furnitura'
      ? ''
      : state.primary.unit.trim()
    const secondaryUnit = state.secondary.unit.trim()
    const hasSecondaryPrice = Boolean(state.secondary.priceUsd.trim())

    if (hasSecondaryPrice && !secondaryUnit) {
      setError('Для второй цены выберите единицу измерения.')
      setPending(false)
      return
    }

    if (
      hasSecondaryPrice
      && normalizeUnit(primaryUnit) === normalizeUnit(secondaryUnit)
    ) {
      setError('Для второй цены выберите другую единицу измерения.')
      setPending(false)
      return
    }

    const payload = {
      categoryId: state.categoryId,
      name: state.name,
      description: state.description,
      sku: state.sku,
      sourcePriceUsd: state.primary.priceUsd,
      sourceOldPriceUsd: state.primary.oldPriceUsd,
      unit: primaryUnit,
      secondaryPriceUsd: state.secondary.priceUsd,
      secondaryOldPriceUsd: state.secondary.oldPriceUsd,
      secondaryUnit,
      primaryImage: state.primaryImage,
      isPublished: state.isPublished,
      attributes: cleanAttributes(characteristics),
    }

    try {
      if (product.id) {
        await adminApiV2.updateProduct(product.id, payload)
      } else {
        await adminApiV2.createProduct(payload)
      }

      await onSaved()
      onClose()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось сохранить товар',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      className="admin-product-editor-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <form
        className="admin-product-editor"
        onSubmit={submit}
        aria-label={product.id ? 'Редактировать товар' : 'Новый товар'}
      >
        <header className="admin-product-editor-head">
          <div>
            <p className="admin-eyebrow">Карточка товара</p>
            <h2>{product.id ? 'Редактировать товар' : 'Создать товар'}</h2>
            <span>
              Адрес создаётся автоматически. Пустые характеристики на сайте не появляются.
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть">
            <X size={21} />
          </button>
        </header>

        <div className="admin-product-editor-layout">
          <aside className="admin-product-editor-preview">
            <div className="admin-product-image-card">
              {state.primaryImage ? (
                <img src={state.primaryImage} alt="" />
              ) : (
                <div>
                  <ImagePlus size={32} />
                  <span>Фотография товара</span>
                </div>
              )}
            </div>

            <label className="admin-product-upload">
              <Upload size={17} />
              <span>{state.primaryImage ? 'Заменить фотографию' : 'Загрузить фотографию'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={event => void upload(event.target.files?.[0])}
              />
            </label>

            <div className="admin-product-price-preview">
              <span>Расчётная основная цена</span>
              <strong>
                {computedBasePrice
                  ? `${computedBasePrice.toLocaleString('ru-RU', {
                      maximumFractionDigits: 2,
                    })} ₽`
                  : '—'}
              </strong>
              <small>
                Курс {rate ? `${rate.toFixed(2)} ₽` : 'не загружен'} · наценка {markup}%
              </small>
            </div>

            <label className="admin-product-publish">
              <input
                type="checkbox"
                checked={state.isPublished}
                onChange={event => setState({
                  ...state,
                  isPublished: event.target.checked,
                })}
              />
              <span>
                <b>Опубликован</b>
                <small>Товар доступен покупателям</small>
              </span>
            </label>
          </aside>

          <main className="admin-product-editor-content">
            <section className="admin-product-section">
              <header>
                <span><ListChecks size={18} /></span>
                <div>
                  <h3>Основная информация</h3>
                  <p>Название, каталог, артикул и описание.</p>
                </div>
              </header>

              <div className="admin-product-fields admin-product-fields--basic-v5">
                <label>
                  <span>Каталог</span>
                  <select
                    value={state.categoryId}
                    onChange={event => {
                      const catalog = catalogs.find(item => item.id === event.target.value)
                      setState(current => ({
                        ...current,
                        categoryId: event.target.value,
                        primary: {
                          ...current.primary,
                          unit: catalog?.slug === 'furnitura'
                            ? ''
                            : current.primary.unit,
                        },
                      }))
                    }}
                    required
                  >
                    {catalogs.map(catalog => (
                      <option value={catalog.id} key={catalog.id}>
                        {catalog.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Название</span>
                  <input
                    value={state.name}
                    onChange={event => setState({ ...state, name: event.target.value })}
                    required
                  />
                  <small>URL будет создан автоматически.</small>
                </label>

                <label>
                  <span>Артикул</span>
                  <input
                    value={state.sku ?? ''}
                    onChange={event => setState({ ...state, sku: event.target.value })}
                  />
                </label>

                <label className="is-wide">
                  <span>Описание</span>
                  <textarea
                    rows={4}
                    value={state.description}
                    onChange={event => setState({
                      ...state,
                      description: event.target.value,
                    })}
                  />
                </label>
              </div>
            </section>

            <section className="admin-product-section">
              <header>
                <span><BadgeDollarSign size={19} /></span>
                <div>
                  <h3>Цена</h3>
                  <p>Можно указать две независимые цены для разных единиц измерения.</p>
                </div>
              </header>

              <div className="admin-price-rows-v5">
                <div className="admin-price-row-v5">
                  <span className="admin-price-row-v5__number">01</span>

                  <label>
                    <span>Основная цена, $</span>
                    <input
                      inputMode="decimal"
                      value={state.primary.priceUsd}
                      onChange={event => patchPriceRow('primary', {
                        priceUsd: event.target.value,
                      })}
                    />
                    <small>На сайте: {preview(state.primary.priceUsd)}</small>
                  </label>

                  <label>
                    <span>Единица измерения</span>
                    <select
                      value={state.primary.unit}
                      onChange={event => patchPriceRow('primary', {
                        unit: event.target.value,
                      })}
                    >
                      <option value="">Без единицы — цена за 1 шт.</option>
                      <option value="фут²">фут²</option>
                      <option value="дм²">дм²</option>
                      <option value="м²">м²</option>
                      <option value="шт.">шт.</option>
                    </select>
                    <small>Для фурнитуры можно оставить пустым.</small>
                  </label>

                  <label>
                    <span>Старая цена, $</span>
                    <input
                      inputMode="decimal"
                      value={state.primary.oldPriceUsd}
                      onChange={event => patchPriceRow('primary', {
                        oldPriceUsd: event.target.value,
                      })}
                    />
                    <small>На сайте: {preview(state.primary.oldPriceUsd)}</small>
                  </label>
                </div>

                <div className="admin-price-row-v5">
                  <span className="admin-price-row-v5__number">02</span>

                  <label>
                    <span>Дополнительная цена, $</span>
                    <input
                      inputMode="decimal"
                      value={state.secondary.priceUsd}
                      onChange={event => patchPriceRow('secondary', {
                        priceUsd: event.target.value,
                      })}
                      placeholder="Оставьте пустым, если не нужна"
                    />
                    <small>На сайте: {preview(state.secondary.priceUsd)}</small>
                  </label>

                  <label>
                    <span>Другая единица</span>
                    <select
                      value={state.secondary.unit}
                      onChange={event => patchPriceRow('secondary', {
                        unit: event.target.value,
                      })}
                    >
                      <option value="">Выберите единицу</option>
                      <option value="фут²">фут²</option>
                      <option value="дм²">дм²</option>
                      <option value="м²">м²</option>
                      <option value="шт.">шт.</option>
                    </select>
                    <small>Должна отличаться от основной единицы.</small>
                  </label>

                  <label>
                    <span>Старая дополнительная, $</span>
                    <input
                      inputMode="decimal"
                      value={state.secondary.oldPriceUsd}
                      onChange={event => patchPriceRow('secondary', {
                        oldPriceUsd: event.target.value,
                      })}
                    />
                    <small>На сайте: {preview(state.secondary.oldPriceUsd)}</small>
                  </label>
                </div>
              </div>
            </section>

            <section className="admin-product-section">
              <header className="admin-product-section-head-actions">
                <span><ListChecks size={19} /></span>
                <div>
                  <h3>Характеристики</h3>
                  <p>Пустые значения не сохраняются и не показываются на карточке товара.</p>
                </div>
                <button type="button" onClick={addPresetFields}>
                  <Plus size={15} /> Рекомендуемые поля
                </button>
              </header>

              <div className="admin-characteristics-list">
                {characteristics.map((row, index) => (
                  <div className="admin-characteristic-row" key={row.id}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <input
                      value={row.label}
                      onChange={event => setCharacteristics(current =>
                        current.map(item => item.id === row.id
                          ? { ...item, label: event.target.value }
                          : item),
                      )}
                      placeholder="Название характеристики"
                    />
                    <input
                      value={row.value}
                      onChange={event => setCharacteristics(current =>
                        current.map(item => item.id === row.id
                          ? { ...item, value: event.target.value }
                          : item),
                      )}
                      placeholder="Значение"
                    />
                    <button
                      type="button"
                      aria-label="Удалить характеристику"
                      onClick={() => setCharacteristics(current =>
                        current.filter(item => item.id !== row.id),
                      )}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                <button
                  className="admin-characteristic-add"
                  type="button"
                  onClick={() => setCharacteristics(current => [
                    ...current,
                    {
                      id: `custom-${Date.now()}`,
                      label: '',
                      value: '',
                    },
                  ])}
                >
                  <Plus size={16} /> Добавить характеристику
                </button>
              </div>
            </section>
          </main>
        </div>

        {error && <div className="admin-product-editor-error">{error}</div>}

        <footer className="admin-product-editor-footer">
          <span>
            Если вторая цена пустая, на сайте используется только основная.
          </span>
          <div>
            <button type="button" onClick={onClose}>Отмена</button>
            <button className="admin-primary-button" disabled={pending}>
              <Save size={17} />
              {pending ? 'Сохраняем…' : 'Сохранить товар'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  )
}
