import { describe, it, expect } from 'vitest'
import { computeSpotTrades } from '../aiTrades'

describe('computeSpotTrades', () => {
  it('builds BUY/SELL trades from recommended allocations', () => {
    const portfolio = [
      { asset: 'BTC', valueUSD: 5000 },
      { asset: 'ETH', valueUSD: 3000 },
      { asset: 'USDT', valueUSD: 2000 },
    ]
    const total = 10000
    const rec = { BTC: 40, ETH: 40, USDT: 20 }
    const trades = computeSpotTrades(portfolio, rec, total, 1)
    const byAsset: Record<string, number> = Object.fromEntries(
      trades.map((t) => [t.asset, t.deltaUSD]),
    )
    expect(byAsset.BTC).toBeCloseTo(-1000) // from 50% to 40%
    expect(byAsset.ETH).toBeCloseTo(1000) // from 30% to 40%
    expect((byAsset.USDT ?? 0)).toBeCloseTo(0) // already 20%
  })

  it('sells assets not in recommendations', () => {
    const portfolio = [
      { asset: 'ADA', valueUSD: 500 },
    ]
    const trades = computeSpotTrades(portfolio, { }, 500, 1)
    expect(trades[0].asset).toBe('ADA')
    expect(trades[0].action).toBe('SELL')
    expect(Math.sign(trades[0].deltaUSD)).toBe(-1)
  })
})


