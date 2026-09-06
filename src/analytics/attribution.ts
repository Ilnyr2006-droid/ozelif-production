import { METRIKA_ID } from './metrika'
const key = 'ozelif-ad-attribution-v1'
const fields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'yclid']
export function captureAttribution() {
  try {
    const params = new URLSearchParams(location.search)
    const value: Record<string, string> = {}
    for (const name of fields) { const v = params.get(name); if (v && /^[a-zA-Z0-9_|.-]{1,160}$/.test(v)) value[name] = v }
    if (Object.keys(value).length) localStorage.setItem(key, JSON.stringify({ value, expires: Date.now() + 30 * 86400000 }))
  } catch { /* optional storage */ }
}
export async function getAttribution(): Promise<Record<string, string>> {
  captureAttribution()
  let value: Record<string, string> = {}
  try { const saved = JSON.parse(localStorage.getItem(key) ?? '{}'); if (saved.expires > Date.now()) value = saved.value ?? {} } catch { /* optional */ }
  const clientId = await new Promise<string>(resolve => {
    const timer = setTimeout(() => resolve(''), 300)
    const ym = (window as Window & { ym?: (...args: unknown[]) => void }).ym
    if (!ym) { clearTimeout(timer); resolve(''); return }
    ym(METRIKA_ID, 'getClientID', (id: string) => { clearTimeout(timer); resolve(/^\d{1,40}$/.test(String(id)) ? String(id) : '') })
  })
  return { ...value, ...(clientId ? { clientId } : {}) }
}
