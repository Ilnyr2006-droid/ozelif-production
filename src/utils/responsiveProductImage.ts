type ProductImageSize = 'card' | 'detail'

const localCatalogImage = /^\/images\/catalog\/([^/]+)\/([^/]+)\/w\d+(-v2)?\.webp$/

/**
 * The catalog API deliberately exposes the canonical image URL.  For local
 * clothing assets we can safely select one of the already generated variants
 * without changing that contract or falling back to a CDN.
 */
export function responsiveProductImage(url: string, size: ProductImageSize) {
  const match = url.match(localCatalogImage)
  if (!match) return { src: url, srcSet: undefined, sizes: undefined }

  const directory = `/images/catalog/${match[1]}/${match[2]}`
  const suffix = match[3] ?? ''
  const widths = suffix ? [480, 720, 960, 1280, 1440, 1680] : [480, 720, 1280]
  const srcSet = widths
    .map(width => `${directory}/w${width}${suffix}.webp ${width}w`)
    .join(', ')

  return {
    src: `${directory}/w${size === 'card' ? 480 : suffix ? 960 : 1280}${suffix}.webp`,
    srcSet,
    sizes: size === 'card'
      ? '(min-width: 900px) 25vw, (min-width: 640px) 33vw, 50vw'
      : '(min-width: 900px) 50vw, 100vw',
  }
}
