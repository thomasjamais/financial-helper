import type { Trade, PortfolioSnapshot, BacktestMetrics } from './types'

export type { BacktestMetrics }

export function calculateMetrics(
  trades: Trade[],
  snapshots: PortfolioSnapshot[],
  initialBalance: number,
): BacktestMetrics {
  if (trades.length === 0 || snapshots.length === 0) {
    return {
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
    }
  }

  const finalEquity = snapshots[snapshots.length - 1]?.equity ?? initialBalance
  const totalReturnPct = ((finalEquity - initialBalance) / initialBalance) * 100

  const { maxDrawdown, maxDrawdownPct } = calculateMaxDrawdown(snapshots, initialBalance)
  const { winRate, profitableTrades, losingTrades, avgWin, avgLoss, largestWin, largestLoss, profitFactor } =
    calculateTradeStats(trades)
  const avgTradeDuration = calculateAvgTradeDuration(trades)
  const sharpeRatio = calculateSharpeRatio(snapshots, initialBalance)

  return {
    totalReturnPct,
    sharpeRatio,
    maxDrawdown,
    maxDrawdownPct,
    winRate,
    avgTradeDuration,
    totalTrades: trades.length,
    profitableTrades,
    losingTrades,
    profitFactor,
    avgWin,
    avgLoss,
    largestWin,
    largestLoss,
  }
}

function calculateMaxDrawdown(
  snapshots: PortfolioSnapshot[],
  initialBalance: number,
): { maxDrawdown: number; maxDrawdownPct: number } {
  if (snapshots.length === 0) {
    return { maxDrawdown: 0, maxDrawdownPct: 0 }
  }

  let peak = initialBalance
  let maxDrawdown = 0
  let maxDrawdownPct = 0

  for (const snapshot of snapshots) {
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

  return { maxDrawdown, maxDrawdownPct }
}

function calculateTradeStats(trades: Trade[]): {
  winRate: number
  profitableTrades: number
  losingTrades: number
  avgWin: number
  avgLoss: number
  largestWin: number
  largestLoss: number
  profitFactor: number
} {
  if (trades.length === 0) {
    return {
      winRate: 0,
      profitableTrades: 0,
      losingTrades: 0,
      avgWin: 0,
      avgLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      profitFactor: 0,
    }
  }

  const tradePnls: number[] = []
  let positionQuantity = 0
  let entryPrice = 0
  let entryTimestamp = 0

  for (const trade of trades) {
    if (trade.side === 'buy') {
      positionQuantity = trade.quantity
      entryPrice = trade.price
      entryTimestamp = trade.timestamp
    } else if (trade.side === 'sell' && positionQuantity > 0) {
      const pnl = (trade.price - entryPrice) * positionQuantity
      tradePnls.push(pnl)
      positionQuantity = 0
    }
  }

  const profitableTrades = tradePnls.filter((pnl) => pnl > 0).length
  const losingTrades = tradePnls.filter((pnl) => pnl < 0).length
  const winRate = tradePnls.length > 0 ? (profitableTrades / tradePnls.length) * 100 : 0

  const wins = tradePnls.filter((pnl) => pnl > 0)
  const losses = tradePnls.filter((pnl) => pnl < 0)

  const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0
  const largestWin = wins.length > 0 ? Math.max(...wins) : 0
  const largestLoss = losses.length > 0 ? Math.min(...losses) : 0

  const grossProfit = wins.reduce((a, b) => a + b, 0)
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

  return {
    winRate,
    profitableTrades,
    losingTrades,
    avgWin,
    avgLoss,
    largestWin,
    largestLoss,
    profitFactor,
  }
}

function calculateAvgTradeDuration(trades: Trade[]): number {
  if (trades.length === 0) {
    return 0
  }

  const durations: number[] = []
  let entryTimestamp = 0
  let positionQuantity = 0

  for (const trade of trades) {
    if (trade.side === 'buy') {
      entryTimestamp = trade.timestamp
      positionQuantity = trade.quantity
    } else if (trade.side === 'sell' && positionQuantity > 0) {
      const duration = trade.timestamp - entryTimestamp
      durations.push(duration)
      positionQuantity = 0
    }
  }

  return durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
}

function calculateSharpeRatio(snapshots: PortfolioSnapshot[], initialBalance: number): number {
  if (snapshots.length < 2) {
    return 0
  }

  const returns: number[] = []
  for (let i = 1; i < snapshots.length; i++) {
    const prevEquity = snapshots[i - 1].equity
    const currentEquity = snapshots[i].equity
    if (prevEquity > 0) {
      const returnPct = ((currentEquity - prevEquity) / prevEquity) * 100
      returns.push(returnPct)
    }
  }

  if (returns.length === 0) {
    return 0
  }

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  const stdDev = Math.sqrt(variance)

  if (stdDev === 0) {
    return 0
  }

  const annualizedReturn = avgReturn * 252
  const annualizedStdDev = stdDev * Math.sqrt(252)
  const sharpeRatio = annualizedStdDev > 0 ? annualizedReturn / annualizedStdDev : 0

  return sharpeRatio
}
