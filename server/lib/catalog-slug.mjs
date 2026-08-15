const transliteration = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e',
  ю: 'yu', я: 'ya',
}

// Public category URLs are intentionally limited to URL-safe Latin slugs. A
// transliteration here keeps the admin form and the public catalog API in sync.
export function normalizeCatalogSlug(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'e')
    .replace(/[а-я]/g, character => transliteration[character] ?? character)
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

export function isPublicCatalogSlug(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value ?? ''))
}
