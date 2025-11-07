import { describe, it, expect } from 'vitest'
import { runBacktest } from '../engine'
import type { Candle } from '../types'
import { SmaCrossStrategy } from '../strategies'

function genTrendCandles(n: number, start = 100, step = 1): Candle[] {
  const candles: Candle[] = []
  for (let i = 0; i < n; i++) {
    const price = start + i * step
    candles.push({ timestamp: i, open: price, high: price, low: price, close: price })
  }
  return candles
}

describe('engine', () => {
  it('returns initial equity when no candles', () => {
    const strat = new SmaCrossStrategy({ shortWindow: 2, longWindow: 3 })
    const result = runBacktest([], strat, 1000)
    expect(result.finalEquity).toBe(1000)
    expect(result.trades.length).toBe(0)
  })

  it('produces equity snapshots and trades', () => {
    // Construct a series with clear SMA crossovers
    const prices = [1,1,1,1,1, 10,10,10, 1,1,1,1,1, 10,10,10]
    const candles: Candle[] = prices.map((p, i) => ({ timestamp: i, open: p, high: p, low: p, close: p }))
    const strat = new SmaCrossStrategy({ shortWindow: 3, longWindow: 5 })
    const { trades, snapshots, finalEquity } = runBacktest(candles, strat, 1000)
    expect(snapshots.length).toBe(candles.length)
    expect(trades.length).toBeGreaterThan(0)
    expect(finalEquity).toBeGreaterThan(0)
  })
})


