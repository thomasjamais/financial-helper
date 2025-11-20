import type { Candle, ScalpingAnalysis } from '../types.js'
import { analyzeScalping, type CandleData } from '../scalpingAnalyzer.js'

export interface ScalpingBacktestConfig {
  initialCapital: number
  leverage: number
  riskPerTrade: number
  maxCapitalPerPair: number
  feeRate: number
  slippageBps: number
}

export interface ScalpingTrade {
  entryTime: number
  exitTime: number
  symbol: string
  side: 'BUY' | 'SELL'
  entryPrice: number
  exitPrice: number
  quantity: number
  stopLoss: number
  takeProfitLevels: Array<{ price: number; percentage: number }>
  pnl: number
  pnlPct: number
  exitReason: 'stop_loss' | 'take_profit' | 'timeout' | 'signal_reversal'
}

export interface ScalpingBacktestResult {
  period: string
  startDate: Date
  endDate: Date
  initialCapital: number
  finalCapital: number
  totalReturn: number
  totalReturnPct: number
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  maxDrawdown: number
  maxDrawdownPct: number
  trades: ScalpingTrade[]
  equityCurve: Array<{ timestamp: number; equity: number }>
}

export interface ScalpingBacktestParams {
  symbol: string
  period: '30d' | '90d' | '180d' | '1y'
  config: ScalpingBacktestConfig
  minConfidence: number
  maxOpenPositions: number
}

/**
 * Runs backtest for scalping strategy on historical data
 */
