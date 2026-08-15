export function deprecatedApi({ successor }) {
  return (_request, response, next) => {
    response.setHeader('Deprecation', 'true')
    response.setHeader('Link', `<${successor}>; rel="successor-version"`)
    response.setHeader('Cache-Control', 'no-store')
    next()
  }
}
