import type { Candle, MultiCryptoBacktestResult, PerCryptoBacktestResult, Strategy } from './types'
import { runEnhancedBacktest } from './engine'
import { calculateMetrics } from './metrics'

export type MultiCryptoBacktestOptions = {
  symbols: string[]
  candlesMap: Map<string, Candle[]>
  strategy: Strategy
  initialBalance: number
}

export function runMultiCryptoBacktest(
  options: MultiCryptoBacktestOptions,
): MultiCryptoBacktestResult {
  const { symbols, candlesMap, strategy, initialBalance } = options

  const perCryptoResults: PerCryptoBacktestResult[] = []

  for (const symbol of symbols) {
    const candles = candlesMap.get(symbol)
    if (!candles || candles.length === 0) {
      continue
    }

    const result = runEnhancedBacktest(candles, strategy, initialBalance)
    perCryptoResults.push({
      symbol,
      result,
    })
  }

  const aggregated = aggregateResults(perCryptoResults, initialBalance)

  return {
    aggregated,
    perCrypto: perCryptoResults,
  }
}

function aggregateResults(
  perCryptoResults: PerCryptoBacktestResult[],
  initialBalance: number,
): PerCryptoBacktestResult['result'] {
  if (perCryptoResults.length === 0) {
    return {
      trades: [],
      snapshots: [],
      finalEquity: initialBalance,
      initialBalance,
      totalReturnPct: 0,
      metrics: {
        totalReturnPct: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        maxDrawdownPct: 0,
        winRate: 0,
        avgTradeDuration: 0,
        totalTrades: 0,
        profitableTrades: 0,
        losingTrades: 0,
        profitFactor: 0,
        avgWin: 0,
        avgLoss: 0,
        largestWin: 0,
        largestLoss: 0,
      },
    }
  }

  const totalInitialBalance = initialBalance * perCryptoResults.length
  let totalFinalEquity = 0
  let totalTrades = 0
  let totalProfitableTrades = 0
  let totalLosingTrades = 0
  let totalGrossProfit = 0
  let totalGrossLoss = 0
  let totalAvgWin = 0
  let totalAvgLoss = 0
  let largestWin = 0
  let largestLoss = 0
  let totalMaxDrawdown = 0
  let totalMaxDrawdownPct = 0
  let totalAvgTradeDuration = 0

  const allSnapshots: Array<{ timestamp: number; equity: number }> = []

  for (const { result } of perCryptoResults) {
    totalFinalEquity += result.finalEquity
    totalTrades += result.metrics.totalTrades
    totalProfitableTrades += result.metrics.profitableTrades
    totalLosingTrades += result.metrics.losingTrades
    totalGrossProfit += result.metrics.avgWin * result.metrics.profitableTrades
    totalGrossLoss += Math.abs(result.metrics.avgLoss * result.metrics.losingTrades)
    totalAvgWin += result.metrics.avgWin
    totalAvgLoss += result.metrics.avgLoss
    largestWin = Math.max(largestWin, result.metrics.largestWin)
    largestLoss = Math.min(largestLoss, result.metrics.largestLoss)
    totalMaxDrawdown = Math.max(totalMaxDrawdown, result.metrics.maxDrawdown)
    totalMaxDrawdownPct = Math.max(totalMaxDrawdownPct, result.metrics.maxDrawdownPct)
    totalAvgTradeDuration += result.metrics.avgTradeDuration

    for (const snapshot of result.snapshots) {
      allSnapshots.push({
        timestamp: snapshot.timestamp,
        equity: snapshot.equity,
      })
    }
  }

  const totalReturnPct = ((totalFinalEquity - totalInitialBalance) / totalInitialBalance) * 100
  const winRate = totalTrades > 0 ? (totalProfitableTrades / totalTrades) * 100 : 0
  const avgWin = totalProfitableTrades > 0 ? totalGrossProfit / totalProfitableTrades : 0
  const avgLoss = totalLosingTrades > 0 ? totalGrossLoss / totalLosingTrades : 0
  const profitFactor = totalGrossLoss > 0 ? totalGrossProfit / totalGrossLoss : totalGrossProfit > 0 ? Infinity : 0
  const avgTradeDuration = perCryptoResults.length > 0 ? totalAvgTradeDuration / perCryptoResults.length : 0

  allSnapshots.sort((a, b) => a.timestamp - b.timestamp)

  let peak = totalInitialBalance
  let maxDrawdown = 0
  let maxDrawdownPct = 0

  for (const snapshot of allSnapshots) {
    if (snapshot.equity > peak) {
      peak = snapshot.equity
    }

    const drawdown = peak - snapshot.equity
    const drawdownPct = peak > 0 ? (drawdown / peak) * 100 : 0

    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
      maxDrawdownPct = drawdownPct
    }
  }

  const returns: number[] = []
  for (let i = 1; i < allSnapshots.length; i++) {
    const prevEquity = allSnapshots[i - 1].equity
    const currentEquity = allSnapshots[i].equity
    if (prevEquity > 0) {
      const returnPct = ((currentEquity - prevEquity) / prevEquity) * 100
      returns.push(returnPct)
    }
  }

  let sharpeRatio = 0
  if (returns.length > 0) {
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    const stdDev = Math.sqrt(variance)

    if (stdDev > 0) {
      const annualizedReturn = avgReturn * 252
      const annualizedStdDev = stdDev * Math.sqrt(252)
      sharpeRatio = annualizedReturn / annualizedStdDev
    }
  }

  return {
    trades: [],
    snapshots: allSnapshots.map((s) => ({
      timestamp: s.timestamp,
      price: 0,
      cash: 0,
      positionQuantity: 0,
      equity: s.equity,
    })),
    finalEquity: totalFinalEquity,
    initialBalance: totalInitialBalance,
    totalReturnPct,
    metrics: {
      totalReturnPct,
      sharpeRatio,
      maxDrawdown,
      maxDrawdownPct,
      winRate,
      avgTradeDuration,
      totalTrades,
      profitableTrades: totalProfitableTrades,
      losingTrades: totalLosingTrades,
      profitFactor,
      avgWin,
      avgLoss,
      largestWin,
      largestLoss,
    },
  }
}

