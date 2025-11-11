import type { Candle, Signal, PortfolioState, Strategy } from '@pkg/backtesting-engine'

/**
 * Market filter interface for filtering trades based on market conditions
 */
export interface MarketFilter {
  shouldTrade(candle: Candle, index: number, candles: Candle[]): boolean
}

/**
 * Composed strategy that wraps a base strategy with market filters
 * Returns 'hold' if any filter blocks trading
 */
export class FilteredStrategy implements Strategy {
  constructor(
    private baseStrategy: Strategy,
    private filters: MarketFilter[],
  ) {
    this.name = `Filtered(${baseStrategy.name})`
  }

  name: string

  onCandle(
    candle: Candle,
    index: number,
    portfolio: PortfolioState,
    candles?: Candle[],
  ): Signal {
    // Check all filters - if any blocks trading, return 'hold'
    if (candles) {
      for (const filter of this.filters) {
        if (!filter.shouldTrade(candle, index, candles)) {
          return 'hold'
        }
      }
    }

    // All filters passed, delegate to base strategy
    return this.baseStrategy.onCandle(candle, index, portfolio, candles)
  }
}


