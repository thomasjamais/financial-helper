import { describe, it, expect } from 'vitest'
import type { Balance } from '@pkg/exchange-adapters'
import { buildPortfolio } from '../../services/portfolioService'
import type { PriceService, PriceData } from '@pkg/shared-kernel'

class FakePriceService implements PriceService {
  async getPrices(assets: string[]): Promise<Map<string, PriceData>> {
    const map = new Map<string, PriceData>()
    for (const a of assets) {
      const usd = a === 'USDT' ? 1 : a === 'BTC' ? 50000 : 10
      map.set(a, { asset: a, priceUSD: usd, priceEUR: usd * 0.9, timestamp: Date.now() })
    }
    return map
  }
}

describe('Spot/Earn portfolio enrichment', () => {
  it('builds spot-only portfolio with prices and values', async () => {
    const spot: Balance[] = [
      { asset: 'USDT', free: 100 },
      { asset: 'BTC', free: 0.02 },
    ]
    const p = await buildPortfolio(spot, new FakePriceService())
    const usdt = p.assets.find((a) => a.asset === 'USDT')!
    const btc = p.assets.find((a) => a.asset === 'BTC')!
    expect(usdt.priceUSD).toBe(1)
    expect(usdt.valueUSD).toBeCloseTo(100)
    expect(btc.priceUSD).toBe(50000)
    expect(btc.valueUSD).toBeCloseTo(0.02 * 50000)
  })

  it('builds earn-only portfolio with prices and values', async () => {
    const earn: Balance[] = [
      { asset: 'USDT', free: 50 },
      { asset: 'ADA', free: 200 },
    ]
    const p = await buildPortfolio(earn, new FakePriceService())
    const usdt = p.assets.find((a) => a.asset === 'USDT')!
    const ada = p.assets.find((a) => a.asset === 'ADA')!
    expect(usdt.valueUSD).toBeCloseTo(50)
    expect(ada.priceUSD).toBe(10)
    expect(ada.valueUSD).toBeCloseTo(200 * 10)
  })
})


