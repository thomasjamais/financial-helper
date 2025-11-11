import type { Candle } from '@pkg/backtesting-engine'
import type { MarketFilter } from './FilteredStrategy.js'

/**
 * Trend filter that only allows trades when price is above SMA200
 * This filters out trades in downtrends
 */
export class TrendFilter implements MarketFilter {
  constructor(private period = 200) {}

  shouldTrade(candle: Candle, index: number, candles: Candle[]): boolean {
    if (index < this.period) {
      return false // Not enough history
    }

    // Calculate SMA200 from historical closes
    const closes = candles.slice(0, index + 1).map((c) => c.close)
    const sma200 = this.calculateSma(closes, this.period, index)

    if (sma200 === null) {
      return false
    }

    // Only trade if price is above SMA200 (uptrend)
    return candle.close > sma200
  }

  private calculateSma(closes: number[], period: number, index: number): number | null {
    if (index < period - 1) {
      return null
    }

    const slice = closes.slice(index - period + 1, index + 1)
    const sum = slice.reduce((a, b) => a + b, 0)
    return sum / period
  }
}

