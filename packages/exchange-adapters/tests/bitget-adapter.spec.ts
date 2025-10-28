import { describe, it, expect } from 'vitest'
import { BitgetAdapter, BitgetConfigSchema } from '../src/index'

describe('BitgetAdapter config', () => {
  it('validates config with zod', () => {
    const parsed = BitgetConfigSchema.safeParse({
      key: 'k'.repeat(16),
      secret: 's'.repeat(32),
      passphrase: 'p',
      env: 'paper',
    })
    expect(parsed.success).toBe(true)
  })
})

describe('BitgetAdapter balances (stubbed)', () => {
  it('returns empty list on placeholder endpoint failure', async () => {
    const adapter = new BitgetAdapter({
      key: 'k'.repeat(16),
      secret: 's'.repeat(32),
      passphrase: 'p',
      env: 'paper',
      baseUrl: 'https://example.invalid',
      backoffAttempts: 1,
      backoffBaseMs: 1,
    })
    const spot = await adapter.getBalances('spot')
    expect(Array.isArray(spot)).toBe(true)
  })
})
