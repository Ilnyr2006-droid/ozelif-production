import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import {
  fileURLToPath,
} from 'node:url'

import {
  readPublicToken,
} from './live-chat-auth.mjs'

const __dirname =
  path.dirname(
    fileURLToPath(import.meta.url),
  )

const clientPath =
  path.resolve(
    __dirname,
    '../../src/api/liveChat.ts',
  )

test(
  'public token cannot be read from body or query string',
  () => {
    assert.equal(
      readPublicToken({
        get: () => null,
        body: {
          token:
            'secret-body-token',
        },
        query: {
          token:
            'secret-query-token',
        },
      }),
      null,
    )
  },
)

test(
  'web live-chat client never puts its secret token in URL or session body',
  async () => {
    const source =
      await fs.readFile(
        clientPath,
        'utf8',
      )

    assert.match(
      source,
      /X-Ozelif-Live-Chat-Token/u,
    )

    assert.doesNotMatch(
      source,
      /\?token=/u,
    )

    assert.doesNotMatch(
      source,
      /token:\s*localStorage\.getItem\(TOKEN_KEY\)/u,
    )

    assert.doesNotMatch(
      source,
      /JSON\.stringify\(\{[^}]*\btoken\s*:/su,
    )
  },
)
