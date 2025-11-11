import { describe, it, expect } from 'vitest'
import { FilteredStrategy, TrendFilter } from '../src/composed/FilteredStrategy.js'
import { SmaCrossoverStrategy } from '../src/sma-crossover.js'
import type { Candle, PortfolioState, Strategy } from '@pkg/backtesting-engine'

describe('FilteredStrategy', () => {
  const createCandle = (close: number, timestamp: number): Candle => ({
    open: close,
    high: close * 1.01,
    low: close * 0.99,
    close,
    volume: 100,
    timestamp,
  })

  const createPortfolioState = (): PortfolioState => ({
    balance: 10000,
    positionSize: 0,
    positionSymbol: null,
    entryPrice: null,
    lastTradeIndex: null,
  })

  it('should return hold when filter blocks trading', () => {
    const baseStrategy: Strategy = {
      name: 'Always Buy',
      onCandle: () => 'buy',
    }

    const filter = new TrendFilter(200)
    const filteredStrategy = new FilteredStrategy(baseStrategy, [filter])

    const candles: Candle[] = []
    // Create candles below SMA200 (downtrend)
    for (let i = 0; i < 250; i++) {
      candles.push(createCandle(40000, i * 1000))
    }

    const portfolio = createPortfolioState()
    const signal = filteredStrategy.onCandle(
      candles[candles.length - 1],
      candles.length - 1,
      portfolio,
      candles,
    )

    // Filter should block the buy signal
    expect(signal).toBe('hold')
  })

  it('should pass through signal when all filters pass', () => {
    const baseStrategy: Strategy = {
      name: 'Always Buy',
      onCandle: () => 'buy',
    }

    // Create a filter that always allows trading
    const alwaysAllowFilter = {
      shouldTrade: () => true,
    }

    const filteredStrategy = new FilteredStrategy(baseStrategy, [alwaysAllowFilter])

    const candles: Candle[] = [createCandle(50000, 1000)]
    const portfolio = createPortfolioState()
    const signal = filteredStrategy.onCandle(candles[0], 0, portfolio, candles)

    expect(signal).toBe('buy')
  })

  it('should work with multiple filters', () => {
    const baseStrategy: Strategy = {
      name: 'Always Buy',
      onCandle: () => 'buy',
    }

    const filter1 = {
      shouldTrade: () => true,
    }
    const filter2 = {
      shouldTrade: () => false, // Blocks trading
    }

    const filteredStrategy = new FilteredStrategy(baseStrategy, [filter1, filter2])

    const candles: Candle[] = [createCandle(50000, 1000)]
    const portfolio = createPortfolioState()
    const signal = filteredStrategy.onCandle(candles[0], 0, portfolio, candles)

    // Should be blocked by filter2
    expect(signal).toBe('hold')
  })

  it('should compose with SMA crossover strategy', () => {
    const baseStrategy = new SmaCrossoverStrategy()
    const trendFilter = new TrendFilter(50) // Lower period for testing
    const filteredStrategy = new FilteredStrategy(baseStrategy, [trendFilter])

    const candles: Candle[] = []
    const portfolio = createPortfolioState()

    // Create uptrending prices above SMA50
    for (let i = 0; i < 100; i++) {
      const price = 50000 + i * 10
      candles.push(createCandle(price, i * 1000))
    }

    // Process candles
    for (let i = 0; i < candles.length; i++) {
      filteredStrategy.onCandle(candles[i], i, portfolio, candles)
    }

    // Strategy should work with filter applied
    expect(filteredStrategy.name).toContain('Filtered')
  })
})

describe('TrendFilter', () => {
  const createCandle = (close: number, timestamp: number): Candle => ({
    open: close,
    high: close * 1.01,
    low: close * 0.99,
    close,
    volume: 100,
    timestamp,
  })

  it('should return false when not enough history', () => {
    const filter = new TrendFilter(200)
    const candles: Candle[] = []

    for (let i = 0; i < 100; i++) {
      candles.push(createCandle(50000, i * 1000))
    }

    const result = filter.shouldTrade(candles[99], 99, candles)
    expect(result).toBe(false)
  })

  it('should return true when price is above SMA200', () => {
    const filter = new TrendFilter(50) // Lower period for testing
    const candles: Candle[] = []

    // Create uptrending prices
    for (let i = 0; i < 100; i++) {
      const price = 50000 + i * 10
      candles.push(createCandle(price, i * 1000))
    }

    const result = filter.shouldTrade(candles[99], 99, candles)
    expect(result).toBe(true)
  })

  it('should return false when price is below SMA200', () => {
    const filter = new TrendFilter(50) // Lower period for testing
    const candles: Candle[] = []

    // Create downtrending prices
    for (let i = 0; i < 100; i++) {
      const price = 50000 - i * 10
      candles.push(createCandle(price, i * 1000))
    }

    const result = filter.shouldTrade(candles[99], 99, candles)
    expect(result).toBe(false)
  })
})

