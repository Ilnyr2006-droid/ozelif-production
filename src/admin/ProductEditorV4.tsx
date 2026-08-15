
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

type CharacteristicRow = { id: string; label: string; value: string }

const labelMap: Record<string, string> = {
  purpose: 'Назначение кожи', appointment: 'Назначение кожи',
  material: 'Материал', rawMaterial: 'Тип сырья', raw_material: 'Тип сырья',
  coating: 'Вид покрытия', finish: 'Вид покрытия', thickness: 'Толщина (мм)',
  features: 'Особенности', grade: 'Сорт', origin: 'Происхождение сырья',
  country: 'Страна производства', color: 'Цвет', hideSize: 'Размер шкур',
  hide_size: 'Размер шкур', subtype: 'Тип', type: 'Тип', brand: 'Бренд',
  zipperType: 'Тип молнии', connectionType: 'Вид соединения',
  tapeColor: 'Цвет тесьмы', metalColor: 'Цвет металла', length: 'Длина',
  diameter: 'Диаметр',
}

const leatherPreset = [
  'Назначение кожи', 'Тип сырья', 'Материал', 'Вид покрытия', 'Толщина (мм)',
  'Особенности', 'Сорт', 'Происхождение сырья', 'Цвет', 'Размер шкур',
]

const hardwarePreset = [
  'Тип', 'Бренд', 'Страна производства', 'Тип молнии', 'Вид соединения',
  'Цвет тесьмы', 'Цвет металла', 'Длина', 'Диаметр',
]

function textValue(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean).join(' · ')
  if (value === null || value === undefined || typeof value === 'object') return ''
  return String(value).trim()
}

