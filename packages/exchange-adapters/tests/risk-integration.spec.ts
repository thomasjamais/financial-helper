import { describe, it, expect } from 'vitest'
import { BitgetAdapter } from '../src'
import { calculateFuturesPositionSize, parseRiskConfigFromEnv } from '../src/utils/riskEngine'

class MockHttp {
  async call() { return { data: [] } }
  getCircuitState() { return 'CLOSED' }
  getFailureCount() { return 0 }
  getRateLimitTokens() { return 0 }
  resetCircuitBreaker() {}
}

describe('Risk Engine Integration', () => {
  const base = {
    key: 'k'.repeat(16), 
    secret: 's'.repeat(32), 
    passphrase: 'p', 
    env: 'paper' as const, 
    baseUrl: 'http://localhost'
  }

  it('should apply risk sizing to futures orders', async () => {
    process.env.MAX_LEVERAGE = '5'
    process.env.MAX_RISK_PER_TRADE = '0.02'
    process.env.MAX_POSITION_SIZE = '0.1'
    
    const adapter = new BitgetAdapter(base, new MockHttp() as any)
    
    // Mock balance response
    const originalGetBalances = adapter.getBalances.bind(adapter)
    adapter.getBalances = async () => [{ asset: 'USDT', free: 1000 }]
    
    const order = await adapter.placeOrder({
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'MARKET',
      qty: 100, // Very large quantity that should be reduced
      price: 50000, // High price to make notional large
      clientOid: 'test'
    })
    
    // Quantity should be reduced by risk engine (with 1000 USDT balance and 10% max position)
    expect(order.qty).toBeLessThan(100)
    expect(order.qty).toBeGreaterThan(0)
    
    // Restore original method
    adapter.getBalances = originalGetBalances
  })

  it('should respect leverage limits', async () => {
    process.env.MAX_LEVERAGE = '3'
    
    const adapter = new BitgetAdapter(base, new MockHttp() as any)
    
    // Mock balance response
    const originalGetBalances = adapter.getBalances.bind(adapter)
    adapter.getBalances = async () => [{ asset: 'USDT', free: 1000 }]
    
    const order = await adapter.placeOrder({
      symbol: 'ETHUSDT',
      side: 'BUY',
      type: 'LIMIT',
      qty: 1,
      price: 2000,
      clientOid: 'test'
    })
    
    // Should not throw error due to leverage validation (uses min of 5 and max leverage)
    expect(order.status).toBe('NEW')
    
    // Restore original method
    adapter.getBalances = originalGetBalances
  })
})
