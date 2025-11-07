import { z } from 'zod'
import type { Candle, Strategy, StrategySignal } from '../types'

export const SmaCrossParamsSchema = z.object({
  shortWindow: z.number().int().min(1),
  longWindow: z.number().int().min(2)
}).refine(v => v.shortWindow < v.longWindow, {
  message: 'shortWindow must be < longWindow'
})

export type SmaCrossParams = z.infer<typeof SmaCrossParamsSchema>

export class SmaCrossStrategy implements Strategy {
  public readonly name = 'smaCross'
  private readonly shortWindow: number
  private readonly longWindow: number
  private closes: number[] = []
  private lastCross: 'above' | 'below' | null = null

  constructor(params: SmaCrossParams) {
    const parsed = SmaCrossParamsSchema.parse(params)
    this.shortWindow = parsed.shortWindow
    this.longWindow = parsed.longWindow
  }

  initialize(candles: Candle[]): void {
    this.closes = candles.map(c => c.close)
    // Seed lastCross to avoid immediate false signal
    const { shortSma, longSma } = this.computeSmas(this.longWindow - 1)
    if (shortSma !== null && longSma !== null) {
      this.lastCross = shortSma > longSma ? 'above' : 'below'
    }
  }

  onCandle(_candle: Candle, index: number, _candles: Candle[]): StrategySignal {
    const { shortSma, longSma } = this.computeSmas(index)
    if (shortSma === null || longSma === null) return 'hold'

    const currentlyAbove = shortSma > longSma
    const prev = this.lastCross
    this.lastCross = currentlyAbove ? 'above' : 'below'

    if (prev === null) return 'hold'
    if (!currentlyAbove && prev === 'above') return 'sell'
    if (currentlyAbove && prev === 'below') return 'buy'
    return 'hold'
  }

  private computeSmas(index: number): { shortSma: number | null; longSma: number | null } {
    const sStart = index - this.shortWindow + 1
    const lStart = index - this.longWindow + 1
    if (sStart < 0 || lStart < 0) return { shortSma: null, longSma: null }
    const shortSlice = this.closes.slice(sStart, index + 1)
    const longSlice = this.closes.slice(lStart, index + 1)
    const shortSma = shortSlice.reduce((a, b) => a + b, 0) / shortSlice.length
    const longSma = longSlice.reduce((a, b) => a + b, 0) / longSlice.length
    return { shortSma, longSma }
  }
}