export async function runScalpingBacktest(
  params: ScalpingBacktestParams,
  fetchHistoricalCandles: (
    symbol: string,
    interval: string,
    startTime: number,
    endTime: number,
  ) => Promise<Candle[]>,
): Promise<ScalpingBacktestResult> {
  const { symbol, period, config, minConfidence, maxOpenPositions } = params

  const now = Date.now()
  const periodMs: Record<string, number> = {
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
    '180d': 180 * 24 * 60 * 60 * 1000,
    '1y': 365 * 24 * 60 * 60 * 1000,
  }

  const startTime = now - periodMs[period]
  const endTime = now

  const trades: ScalpingTrade[] = []
  const equityCurve: Array<{ timestamp: number; equity: number }> = []
  let capital = config.initialCapital
  const openPositions: Array<{
    entry: NonNullable<ScalpingAnalysis['recommendedEntry']>
    stopLoss: NonNullable<ScalpingAnalysis['stopLoss']>
    takeProfits: ScalpingAnalysis['takeProfits']
    entryTime: number
    entryPrice: number
    quantity: number
  }> = []

  const intervals = ['1m', '5m', '15m', '1h', '4h', '1d'] as const
  const candleDataMap = new Map<string, Candle[]>()

  for (const interval of intervals) {
    const candles = await fetchHistoricalCandles(
      symbol,
      interval,
      startTime,
      endTime,
    )
    candleDataMap.set(interval, candles)
  }

  const candles1m = candleDataMap.get('1m') || []
  const candles15m = candleDataMap.get('15m') || []

  if (candles1m.length === 0) {
    return createEmptyResult(
      period,
      new Date(startTime),
      new Date(endTime),
      config.initialCapital,
    )
  }

  let lastAnalysisTime = 0
  const analysisInterval = 15 * 60 * 1000

  for (let i = 0; i < candles1m.length; i++) {
    const currentCandle = candles1m[i]
    const currentTime = currentCandle.openTime

    if (currentTime - lastAnalysisTime < analysisInterval && i > 0) {
      continue
    }

    lastAnalysisTime = currentTime

    const candleData: CandleData = {
      '1m': candles1m.slice(Math.max(0, i - 200), i + 1),
      '5m': candleDataMap.get('5m')?.slice(0, Math.floor(i / 5) + 1) || [],
      '15m': candles15m.slice(0, Math.floor(i / 15) + 1),
      '1h': candleDataMap.get('1h')?.slice(0, Math.floor(i / 60) + 1) || [],
      '4h': candleDataMap.get('4h')?.slice(0, Math.floor(i / 240) + 1) || [],
      '1d': candleDataMap.get('1d')?.slice(0, Math.floor(i / 1440) + 1) || [],
    }

    try {
      const analysis = analyzeScalping(symbol, candleData)

      if (analysis.recommendedEntry && analysis.stopLoss) {
        if (
          analysis.recommendedEntry.confidence >= minConfidence &&
          openPositions.length < maxOpenPositions
        ) {
          const entry = analysis.recommendedEntry
          const stopLoss = analysis.stopLoss
          const takeProfits = analysis.takeProfits

          const riskAmount = capital * config.riskPerTrade
          const riskDistance = Math.abs(entry.price - stopLoss.price)
          const riskDistancePct = (riskDistance / entry.price) * 100

          if (riskDistancePct > 0) {
            const positionSize = (riskAmount / riskDistance) * config.leverage
            const maxPositionSize =
              (config.maxCapitalPerPair / entry.price) * config.leverage
            const quantity = Math.min(positionSize, maxPositionSize)

            if (
              quantity > 0 &&
              capital >= (quantity * entry.price) / config.leverage
            ) {
              openPositions.push({
                entry,
                stopLoss,
                takeProfits,
                entryTime: currentTime,
                entryPrice: entry.price,
                quantity,
              })

              capital -= (quantity * entry.price) / config.leverage
            }
          }
        }
      }

      for (let j = openPositions.length - 1; j >= 0; j--) {
        const position = openPositions[j]
        const currentPrice = currentCandle.close

        let exitPrice: number | null = null
        let exitReason: ScalpingTrade['exitReason'] | null = null

        if (position.entry.side === 'BUY') {
          if (currentPrice <= position.stopLoss.price) {
            exitPrice = position.stopLoss.price
            exitReason = 'stop_loss'
          } else {
            for (const tp of position.takeProfits) {
              if (currentPrice >= tp.price) {
                exitPrice = tp.price
                exitReason = 'take_profit'
                break
              }
            }
          }

          if (
            !exitPrice &&
            currentTime - position.entryTime > 4 * 60 * 60 * 1000
          ) {
            exitPrice = currentPrice
            exitReason = 'timeout'
          }
        } else {
          if (currentPrice >= position.stopLoss.price) {
            exitPrice = position.stopLoss.price
            exitReason = 'stop_loss'
          } else {
            for (const tp of position.takeProfits) {
              if (currentPrice <= tp.price) {
                exitPrice = tp.price
                exitReason = 'take_profit'
                break
              }
            }
          }

          if (
            !exitPrice &&
            currentTime - position.entryTime > 4 * 60 * 60 * 1000
          ) {
            exitPrice = currentPrice
            exitReason = 'timeout'
          }
        }

        if (exitPrice !== null && exitReason !== null) {
          const pnl =
            position.entry.side === 'BUY'
              ? (exitPrice - position.entryPrice) * position.quantity
              : (position.entryPrice - exitPrice) * position.quantity

          const fees =
            position.entryPrice * position.quantity * config.feeRate +
            exitPrice * position.quantity * config.feeRate
          const slippage =
            (position.entryPrice * position.quantity * config.slippageBps) /
              10000 +
            (exitPrice * position.quantity * config.slippageBps) / 10000

          const netPnl = pnl - fees - slippage
          const pnlPct =
            (netPnl /
              ((position.entryPrice * position.quantity) / config.leverage)) *
            100

          capital +=
            (position.entryPrice * position.quantity) / config.leverage + netPnl

          trades.push({
            entryTime: position.entryTime,
            exitTime: currentTime,
            symbol,
            side: position.entry.side,
            entryPrice: position.entryPrice,
            exitPrice,
            quantity: position.quantity,
            stopLoss: position.stopLoss.price,
            takeProfitLevels: position.takeProfits,
            pnl: netPnl,
            pnlPct,
            exitReason,
          })

          openPositions.splice(j, 1)
        }
      }

      const equity =
        capital +
        openPositions.reduce((sum, pos) => {
          const currentPrice = currentCandle.close
          const unrealizedPnl =
            pos.entry.side === 'BUY'
              ? (currentPrice - pos.entryPrice) * pos.quantity
              : (pos.entryPrice - currentPrice) * pos.quantity
          return (
            sum +
            (pos.entryPrice * pos.quantity) / config.leverage +
            unrealizedPnl
          )
        }, 0)

      equityCurve.push({
        timestamp: currentTime,
        equity,
      })
    } catch (err) {
      continue
    }
  }

  const finalCapital =
    equityCurve.length > 0
      ? equityCurve[equityCurve.length - 1].equity
      : capital

  const totalReturn = finalCapital - config.initialCapital
  const totalReturnPct = (totalReturn / config.initialCapital) * 100

  const winningTrades = trades.filter((t) => t.pnl > 0)
  const losingTrades = trades.filter((t) => t.pnl <= 0)
  const winRate =
    trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0

  const avgWin =
    winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length
      : 0
  const avgLoss =
    losingTrades.length > 0
      ? Math.abs(
          losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length,
        )
      : 0

  const profitFactor =
    avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0

  const maxDrawdown = calculateMaxDrawdown(equityCurve, config.initialCapital)

  return {
    period,
    startDate: new Date(startTime),
    endDate: new Date(endTime),
    initialCapital: config.initialCapital,
    finalCapital,
    totalReturn,
    totalReturnPct,
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    maxDrawdown: maxDrawdown.amount,
    maxDrawdownPct: maxDrawdown.percentage,
    trades,
    equityCurve,
  }
}

function createEmptyResult(
  period: string,
  startDate: Date,
  endDate: Date,
  initialCapital: number,
): ScalpingBacktestResult {
  return {
    period,
    startDate,
    endDate,
    initialCapital,
    finalCapital: initialCapital,
    totalReturn: 0,
    totalReturnPct: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
    maxDrawdown: 0,
    maxDrawdownPct: 0,
    trades: [],
    equityCurve: [{ timestamp: startDate.getTime(), equity: initialCapital }],
  }
}

function calculateMaxDrawdown(
  equityCurve: Array<{ timestamp: number; equity: number }>,
  initialCapital: number,
): { amount: number; percentage: number } {
  if (equityCurve.length === 0) {
    return { amount: 0, percentage: 0 }
  }

  let maxEquity = initialCapital
  let maxDrawdown = 0

  for (const point of equityCurve) {
    if (point.equity > maxEquity) {
      maxEquity = point.equity
    }
    const drawdown = maxEquity - point.equity
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
    }
  }

  return {
    amount: maxDrawdown,
    percentage: maxEquity > 0 ? (maxDrawdown / maxEquity) * 100 : 0,
  }
}
