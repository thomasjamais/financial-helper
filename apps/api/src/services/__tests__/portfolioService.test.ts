import { describe, it, expect } from 'vitest'
import type { PriceData, PriceService } from '@pkg/shared-kernel'
import type { Balance } from '@pkg/exchange-adapters'
import { buildPortfolio } from '../portfolioService'

class FakePriceService implements PriceService {
  async getPrices(assets: string[]): Promise<Map<string, PriceData>> {
    const map = new Map<string, PriceData>()
    for (const asset of assets) {
      // Simple deterministic pricing for test
      const usd = asset === 'USDT' ? 1 : asset === 'BTC' ? 50000 : 100
      const eur = usd * 0.9
      map.set(asset, {
        asset,
        priceUSD: usd,
        priceEUR: eur,
        timestamp: Date.now(),
      })
    }
    return map
  }
}

describe('buildPortfolio', () => {
  it('should compute per-asset values and totals with locked amounts', async () => {
    const balances: Balance[] = [
      { asset: 'USDT', free: 1000 },
      { asset: 'BTC', free: 0.1, locked: 0.05 },
      { asset: 'ADA', free: 200 },
    ]

    const portfolio = await buildPortfolio(balances, new FakePriceService())

    // Assets preserved and sorted by USD value desc
    expect(portfolio.assets.map((a) => a.asset)).toEqual(['BTC', 'USDT', 'ADA'])

    const btc = portfolio.assets.find((a) => a.asset === 'BTC')!
    expect(btc.amount).toBeCloseTo(0.1)
    expect(btc.amountLocked).toBeCloseTo(0.05)
    expect(btc.priceUSD).toBe(50000)
    expect(btc.valueUSD).toBeCloseTo((0.1 + 0.05) * 50000)

    const usdt = portfolio.assets.find((a) => a.asset === 'USDT')!
    expect(usdt.priceUSD).toBe(1)
    expect(usdt.valueUSD).toBeCloseTo(1000)

    const ada = portfolio.assets.find((a) => a.asset === 'ADA')!
    expect(ada.priceUSD).toBe(100)
    expect(ada.valueUSD).toBeCloseTo(200 * 100)

    const expectedTotalUSD = 0.15 * 50000 + 1000 + 200 * 100
    const expectedTotalEUR = expectedTotalUSD * 0.9

    expect(portfolio.totalValueUSD).toBeCloseTo(expectedTotalUSD)
    expect(portfolio.totalValueEUR).toBeCloseTo(expectedTotalEUR)
  })
})
