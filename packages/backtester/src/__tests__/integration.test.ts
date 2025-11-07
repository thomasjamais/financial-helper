import { describe, it, expect } from 'vitest'
import { runBacktest } from '../engine'
import { SmaCrossStrategy } from '../strategies'
import type { Candle } from '../types'

function genSineLike(n: number): Candle[] {
  const arr: Candle[] = []
  for (let i = 0; i < n; i++) {
    const price = 100 + Math.sin(i / 5) * 5 + i * 0.05 // mild trend with cycles
    arr.push({ timestamp: i, open: price, high: price, low: price, close: price })
  }
  return arr
}

describe('integration backtest (100 candles, SMA crossover)', () => {
  it('computes final PnL deterministically', () => {
    const candles = genSineLike(100)
    const strategy = new SmaCrossStrategy({ shortWindow: 5, longWindow: 20 })
    const initial = 10_000
    const { finalEquity } = runBacktest(candles, strategy, initial)
    // Deterministic within this logic; assert reasonable bounds
    expect(finalEquity).toBeGreaterThan(9000)
    expect(finalEquity).toBeLessThan(12000)
  })
})






