import type { Candle, ScalpingAnalysis } from './types.js'
import { calculateFibonacci } from './indicators/fibonacci.js'
import { detectSupportResistance } from './indicators/supportResistance.js'
import { analyzeTrend } from './indicators/trendAnalysis.js'
import { calculateATR } from './utils/atr.js'

export interface CandleData {
  '1m': Candle[]
  '5m': Candle[]
  '15m': Candle[]
  '1h': Candle[]
  '4h': Candle[]
  '1d': Candle[]
}

/**
 * Main scalping analyzer that combines all indicators
 */
export function analyzeScalping(
  symbol: string,
  candleData: CandleData,
): ScalpingAnalysis {
  const currentPrice = candleData['1m'][candleData['1m'].length - 1]?.close || 0

  const fibonacci1m = calculateFibonacci(candleData['1m'])
  const fibonacci5m = calculateFibonacci(candleData['5m'])
  const fibonacci15m = calculateFibonacci(candleData['15m'])

  const supportResistance = detectSupportResistance(candleData['15m'])

  const trend1h = analyzeTrend(candleData['1h'], '1h')
  const trend4h = analyzeTrend(candleData['4h'], '4h')
  const trend1d = analyzeTrend(candleData['1d'], '1d')

  const atr = calculateATR(candleData['15m'])

  const recommendedEntry = calculateRecommendedEntry(
    currentPrice,
    fibonacci15m,
    supportResistance,
    trend1h,
    atr,
  )

  const stopLoss = calculateStopLoss(
    currentPrice,
    recommendedEntry,
    atr,
    supportResistance,
  )

  const takeProfits = calculateTakeProfits(
    currentPrice,
    recommendedEntry,
    stopLoss,
    atr,
  )

  return {
    symbol,
    currentPrice,
    fibonacci: {
      '1m': fibonacci1m,
      '5m': fibonacci5m,
      '15m': fibonacci15m,
    },
    supportResistance,
    trend: {
      '1h': trend1h,
      '4h': trend4h,
      '1d': trend1d,
    },
    atr,
    recommendedEntry,
    stopLoss,
    takeProfits,
  }
}

function calculateRecommendedEntry(
  currentPrice: number,
  fibonacci15m: ReturnType<typeof calculateFibonacci>,
  supportResistance: ReturnType<typeof detectSupportResistance>,
  trend1h: ReturnType<typeof analyzeTrend>,
  atr: number,
): ScalpingAnalysis['recommendedEntry'] {
  if (!trend1h) {
    return null
  }

  const side: 'BUY' | 'SELL' = trend1h.direction === 'bullish' ? 'BUY' : 'SELL'

  let entryPrice = currentPrice
  let confidence = trend1h.strength
  const reasons: string[] = []

  if (trend1h.direction === 'bullish') {
    reasons.push(`Bullish trend on 1h (strength: ${(trend1h.strength * 100).toFixed(1)}%)`)

    if (fibonacci15m) {
      const fibLevels = [
        fibonacci15m.level618,
        fibonacci15m.level500,
        fibonacci15m.level382,
      ]
      const nearestFib = fibLevels.reduce((prev, curr) =>
        Math.abs(curr - currentPrice) < Math.abs(prev - currentPrice)
          ? curr
          : prev,
      )
      if (Math.abs(nearestFib - currentPrice) < currentPrice * 0.01) {
        entryPrice = nearestFib
        confidence += 0.2
        reasons.push(`Near Fibonacci ${nearestFib.toFixed(2)} level`)
      }
    }

    const nearestSupport = supportResistance
      .filter((sr) => sr.type === 'support' && sr.level < currentPrice)
      .sort((a, b) => b.level - a.level)[0]

    if (nearestSupport && currentPrice - nearestSupport.level < atr * 2) {
      entryPrice = nearestSupport.level
      confidence += 0.15
      reasons.push(`Near support at ${nearestSupport.level.toFixed(2)}`)
    }
  } else {
    reasons.push(`Bearish trend on 1h (strength: ${(trend1h.strength * 100).toFixed(1)}%)`)

    if (fibonacci15m) {
      const fibLevels = [
        fibonacci15m.level618,
        fibonacci15m.level500,
        fibonacci15m.level382,
      ]
      const nearestFib = fibLevels.reduce((prev, curr) =>
        Math.abs(curr - currentPrice) < Math.abs(prev - currentPrice)
          ? curr
          : prev,
      )
      if (Math.abs(nearestFib - currentPrice) < currentPrice * 0.01) {
        entryPrice = nearestFib
        confidence += 0.2
        reasons.push(`Near Fibonacci ${nearestFib.toFixed(2)} level`)
      }
    }

    const nearestResistance = supportResistance
      .filter((sr) => sr.type === 'resistance' && sr.level > currentPrice)
      .sort((a, b) => a.level - b.level)[0]

    if (nearestResistance && nearestResistance.level - currentPrice < atr * 2) {
      entryPrice = nearestResistance.level
      confidence += 0.15
      reasons.push(`Near resistance at ${nearestResistance.level.toFixed(2)}`)
    }
  }

  confidence = Math.min(1, confidence)

  return {
    price: entryPrice,
    side,
    confidence,
    reason: reasons.join('; '),
  }
}

function calculateStopLoss(
  currentPrice: number,
  entry: ScalpingAnalysis['recommendedEntry'],
  atr: number,
  supportResistance: ReturnType<typeof detectSupportResistance>,
): ScalpingAnalysis['stopLoss'] {
  if (!entry) {
    return null
  }

  let stopLossPrice: number
  const atrBasedStop = atr * 1.5

  if (entry.side === 'BUY') {
    const nearestSupport = supportResistance
      .filter((sr) => sr.type === 'support' && sr.level < entry.price)
      .sort((a, b) => b.level - a.level)[0]

    if (nearestSupport && entry.price - nearestSupport.level < atrBasedStop * 2) {
      stopLossPrice = nearestSupport.level - atr * 0.5
    } else {
      stopLossPrice = entry.price - atrBasedStop
    }
  } else {
    const nearestResistance = supportResistance
      .filter((sr) => sr.type === 'resistance' && sr.level > entry.price)
      .sort((a, b) => a.level - b.level)[0]

    if (nearestResistance && nearestResistance.level - entry.price < atrBasedStop * 2) {
      stopLossPrice = nearestResistance.level + atr * 0.5
    } else {
      stopLossPrice = entry.price + atrBasedStop
    }
  }

  const distance = Math.abs(entry.price - stopLossPrice)
  const distancePct = (distance / entry.price) * 100

  return {
    price: stopLossPrice,
    distance,
    distancePct,
  }
}

function calculateTakeProfits(
  currentPrice: number,
  entry: ScalpingAnalysis['recommendedEntry'],
  stopLoss: ScalpingAnalysis['stopLoss'],
  atr: number,
): ScalpingAnalysis['takeProfits'] {
  if (!entry || !stopLoss) {
    return []
  }

  const risk = Math.abs(entry.price - stopLoss.price)
  const riskRewardRatios = [1, 2, 3, 4]

  return riskRewardRatios.map((rr) => {
    const distance = risk * rr
    const distancePct = (distance / entry.price) * 100

    let price: number
    if (entry.side === 'BUY') {
      price = entry.price + distance
    } else {
      price = entry.price - distance
    }

    return {
      price,
      percentage: rr * 25,
      distance,
      distancePct,
    }
  })
}

