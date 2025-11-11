import type { Candle, Strategy, BacktestConfig, BacktestResult } from './types.js'
import { PortfolioSimulator } from './PortfolioSimulator.js'

/**
 * Calculate maximum drawdown from equity curve
 */
function calculateMaxDrawdown(
  equityCurve: { timestamp: number; equity: number }[],
): number {
  if (equityCurve.length === 0) {
    return 0
  }

  let peak = equityCurve[0].equity
  let maxDrawdown = 0

  for (const point of equityCurve) {
    if (point.equity > peak) {
      peak = point.equity
    }

    const drawdown = (peak - point.equity) / peak
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
    }
  }

  return maxDrawdown * 100 // Convert to percentage
}

/**
 * Calculate benchmark return (buy and hold)
 */
function calculateBenchmarkReturn(
  candles: Candle[],
  initialCapital: number,
): number {
  if (candles.length < 2) {
    return 0
  }

  const firstPrice = candles[0].close
  const lastPrice = candles[candles.length - 1].close

  if (firstPrice === 0) {
    return 0
  }

  const returnRatio = (lastPrice - firstPrice) / firstPrice
  return returnRatio * 100 // Convert to percentage
}

export class BacktestRunner {
  run(
    strategy: Strategy,
    candles: Candle[],
    config: BacktestConfig,
  ): BacktestResult {
    if (candles.length === 0) {
      return {
        totalReturn: 0,
        finalEquity: config.initialCapital,
        maxDrawdown: 0,
        trades: [],
        equityCurve: [],
        benchmarkReturn: 0,
      }
    }

    const simulator = new PortfolioSimulator(config)
    const equityCurve: { timestamp: number; equity: number }[] = []

    // Start from index 1 to avoid lookahead bias
    // Use the open price of the current candle for execution
    for (let i = 1; i < candles.length; i++) {
      const candle = candles[i]
      const portfolioState = simulator.getState()

      // Get signal from strategy (pass full candles array for filters that need history)
      const signal = strategy.onCandle(candle, i, portfolioState, candles)

      // Execute trades based on signal
      if (signal === 'buy') {
        simulator.buy(candle, i)
      } else if (signal === 'sell') {
        simulator.sell(candle, i)
      }

      // Update equity curve using current close price
      const equity = simulator.getEquity(candle.close)
      equityCurve.push({
        timestamp: candle.timestamp,
        equity,
      })
    }

    // Calculate final equity (using last candle's close)
    const finalEquity = simulator.getEquity(candles[candles.length - 1].close)
    const totalReturn = ((finalEquity - config.initialCapital) / config.initialCapital) * 100

    // Calculate metrics
    const maxDrawdown = calculateMaxDrawdown(equityCurve)
    const benchmarkReturn = calculateBenchmarkReturn(candles, config.initialCapital)

    return {
      totalReturn,
      finalEquity,
      maxDrawdown,
      trades: simulator.getTrades(),
      equityCurve,
      benchmarkReturn,
    }
  }
}