function initialCharacteristics(
  attributes: Record<string, unknown> | null | undefined,
  categorySlug: string,
) {
  const rows: CharacteristicRow[] = Object.entries(attributes ?? {})
    .filter(([label]) => !label.startsWith('__'))
    .map(([label, value], index) => ({
      id: `stored-${index}-${label}`,
      label: labelMap[label] ?? label,
      value: textValue(value),
    }))

  const preset = categorySlug === 'furnitura' ? hardwarePreset : leatherPreset
  const labels = new Set(rows.map(row => row.label.toLocaleLowerCase('ru')))

  for (const label of preset) {
    if (!labels.has(label.toLocaleLowerCase('ru'))) {
      rows.push({ id: `preset-${label}`, label, value: '' })
    }
  }

  return rows
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

function preferredVariant(product: Partial<Product>): Variant | null {
  const active = (product.variants ?? []).filter(variant => variant.isActive !== false)
  return active.find(variant => normalizeUnit(variant.unit) === 'фут²')
    ?? active.find(variant => normalizeUnit(variant.unit) === 'дм²')
    ?? active[0]
    ?? null
}

export function ProductEditorV4({
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
  const catalog = catalogs.find(item => item.id === product.category_id) ?? catalogs[0]
  const variant = preferredVariant(product)
  const initialUnit = catalog?.slug === 'furnitura'
    ? ''
    : normalizeUnit(variant?.unit ?? product.unit)

  const [state, setState] = useState({
    categoryId: product.category_id ?? catalog?.id ?? '',
    name: product.name ?? '',
    description: product.description ?? '',
    sku: product.sku ?? '',
    sourcePriceUsd: String(variant?.sourcePriceUsd ?? product.source_price_usd ?? ''),
    sourceOldPriceUsd: String(variant?.sourceOldPriceUsd ?? product.source_old_price_usd ?? ''),
    unit: initialUnit,
    stockQuantity: String(variant?.stockQuantity ?? product.stock_quantity ?? ''),
    primaryImage: product.primary_image ?? '',
    isPublished: product.is_published ?? true,
  })

  const [characteristics, setCharacteristics] = useState<CharacteristicRow[]>(
    initialCharacteristics(product.attributes, catalog?.slug ?? ''),
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const rate = Number(pricing?.usd_rate ?? 0)
  const markup = Number(pricing?.markup_percent ?? 0)

  const calculated = useMemo(() => {
    const usd = Number(state.sourcePriceUsd.replace(',', '.'))
    if (!Number.isFinite(usd) || usd <= 0 || !rate) return null
    return usd * rate * (1 + markup / 100)
  }, [markup, rate, state.sourcePriceUsd])

  const preview = (value: string) => {
    const usd = Number(value.replace(',', '.'))
    if (!Number.isFinite(usd) || usd <= 0 || !rate) return '—'
    return `${(usd * rate * (1 + markup / 100)).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`
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

  function addPresetFields() {
    const selected = catalogs.find(item => item.id === state.categoryId)
    const preset = selected?.slug === 'furnitura' ? hardwarePreset : leatherPreset
    const labels = new Set(characteristics.map(item => item.label.toLocaleLowerCase('ru')))
    setCharacteristics(current => [
      ...current,
      ...preset.filter(label => !labels.has(label.toLocaleLowerCase('ru')))
        .map(label => ({ id: `preset-${Date.now()}-${label}`, label, value: '' })),
    ])
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')

    const selected = catalogs.find(item => item.id === state.categoryId)
    const payload = {
      categoryId: state.categoryId,
      name: state.name,
      description: state.description,
      sku: state.sku,
      sourcePriceUsd: state.sourcePriceUsd,
      sourceOldPriceUsd: state.sourceOldPriceUsd,
      unit: selected?.slug === 'furnitura' ? '' : state.unit,
      stockQuantity: state.stockQuantity,
      primaryImage: state.primaryImage,
      isPublished: state.isPublished,
      attributes: cleanAttributes(characteristics),
    }

    try {
      if (product.id) await adminApiV2.updateProduct(product.id, payload)
      else await adminApiV2.createProduct(payload)
      await onSaved()
      onClose()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось сохранить товар')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="admin-product-editor-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <form className="admin-product-editor" onSubmit={submit}>
        <header className="admin-product-editor-head">
          <div>
            <p className="admin-eyebrow">Карточка товара</p>
            <h2>{product.id ? 'Редактировать товар' : 'Создать товар'}</h2>
            <span>Адрес создаётся автоматически. Пустые характеристики на сайте не появляются.</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть"><X size={21} /></button>
        </header>

        <div className="admin-product-editor-layout">
          <aside className="admin-product-editor-preview">
            <div className="admin-product-image-card">
              {state.primaryImage ? <img src={state.primaryImage} alt="" /> : (
                <div><ImagePlus size={32} /><span>Фотография товара</span></div>
              )}
            </div>
            <label className="admin-product-upload">
              <Upload size={17} />
              <span>{state.primaryImage ? 'Заменить фотографию' : 'Загрузить фотографию'}</span>
              <input type="file" accept="image/*" onChange={event => void upload(event.target.files?.[0])} />
            </label>
            <div className="admin-product-price-preview">
              <span>Расчётная цена</span>
              <strong>{calculated ? `${calculated.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽` : '—'}</strong>
              <small>Курс {rate ? `${rate.toFixed(2)} ₽` : 'не загружен'} · наценка {markup}%</small>
            </div>
            <label className="admin-product-publish">
              <input type="checkbox" checked={state.isPublished} onChange={event => setState({ ...state, isPublished: event.target.checked })} />
              <span><b>Опубликован</b><small>Товар доступен покупателям</small></span>
            </label>
          </aside>

          <main className="admin-product-editor-content">
            <section className="admin-product-section">
              <header><span><ListChecks size={18} /></span><div><h3>Основная информация</h3><p>Название, каталог, артикул и складские данные.</p></div></header>
              <div className="admin-product-fields admin-product-fields--basic-v4">
                <label><span>Каталог</span><select value={state.categoryId} onChange={event => {
                  const next = catalogs.find(item => item.id === event.target.value)
                  setState({ ...state, categoryId: event.target.value, unit: next?.slug === 'furnitura' ? '' : state.unit })
                }} required>{catalogs.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
                <label><span>Название</span><input value={state.name} onChange={event => setState({ ...state, name: event.target.value })} required /><small>URL будет создан автоматически.</small></label>
                <label><span>Артикул</span><input value={state.sku ?? ''} onChange={event => setState({ ...state, sku: event.target.value })} /></label>
                <label><span>Остаток</span><input type="number" min="0" step="0.001" value={state.stockQuantity} onChange={event => setState({ ...state, stockQuantity: event.target.value })} /></label>
                <label className="is-wide"><span>Описание</span><textarea rows={4} value={state.description} onChange={event => setState({ ...state, description: event.target.value })} /></label>
              </div>
            </section>

            <section className="admin-product-section">
              <header><span><BadgeDollarSign size={19} /></span><div><h3>Цена</h3><p>Одна цена и единица. Для кожи фут² и дм² показываются автоматически.</p></div></header>
              <div className="admin-product-fields is-pricing admin-product-fields--pricing-v4">
                <label><span>Базовая цена, $</span><input inputMode="decimal" value={state.sourcePriceUsd} onChange={event => setState({ ...state, sourcePriceUsd: event.target.value })} /><small>На сайте: {preview(state.sourcePriceUsd)}</small></label>
                <label><span>Единица измерения</span><select value={state.unit} onChange={event => setState({ ...state, unit: event.target.value })}>
                  <option value="">Без единицы — цена за 1 шт.</option>
                  <option value="фут²">фут²</option>
                  <option value="дм²">дм²</option>
                  <option value="м²">м²</option>
                  <option value="шт.">шт.</option>
                </select><small>Для фурнитуры оставьте пустым.</small></label>
                <label><span>Старая цена, $</span><input inputMode="decimal" value={state.sourceOldPriceUsd} onChange={event => setState({ ...state, sourceOldPriceUsd: event.target.value })} /><small>На сайте: {preview(state.sourceOldPriceUsd)}</small></label>
              </div>
            </section>

            <section className="admin-product-section">
              <header className="admin-product-section-head-actions"><span><ListChecks size={19} /></span><div><h3>Характеристики</h3><p>Пустые значения не сохраняются и не показываются.</p></div><button type="button" onClick={addPresetFields}><Plus size={15} /> Рекомендуемые поля</button></header>
              <div className="admin-characteristics-list">
                {characteristics.map((row, index) => <div className="admin-characteristic-row" key={row.id}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <input value={row.label} onChange={event => setCharacteristics(current => current.map(item => item.id === row.id ? { ...item, label: event.target.value } : item))} placeholder="Название характеристики" />
                  <input value={row.value} onChange={event => setCharacteristics(current => current.map(item => item.id === row.id ? { ...item, value: event.target.value } : item))} placeholder="Значение" />
                  <button type="button" onClick={() => setCharacteristics(current => current.filter(item => item.id !== row.id))}><Trash2 size={16} /></button>
                </div>)}
                <button className="admin-characteristic-add" type="button" onClick={() => setCharacteristics(current => [...current, { id: `custom-${Date.now()}`, label: '', value: '' }])}><Plus size={16} /> Добавить характеристику</button>
              </div>
            </section>
          </main>
        </div>

        {error && <div className="admin-product-editor-error">{error}</div>}
        <footer className="admin-product-editor-footer">
          <span>Цена за дм² рассчитывается из цены за фут² автоматически.</span>
          <div><button type="button" onClick={onClose}>Отмена</button><button className="admin-primary-button" disabled={pending}><Save size={17} />{pending ? 'Сохраняем…' : 'Сохранить товар'}</button></div>
        </footer>
      </form>
    </div>
  )
}
