import { describe, it, expect } from 'vitest'
import { BitgetAdapter } from '../src'

class MockHttp {
  async call() { return { data: [] } }
  getCircuitState() { return 'CLOSED' }
  getFailureCount() { return 0 }
  getRateLimitTokens() { return 0 }
  resetCircuitBreaker() {}
}

describe('Caps guard', () => {
  const base = {
    key: 'k'.repeat(16), secret: 's'.repeat(32), passphrase: 'p', env: 'paper' as const, baseUrl: 'http://localhost'
  }

  it('allows whitelisted symbol and under max order', async () => {
    process.env.SYMBOL_WHITELIST = 'BTCUSDT,ETHUSDT,BNBUSDT'
    process.env.MAX_ORDER_USDT = '1000'
    const adapter = new BitgetAdapter(base, new MockHttp() as any)
    const order = await adapter.placeOrder({ symbol: 'BTCUSDT', side: 'BUY', type: 'MARKET', qty: 0.001, clientOid: 'x' })
    expect(order.status).toBe('NEW')
  })

  it('rejects non-whitelisted symbol', async () => {
    process.env.SYMBOL_WHITELIST = 'ETHUSDT,BNBUSDT'
    process.env.MAX_ORDER_USDT = '0'
    const adapter = new BitgetAdapter(base, new MockHttp() as any)
    await expect(adapter.placeOrder({ symbol: 'BTCUSDT', side: 'BUY', type: 'MARKET', qty: 1, clientOid: 'x' })).rejects.toThrow(/not whitelisted/)
  })

  it('rejects order exceeding max notional', async () => {
    process.env.SYMBOL_WHITELIST = 'BTCUSDT,ETHUSDT,BNBUSDT'
    process.env.MAX_ORDER_USDT = '10'
    const adapter = new BitgetAdapter(base, new MockHttp() as any)
    await expect(adapter.placeOrder({ symbol: 'ETHUSDT', side: 'BUY', type: 'LIMIT', qty: 1, price: 20, clientOid: 'x' })).rejects.toThrow(/exceeds max/)
  })
})


