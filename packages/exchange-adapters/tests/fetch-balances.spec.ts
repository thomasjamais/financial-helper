import { describe, it, expect } from 'vitest'
import { BitgetAdapter } from '../src'

class MockHttp {
  constructor(private payloads: Record<string, any>) {}
  async call<T>(method: 'GET' | 'POST' | 'DELETE', path: string): Promise<T> {
    const p = this.payloads[path]
    if (p instanceof Error) throw p
    return p as T
  }
  // monitor stubs
  getCircuitState() {
    return 'CLOSED'
  }
  getFailureCount() {
    return 0
  }
  getRateLimitTokens() {
    return 0
  }
  resetCircuitBreaker() {}
}

describe('BitgetAdapter.getBalances', () => {
  it('normalizes spot balances', async () => {
    const mock = new MockHttp({
      '/api/spot/v1/account/assets': {
        data: [
          { asset: 'USDT', free: '100.5' },
          { asset: 'BTC', free: '0.01' },
        ],
      },
    }) as any

    const adapter = new BitgetAdapter(
      {
        key: 'k'.repeat(16),
        secret: 's'.repeat(32),
        passphrase: 'p',
        env: 'paper',
        baseUrl: 'http://localhost',
      },
      mock,
    )

    const balances = await adapter.getBalances('spot')
    expect(balances).toEqual([
      { asset: 'USDT', free: 100.5 },
      { asset: 'BTC', free: 0.01 },
    ])
  })

  it('normalizes futures balances', async () => {
    const mock = new MockHttp({
      '/api/mix/v1/account/accounts': {
        data: [
          { symbol: 'USDT', available: '250' },
          { symbol: 'ETH', available: '5' },
        ],
      },
    }) as any

    const adapter = new BitgetAdapter(
      {
        key: 'k'.repeat(16),
        secret: 's'.repeat(32),
        passphrase: 'p',
        env: 'paper',
        baseUrl: 'http://localhost',
      },
      mock,
    )

    const balances = await adapter.getBalances('futures')
    expect(balances).toEqual([
      { asset: 'USDT', free: 250 },
      { asset: 'ETH', free: 5 },
    ])
  })
})
