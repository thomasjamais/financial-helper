import { describe, it, expect } from 'vitest'
import { BacktestRunner } from '../src/BacktestRunner.js'
import { SmaCrossoverStrategy } from '@pkg/strategies'
import type { BacktestConfig, Candle } from '../src/types.js'

describe('SMA Crossover Backtest', () => {
  const createConfig = (): BacktestConfig => ({
    initialCapital: 10000,
    feeRate: 0.001,
    slippageBps: 5,
    symbol: 'BTCUSDT',
    timeframeMs: 60000,
  })

  const createCandle = (close: number, timestamp: number): Candle => ({
    open: close,
    high: close * 1.01,
    low: close * 0.99,
    close,
    volume: 100,
    timestamp,
  })

  it('should run complete backtest with SMA crossover strategy', () => {
    const runner = new BacktestRunner()
    const strategy = new SmaCrossoverStrategy()
    const config = createConfig()

    // Create realistic price data with trend
    const candles: Candle[] = []
    let basePrice = 50000

    // Initial decline (SMA20 < SMA50)
    for (let i = 0; i < 60; i++) {
      basePrice -= 50
      candles.push(createCandle(basePrice, i * 60000))
    }

    // Then uptrend (SMA20 crosses above SMA50)
    for (let i = 60; i < 120; i++) {
      basePrice += 100
      candles.push(createCandle(basePrice, i * 60000))
    }

    // Then decline again (SMA20 crosses below SMA50)
    for (let i = 120; i < 180; i++) {
      basePrice -= 80
      candles.push(createCandle(basePrice, i * 60000))
    }

    const result = runner.run(strategy, candles, config)

    // Should have executed some trades
    expect(result.trades.length).toBeGreaterThan(0)
    expect(result.finalEquity).toBeGreaterThan(0)
    expect(result.totalReturn).toBeDefined()
    expect(result.maxDrawdown).toBeGreaterThanOrEqual(0)
    expect(result.benchmarkReturn).toBeDefined()

    // Equity curve should have entries
    expect(result.equityCurve.length).toBeGreaterThan(0)
    expect(result.equityCurve[0].timestamp).toBeDefined()
    expect(result.equityCurve[0].equity).toBeGreaterThan(0)
  })

  it('should calculate benchmark return correctly', () => {
    const runner = new BacktestRunner()
    const strategy = new SmaCrossoverStrategy()
    const config = createConfig()

    const candles: Candle[] = [
      createCandle(50000, 1000),
      createCandle(55000, 2000), // 10% increase
    ]

    const result = runner.run(strategy, candles, config)

    // Benchmark should be 10% (buy and hold)
    expect(result.benchmarkReturn).toBeCloseTo(10, 0)
  })

  it('should handle no trades scenario', () => {
    const runner = new BacktestRunner()
    const strategy = new SmaCrossoverStrategy()
    const config = createConfig()

    // Create stable prices (no crossovers)
    const candles: Candle[] = []
    for (let i = 0; i < 100; i++) {
      candles.push(createCandle(50000, i * 60000))
    }

    const result = runner.run(strategy, candles, config)

    // Should complete without errors
    expect(result.trades.length).toBe(0)
    expect(result.finalEquity).toBe(10000)
    expect(result.totalReturn).toBe(0)
  })
})

