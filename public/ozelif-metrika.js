/* OZELIF: one counter, explicit page URLs and goals; no form values or link URLs. */
;(function () {
  if (/^\/admin(?:\/|$)/.test(location.pathname)) return
  var id = 112275551
  window.dataLayer = window.dataLayer || []
  window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments) }
  window.ym.l = Date.now()
  var script = document.createElement('script')
  script.async = true
  script.src = 'https://mc.yandex.ru/metrika/tag.js?id=' + id
  document.head.appendChild(script)
  function cleanUrl(value) {
    try {
      var url = new URL(value, location.origin)
      var result = new URL(url.origin + url.pathname)
      // Only the documented ad template is accepted. Search, form values, fragments,
      // messenger text and arbitrary query parameters never reach Metrika.
      ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'yclid'].forEach(function (key) {
        var v = url.searchParams.get(key)
        if (v && /^[a-zA-Z0-9_|.-]{1,160}$/.test(v)) result.searchParams.set(key, v)
      })
      return result.href
    } catch (_) { return '' }
  }
  var safeUrl = cleanUrl(location.href)
  window.ym(id, 'init', { defer: true, webvisor: false, clickmap: false, trackLinks: false, accurateTrackBounce: true, ecommerce: 'dataLayer', url: safeUrl, referrer: document.referrer ? new URL(document.referrer).origin : '' })
  var previous = ''
  function hit() {
    if (/^\/admin(?:\/|$)/.test(location.pathname)) return
    var current = cleanUrl(location.href)
    if (current === previous) return
    window.ym(id, 'hit', current, { referer: previous || (document.referrer ? new URL(document.referrer).origin : ''), title: document.title })
    previous = current
  }
  ;['pushState', 'replaceState'].forEach(function (method) {
    var original = history[method]
    history[method] = function () { var result = original.apply(this, arguments); queueMicrotask(hit); return result }
  })
  window.addEventListener('popstate', hit)
  hit()
})()
