import type { Candle, FibonacciLevels } from '../types.js'

/**
 * Identifies swing high and swing low in a price series
 */
function findSwingPoints(candles: Candle[]): {
  swingHigh: number
  swingLow: number
  swingHighIndex: number
  swingLowIndex: number
} {
  if (candles.length < 20) {
    const highs = candles.map((c) => c.high)
    const lows = candles.map((c) => c.low)
    return {
      swingHigh: Math.max(...highs),
      swingLow: Math.min(...lows),
      swingHighIndex: highs.indexOf(Math.max(...highs)),
      swingLowIndex: lows.indexOf(Math.min(...lows)),
    }
  }

  let swingHigh = candles[0].high
  let swingLow = candles[0].low
  let swingHighIndex = 0
  let swingLowIndex = 0

  for (let i = 5; i < candles.length - 5; i++) {
    const isLocalHigh =
      candles[i].high >= candles[i - 1].high &&
      candles[i].high >= candles[i - 2].high &&
      candles[i].high >= candles[i + 1].high &&
      candles[i].high >= candles[i + 2].high

    const isLocalLow =
      candles[i].low <= candles[i - 1].low &&
      candles[i].low <= candles[i - 2].low &&
      candles[i].low <= candles[i + 1].low &&
      candles[i].low <= candles[i + 2].low

    if (isLocalHigh && candles[i].high > swingHigh) {
      swingHigh = candles[i].high
      swingHighIndex = i
    }

    if (isLocalLow && candles[i].low < swingLow) {
      swingLow = candles[i].low
      swingLowIndex = i
    }
  }

  return { swingHigh, swingLow, swingHighIndex, swingLowIndex }
}

/**
 * Calculates Fibonacci retracement levels
 * Standard levels: 23.6%, 38.2%, 50%, 61.8%, 78.6%
 */
export function calculateFibonacci(
  candles: Candle[],
): FibonacciLevels | null {
  if (candles.length < 20) {
    return null
  }

  const { swingHigh, swingLow, swingHighIndex, swingLowIndex } =
    findSwingPoints(candles)
  const range = Math.abs(swingHigh - swingLow)

  if (range === 0) {
    return null
  }

  const isUptrend = swingHighIndex > swingLowIndex

  let level236: number
  let level382: number
  let level500: number
  let level618: number
  let level786: number

  if (isUptrend) {
    const retracement = swingHigh - swingLow
    level236 = swingHigh - retracement * 0.236
    level382 = swingHigh - retracement * 0.382
    level500 = swingHigh - retracement * 0.5
    level618 = swingHigh - retracement * 0.618
    level786 = swingHigh - retracement * 0.786
  } else {
    const retracement = swingLow - swingHigh
    level236 = swingLow - retracement * 0.236
    level382 = swingLow - retracement * 0.382
    level500 = swingLow - retracement * 0.5
    level618 = swingLow - retracement * 0.618
    level786 = swingLow - retracement * 0.786
  }

  return {
    level236,
    level382,
    level500,
    level618,
    level786,
    swingHigh,
    swingLow,
    range,
  }
}

