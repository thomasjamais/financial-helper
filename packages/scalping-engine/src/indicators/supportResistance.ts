import type { Candle, SupportResistance } from '../types.js'

/**
 * Detects support and resistance levels using pivot points
 */
export function detectSupportResistance(
  candles: Candle[],
  lookbackPeriod: number = 20,
): SupportResistance[] {
  if (candles.length < lookbackPeriod * 2) {
    return []
  }

  const levels: Map<number, { touches: number; type: 'support' | 'resistance' }> =
    new Map()

  for (let i = lookbackPeriod; i < candles.length - lookbackPeriod; i++) {
    const currentHigh = candles[i].high
    const currentLow = candles[i].low

    let isLocalHigh = true
    let isLocalLow = true

    for (let j = i - lookbackPeriod; j <= i + lookbackPeriod; j++) {
      if (j === i) continue
      if (candles[j].high > currentHigh) {
        isLocalHigh = false
      }
      if (candles[j].low < currentLow) {
        isLocalLow = false
      }
    }

    if (isLocalHigh) {
      const roundedLevel = Math.round(currentHigh * 100) / 100
      const existing = levels.get(roundedLevel)
      if (existing) {
        existing.touches++
      } else {
        levels.set(roundedLevel, { touches: 1, type: 'resistance' })
      }
    }

    if (isLocalLow) {
      const roundedLevel = Math.round(currentLow * 100) / 100
      const existing = levels.get(roundedLevel)
      if (existing) {
        existing.touches++
      } else {
        levels.set(roundedLevel, { touches: 1, type: 'support' })
      }
    }
  }

  const currentPrice = candles[candles.length - 1].close
  const tolerance = currentPrice * 0.002

  const supportResistance: SupportResistance[] = Array.from(levels.entries())
    .map(([level, data]) => {
      const distance = Math.abs(level - currentPrice)
      const strength = Math.min(1, data.touches / 3 + distance / (currentPrice * 0.1))

      return {
        level,
        strength,
        touches: data.touches,
        type: data.type,
      }
    })
    .filter((sr) => Math.abs(sr.level - currentPrice) <= tolerance * 10)
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'support' ? -1 : 1
      }
      return b.strength - a.strength
    })
    .slice(0, 10)

  return supportResistance
}

