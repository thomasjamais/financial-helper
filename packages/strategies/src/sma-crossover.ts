import type { Candle, Signal, PortfolioState, Strategy } from '@pkg/backtesting-engine'

/**
 * Stateless SMA Crossover Strategy
 * 
 * Detects golden cross (SMA20 crosses above SMA50) for buy signals
 * Detects death cross (SMA20 crosses below SMA50) for sell signals
 */
export class SmaCrossoverStrategy implements Strategy {
  name = 'SMA Crossover'

  private sma20: number[] = []
  private sma50: number[] = []

  onCandle(candle: Candle, index: number, portfolio: PortfolioState, candles?: Candle[]): Signal {
    // Update SMA arrays with current close
    this.updateSma(candle.close, 20, this.sma20)
    this.updateSma(candle.close, 50, this.sma50)

    // Need at least 50 candles to have valid SMA50
    if (this.sma50.length < 50) {
      return 'hold'
    }

    // Calculate current SMAs
    const curSma20 = this.calculateSma(this.sma20)
    const curSma50 = this.calculateSma(this.sma50)

    if (curSma20 === null || curSma50 === null) {
      return 'hold'
    }

    // Need previous SMAs to detect crossover
    // We need to calculate previous SMAs by removing the last value
    if (this.sma20.length < 20 || this.sma50.length < 50) {
      return 'hold'
    }

    // Calculate previous SMAs (without the last value)
    const prevSma20Values = this.sma20.slice(0, -1)
    const prevSma50Values = this.sma50.slice(0, -1)

    if (prevSma20Values.length < 20 || prevSma50Values.length < 50) {
      return 'hold'
    }

    const prevSma20 = this.calculateSma(prevSma20Values)
    const prevSma50 = this.calculateSma(prevSma50Values)

    if (prevSma20 === null || prevSma50 === null) {
      return 'hold'
    }

    // Golden cross: SMA20 crosses above SMA50 (buy signal)
    if (prevSma20 <= prevSma50 && curSma20 > curSma50) {
      return 'buy'
    }

    // Death cross: SMA20 crosses below SMA50 (sell signal)
    if (prevSma20 >= prevSma50 && curSma20 < curSma50) {
      return 'sell'
    }

    return 'hold'
  }

  /**
   * Update SMA array with sliding window calculation
   * Maintains a rolling window of closes and calculates SMA incrementally
   */
  private updateSma(value: number, period: number, history: number[]): void {
    // Store the close value
    history.push(value)

    // Keep only the last 'period' values
    if (history.length > period) {
      history.shift()
    }
  }

  /**
   * Calculate SMA from history array
   */
  private calculateSma(history: number[]): number | null {
    if (history.length === 0) {
      return null
    }
    const sum = history.reduce((a, b) => a + b, 0)
    return sum / history.length
  }
}

