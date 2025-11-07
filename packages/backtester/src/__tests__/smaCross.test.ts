import { describe, it, expect } from 'vitest'
import { SmaCrossParamsSchema, SmaCrossStrategy } from '../strategies'
import type { Candle } from '../types'

function mkC(price: number, i: number): Candle {
  return { timestamp: i, open: price, high: price, low: price, close: price }
}

describe('SmaCrossStrategy', () => {
  it('validates params with zod', () => {
    expect(() => new SmaCrossStrategy({ shortWindow: 5, longWindow: 10 })).not.toThrow()
    expect(() => new SmaCrossStrategy({ shortWindow: 10, longWindow: 5 } as any)).toThrow()
    expect(SmaCrossParamsSchema.safeParse({ shortWindow: 5, longWindow: 5 }).success).toBe(false)
  })

  it('emits buy on golden cross and sell on death cross', () => {
    const prices = [
      // long average starts low
      1, 1, 1, 1, 1,
      // sharp rise pushes short above long -> buy
      10, 10, 10,
      // drop pushes short back below long -> sell
      1, 1, 1, 1, 1
    ]
    const candles: Candle[] = prices.map((p, i) => mkC(p, i))
    const s = new SmaCrossStrategy({ shortWindow: 3, longWindow: 5 })
    s.initialize(candles)
    let buy = 0, sell = 0
    candles.forEach((c, i) => {
      const sig = s.onCandle(c, i, candles)
      if (sig === 'buy') buy++
      if (sig === 'sell') sell++
    })
    expect(buy).toBeGreaterThan(0)
    expect(sell).toBeGreaterThan(0)
  })
})


