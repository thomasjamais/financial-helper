import { SMA } from 'technicalindicators'
import type { Candle } from '../types.js'

/**
 * Calculates Average True Range (ATR) for volatility-based TP/SL
 */
export function calculateATR(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) return 0

  const trueRanges: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high
    const low = candles[i].low
    const prevClose = candles[i - 1].close
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose),
    )
    trueRanges.push(tr)
  }

  const atrValues = SMA.calculate({
    period,
    values: trueRanges,
  })

  return atrValues[atrValues.length - 1] || 0
}

