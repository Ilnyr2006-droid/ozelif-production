import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRequestId } from './requestId'

afterEach(() => vi.unstubAllGlobals())

describe('createRequestId', () => {
  it('uses crypto.randomUUID when it is available', () => {
    const randomUUID = vi.fn(() => '11111111-2222-4333-8444-555555555555')
    vi.stubGlobal('crypto', { randomUUID })
    expect(createRequestId()).toBe('11111111-2222-4333-8444-555555555555')
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it('creates a RFC 4122 v4 id with getRandomValues when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0)
        return bytes
      },
    })
    expect(createRequestId()).toBe('00000000-0000-4000-8000-000000000000')
  })
})
