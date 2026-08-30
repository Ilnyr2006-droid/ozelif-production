import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isAnalyticsBotUserAgent,
} from './analytics-bot-filter.mjs'

const bots = [
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0)',
  'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
  'AhrefsBot/7.0',
  'SemrushBot/7~bl',
  'GPTBot/1.0',
  'OAI-SearchBot/1.0',
  'ChatGPT-User/1.0',
  'ClaudeBot/1.0',
  'PerplexityBot/1.0',
  'Mozilla/5.0 HeadlessChrome/140.0.0.0',
  'Mozilla/5.0 Chrome-Lighthouse',
  'Playwright/1.50',
  'Puppeteer',
  'curl/8.5.0',
  'python-requests/2.32',
  'UptimeRobot/2.0',
]

const humans = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36',
]

test(
  'recognizes common crawlers and automation as analytics bots',
  () => {
    for (const userAgent of bots) {
      assert.equal(
        isAnalyticsBotUserAgent(userAgent),
        true,
        userAgent,
      )
    }
  },
)

test(
  'keeps normal mobile and desktop browsers as human analytics',
  () => {
    for (const userAgent of humans) {
      assert.equal(
        isAnalyticsBotUserAgent(userAgent),
        false,
        userAgent,
      )
    }
  },
)

test(
  'does not classify an unknown empty user-agent as a bot',
  () => {
    assert.equal(
      isAnalyticsBotUserAgent(''),
      false,
    )
    assert.equal(
      isAnalyticsBotUserAgent(null),
      false,
    )
  },
)
