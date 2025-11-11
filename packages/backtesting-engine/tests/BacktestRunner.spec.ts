import { describe, it, expect } from 'vitest'
import { BacktestRunner } from '../src/BacktestRunner.js'
import type { BacktestConfig, Candle, Strategy, PortfolioState } from '../src/types.js'

describe('BacktestRunner', () => {
  const createConfig = (overrides?: Partial<BacktestConfig>): BacktestConfig => ({
    initialCapital: 10000,
    feeRate: 0.001,
    slippageBps: 5,
    symbol: 'BTCUSDT',
    timeframeMs: 60000,
    ...overrides,
  })

  const createCandle = (price: number, timestamp: number): Candle => ({
    open: price,
    high: price * 1.01,
    low: price * 0.99,
    close: price,
    volume: 100,
    timestamp,
  })

  class TestStrategy implements Strategy {
    name = 'Test Strategy'
    signals: ('buy' | 'sell' | 'hold')[] = []

    constructor(signals: ('buy' | 'sell' | 'hold')[]) {
      this.signals = signals
    }

    onCandle(
      _candle: Candle,
      index: number,
      _portfolio: PortfolioState,
      _candles?: Candle[],
    ): 'buy' | 'sell' | 'hold' {
      return this.signals[index] || 'hold'
    }
  }

  it('should return empty result for no candles', () => {
    const runner = new BacktestRunner()
    const strategy = new TestStrategy([])
    const config = createConfig()

    const result = runner.run(strategy, [], config)

    expect(result.trades).toHaveLength(0)
    expect(result.finalEquity).toBe(10000)
    expect(result.totalReturn).toBe(0)
  })

  it('should execute buy and sell signals', () => {
    const runner = new BacktestRunner()
    const candles: Candle[] = [
      createCandle(50000, 1000),
      createCandle(50000, 2000),
      createCandle(50000, 3000),
      createCandle(50000, 4000),
    ]
    const strategy = new TestStrategy(['hold', 'buy', 'hold', 'sell'])
    const config = createConfig()

    const result = runner.run(strategy, candles, config)

    expect(result.trades.length).toBeGreaterThanOrEqual(2)
    expect(result.trades[0].action).toBe('buy')
    expect(result.trades[1].action).toBe('sell')
  })

  it('should calculate total return', () => {
    const runner = new BacktestRunner()
    const candles: Candle[] = [
      createCandle(50000, 1000),
      createCandle(50000, 2000),
      createCandle(55000, 3000), // Price goes up
      createCandle(55000, 4000),
    ]
    const strategy = new TestStrategy(['hold', 'buy', 'hold', 'sell'])
    const config = createConfig()

    const result = runner.run(strategy, candles, config)

    expect(result.totalReturn).toBeGreaterThan(0) // Should be profitable
  })

  it('should calculate max drawdown', () => {
    const runner = new BacktestRunner()
    const candles: Candle[] = [
      createCandle(50000, 1000),
      createCandle(50000, 2000),
      createCandle(50000, 3000),
      createCandle(45000, 4000), // Price drops
      createCandle(45000, 5000),
    ]
    const strategy = new TestStrategy(['hold', 'buy', 'hold', 'hold', 'sell'])
    const config = createConfig()

    const result = runner.run(strategy, candles, config)

    expect(result.maxDrawdown).toBeGreaterThan(0)
  })

  it('should calculate benchmark return', () => {
    const runner = new BacktestRunner()
    const candles: Candle[] = [
      createCandle(50000, 1000),
      createCandle(55000, 2000), // 10% increase
    ]
    const strategy = new TestStrategy(['hold', 'hold'])
    const config = createConfig()

    const result = runner.run(strategy, candles, config)

    expect(result.benchmarkReturn).toBeCloseTo(10, 1) // 10% return
  })

  it('should track equity curve', () => {
    const runner = new BacktestRunner()
    const candles: Candle[] = [
      createCandle(50000, 1000),
      createCandle(50000, 2000),
      createCandle(50000, 3000),
    ]
    const strategy = new TestStrategy(['hold', 'hold', 'hold'])
    const config = createConfig()

    const result = runner.run(strategy, candles, config)

    expect(result.equityCurve.length).toBeGreaterThan(0)
    expect(result.equityCurve[0].timestamp).toBe(candles[1].timestamp)
  })

  it('should start from index 1 to avoid lookahead', () => {
    const runner = new BacktestRunner()
    const candles: Candle[] = [
      createCandle(50000, 1000),
      createCandle(50000, 2000),
      createCandle(50000, 3000),
    ]
    let callCount = 0
    const strategy: Strategy = {
      name: 'Counter',
      onCandle: () => {
        callCount++
        return 'hold'
      },
    }
    const config = createConfig()

    runner.run(strategy, candles, config)

    // Should be called for indices 1 and 2 (not 0)
    expect(callCount).toBe(2)
  })
})

