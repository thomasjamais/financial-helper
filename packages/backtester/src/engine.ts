import type { Candle, PortfolioSnapshot, Strategy, StrategySignal, Trade } from './types'

export type BacktestResult = {
  trades: Trade[]
  snapshots: PortfolioSnapshot[]
  finalEquity: number
  initialBalance: number
  totalReturnPct: number
}

export function runBacktest(
  candles: Candle[],
  strategy: Strategy,
  initialBalance: number
): BacktestResult {
  if (candles.length === 0) {
    return {
      trades: [],
      snapshots: [],
      finalEquity: initialBalance,
      initialBalance,
      totalReturnPct: 0
    }
  }

  strategy.initialize(candles)

  let cash = initialBalance
  let positionQuantity = 0
  const trades: Trade[] = []
  const snapshots: PortfolioSnapshot[] = []

  const execute = (signal: StrategySignal, price: number, timestamp: number) => {
    if (signal === 'buy' && positionQuantity === 0 && cash > 0) {
      // Buy with full cash at current close price
      positionQuantity = cash / price
      trades.push({ timestamp, side: 'buy', price, quantity: positionQuantity })
      cash = 0
    } else if (signal === 'sell' && positionQuantity > 0) {
      // Sell entire position
      const proceeds = positionQuantity * price
      trades.push({ timestamp, side: 'sell', price, quantity: positionQuantity })
      cash = proceeds
      positionQuantity = 0
    }
  }

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]
    const price = candle.close
    const signal = strategy.onCandle(candle, i, candles)
    execute(signal, price, candle.timestamp)

    const equity = cash + positionQuantity * price
    snapshots.push({
      timestamp: candle.timestamp,
      price,
      cash,
      positionQuantity,
      equity
    })
  }

  const finalEquity = snapshots[snapshots.length - 1]?.equity ?? initialBalance
  const totalReturnPct = ((finalEquity - initialBalance) / initialBalance) * 100

  return { trades, snapshots, finalEquity, initialBalance, totalReturnPct }
}







