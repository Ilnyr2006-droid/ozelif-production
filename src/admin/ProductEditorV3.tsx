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

function emptyVariant(): Variant {
  return {
    name: 'Основной вариант',
    sourcePriceUsd: '',
    sourceOldPriceUsd: '',
    unit: '',
    stockQuantity: '',
    isActive: true,
  }
}

function cleanAttributes(rows: CharacteristicRow[]) {
  const result: Record<string, string | boolean> = { __managed: true }

  for (const row of rows) {
    const label = row.label.trim()
    const value = row.value.trim()
    if (label && value) result[label] = value
  }

  return result
}

export function ProductEditorV3({
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

  const [state, setState] = useState({
    categoryId: product.category_id ?? currentCatalog?.id ?? '',
    name: product.name ?? '',
    slug: product.slug ?? '',
    description: product.description ?? '',
    sku: product.sku ?? '',
    sourcePriceUsd: String(product.source_price_usd ?? ''),
    sourceOldPriceUsd: String(product.source_old_price_usd ?? ''),
    unit: product.unit ?? '',
    stockQuantity: String(product.stock_quantity ?? ''),
    minOrder: String(product.min_order ?? ''),
    primaryImage: product.primary_image ?? '',
    isPublished: product.is_published ?? true,
  })

  const [characteristics, setCharacteristics] = useState<CharacteristicRow[]>(
    initialCharacteristics(
      product.attributes,
      currentCatalog?.slug ?? '',
    ),
  )

  const [variants, setVariants] = useState<Variant[]>(
    product.variants?.length ? product.variants : [emptyVariant()],
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const rate = Number(pricing?.usd_rate ?? 0)
  const markup = Number(pricing?.markup_percent ?? 0)

  const computedBasePrice = useMemo(() => {
    const usd = Number(String(state.sourcePriceUsd).replace(',', '.'))
    if (!Number.isFinite(usd) || usd <= 0 || !rate) return null
    return usd * rate * (1 + markup / 100)
  }, [markup, rate, state.sourcePriceUsd])

  const preview = (value: string | number | null | undefined) => {
    const usd = Number(String(value ?? '').replace(',', '.'))
    if (!Number.isFinite(usd) || usd <= 0 || !rate) return '—'
    return `${(usd * rate * (1 + markup / 100)).toLocaleString('ru-RU', {
      maximumFractionDigits: 2,
    })} ₽`
  }

  function patchVariant(index: number, patch: Partial<Variant>) {
    setVariants(current => current.map((variant, variantIndex) =>
      variantIndex === index ? { ...variant, ...patch } : variant,
    ))
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

    const payload = {
      categoryId: state.categoryId,
      name: state.name,
      slug: state.slug,
      description: state.description,
      sku: state.sku,
      sourcePriceUsd: state.sourcePriceUsd,
      sourceOldPriceUsd: state.sourceOldPriceUsd,
      unit: state.unit,
      stockQuantity: state.stockQuantity,
      minOrder: state.minOrder,
      primaryImage: state.primaryImage,
      isPublished: state.isPublished,
      attributes: cleanAttributes(characteristics),
      variants,
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
              Заполните только нужные характеристики — пустые поля на сайте не появятся.
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
              <span>Расчётная цена</span>
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
                  <p>Название, каталог, адрес и складские данные.</p>
                </div>
              </header>

              <div className="admin-product-fields">
                <label>
                  <span>Каталог</span>
                  <select
                    value={state.categoryId}
                    onChange={event => setState({
                      ...state,
                      categoryId: event.target.value,
                    })}
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
                </label>

                <label>
                  <span>Адрес</span>
                  <input
                    value={state.slug}
                    onChange={event => setState({ ...state, slug: event.target.value })}
                    placeholder="napato-black"
                  />
                </label>

                <label>
                  <span>Артикул</span>
                  <input
                    value={state.sku ?? ''}
                    onChange={event => setState({ ...state, sku: event.target.value })}
                  />
                </label>

                <label>
                  <span>Единица</span>
                  <input
                    value={state.unit ?? ''}
                    onChange={event => setState({ ...state, unit: event.target.value })}
                    placeholder="фут², дм², шт."
                  />
                </label>

                <label>
                  <span>Остаток</span>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={state.stockQuantity}
                    onChange={event => setState({
                      ...state,
                      stockQuantity: event.target.value,
                    })}
                  />
                </label>

                <label>
                  <span>Минимальный заказ</span>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={state.minOrder}
                    onChange={event => setState({
                      ...state,
                      minOrder: event.target.value,
                    })}
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
                  <p>Исходная цена хранится в долларах, рубли рассчитываются автоматически.</p>
                </div>
              </header>

              <div className="admin-product-fields is-pricing">
                <label>
                  <span>Базовая цена, $</span>
                  <input
                    inputMode="decimal"
                    value={state.sourcePriceUsd}
                    onChange={event => setState({
                      ...state,
                      sourcePriceUsd: event.target.value,
                    })}
                  />
                  <small>На сайте: {preview(state.sourcePriceUsd)}</small>
                </label>

                <label>
                  <span>Старая цена, $</span>
                  <input
                    inputMode="decimal"
                    value={state.sourceOldPriceUsd}
                    onChange={event => setState({
                      ...state,
                      sourceOldPriceUsd: event.target.value,
                    })}
                  />
                  <small>На сайте: {preview(state.sourceOldPriceUsd)}</small>
                </label>
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

            <section className="admin-product-section">
              <header className="admin-product-section-head-actions">
                <span><ListChecks size={19} /></span>
                <div>
                  <h3>Варианты товара</h3>
                  <p>Цвета, единицы и отдельные цены вариантов.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setVariants(current => [...current, emptyVariant()])}
                >
                  <Plus size={15} /> Вариант
                </button>
              </header>

              <div className="admin-product-variants">
                {variants.map((variant, index) => (
                  <article key={variant.id ?? index}>
                    <div className="admin-product-variant-number">
                      {String(index + 1).padStart(2, '0')}
                    </div>

                    <label className="is-name">
                      <span>Название</span>
                      <input
                        value={variant.name}
                        onChange={event => patchVariant(index, {
                          name: event.target.value,
                        })}
                      />
                    </label>

                    <label>
                      <span>Цена, $</span>
                      <input
                        inputMode="decimal"
                        value={variant.sourcePriceUsd ?? ''}
                        onChange={event => patchVariant(index, {
                          sourcePriceUsd: event.target.value,
                        })}
                      />
                      <small>{preview(variant.sourcePriceUsd)}</small>
                    </label>

                    <label>
                      <span>Старая, $</span>
                      <input
                        inputMode="decimal"
                        value={variant.sourceOldPriceUsd ?? ''}
                        onChange={event => patchVariant(index, {
                          sourceOldPriceUsd: event.target.value,
                        })}
                      />
                    </label>

                    <label>
                      <span>Единица</span>
                      <input
                        value={variant.unit ?? ''}
                        onChange={event => patchVariant(index, {
                          unit: event.target.value,
                        })}
                      />
                    </label>

                    <button
                      type="button"
                      aria-label="Удалить вариант"
                      onClick={() => setVariants(current =>
                        current.filter((_, currentIndex) => currentIndex !== index),
                      )}
                    >
                      <Trash2 size={17} />
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </main>
        </div>

        {error && <div className="admin-product-editor-error">{error}</div>}

        <footer className="admin-product-editor-footer">
          <span>
            Пустые характеристики будут скрыты на основном сайте.
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