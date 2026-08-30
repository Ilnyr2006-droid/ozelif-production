/*
 * Analytics only. This is deliberately conservative: it rejects known
 * crawlers, preview agents, monitoring/SEO tools and browser automation.
 * Normal desktop/mobile browser user-agents remain human traffic.
 */
export const ANALYTICS_BOT_USER_AGENT_PATTERN = [
  'bot\\b',
  'crawler',
  'spider',
  'slurp',
  'bingpreview',
  'headlesschrome',
  'chrome-lighthouse',
  'lighthouse',
  'pagespeed',
  'google-inspectiontool',
  'facebookexternalhit',
  'telegrambot',
  'whatsapp',
  'baiduspider',
  'duckduckbot',
  'petalbot',
  'semrushbot',
  'ahrefsbot',
  'mj12bot',
  'dotbot',
  'bytespider',
  'applebot',
  'gptbot',
  'chatgpt-user',
  'oai-searchbot',
  'claudebot',
  'anthropic-ai',
  'perplexitybot',
  'ccbot',
  'dataforseo',
  'serpstatbot',
  'seznambot',
  'siteauditbot',
  'uptimerobot',
  'pingdom',
  'statuscake',
  'playwright',
  'puppeteer',
  '\\bcurl\\b',
  '\\bwget\\b',
  'python-requests',
  'python-urllib',
  'go-http-client',
  'libwww-perl',
].join('|')

const analyticsBotUserAgentRegex =
  new RegExp(
    ANALYTICS_BOT_USER_AGENT_PATTERN,
    'iu',
  )

export function isAnalyticsBotUserAgent(value) {
  const userAgent =
    String(value ?? '').trim()

  if (!userAgent) {
    return false
  }

  return analyticsBotUserAgentRegex.test(
    userAgent,
  )
}
