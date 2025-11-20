import { EMA } from 'technicalindicators'
import type { Candle, TrendAnalysis } from '../types.js'

/**
 * Analyzes trend using EMAs on a specific timeframe
 */
export function analyzeTrend(
  candles: Candle[],
  timeframe: string,
): TrendAnalysis | null {
  if (candles.length < 200) {
    return null
  }

  const closes = candles.map((c) => c.close)
  const currentPrice = closes[closes.length - 1]

  const ema50Values = EMA.calculate({ period: 50, values: closes })
  const ema100Values = EMA.calculate({ period: 100, values: closes })
  const ema200Values = EMA.calculate({ period: 200, values: closes })

  if (
    ema50Values.length === 0 ||
    ema100Values.length === 0 ||
    ema200Values.length === 0
  ) {
    return null
  }

  const ema50 = ema50Values[ema50Values.length - 1]
  const ema100 = ema100Values[ema100Values.length - 1]
  const ema200 = ema200Values[ema200Values.length - 1]

  if (!isFinite(ema50) || !isFinite(ema100) || !isFinite(ema200)) {
    return null
  }

  const priceVsEma50 = ((currentPrice - ema50) / ema50) * 100
  const priceVsEma100 = ((currentPrice - ema100) / ema100) * 100
  const priceVsEma200 = ((currentPrice - ema200) / ema200) * 100

  let direction: 'bullish' | 'bearish' | 'neutral'
  let strength = 0

  if (currentPrice > ema50 && ema50 > ema100 && ema100 > ema200) {
    direction = 'bullish'
    strength = Math.min(
      1,
      (priceVsEma50 + priceVsEma100 + priceVsEma200) / 30,
    )
  } else if (currentPrice < ema50 && ema50 < ema100 && ema100 < ema200) {
    direction = 'bearish'
    strength = Math.min(
      1,
      Math.abs(priceVsEma50 + priceVsEma100 + priceVsEma200) / 30,
    )
  } else {
    direction = 'neutral'
    strength = 0.3
  }

  return {
    timeframe,
    direction,
    strength,
    ema50,
    ema100,
    ema200,
    priceVsEma50,
    priceVsEma100,
    priceVsEma200,
  }
}

