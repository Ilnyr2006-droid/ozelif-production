// Public catalog pages need the existing Metrika counter. API/admin keep Helmet defaults.
export function publicPageHeaders(_request, response, next) {
  response.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' https://mc.yandex.ru https://mc.yandex.com; script-src-attr 'none'; connect-src 'self' https://mc.yandex.ru https://mc.yandex.com; img-src 'self' data: https:; font-src 'self' data: https:; style-src 'self' https: 'unsafe-inline'; upgrade-insecure-requests")
  next()
}
