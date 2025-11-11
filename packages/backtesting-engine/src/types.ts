export interface Candle {
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number // ms
}

export type Signal = 'buy' | 'sell' | 'hold'

export interface PortfolioState {
  balance: number // USDT
  positionSize: number // in quote currency (USDT)
  positionSymbol: string | null
  entryPrice: number | null
  lastTradeIndex: number | null
}

export interface BacktestConfig {
  initialCapital: number // ex: 10000
  feeRate: number // ex: 0.001 = 0.1%
  slippageBps: number // ex: 5 = 0.05%
  symbol: string // ex: 'BTCUSDT'
  timeframeMs: number // ex: 60_000 (1m)
}

export interface Trade {
  timestamp: number
  action: 'buy' | 'sell'
  price: number
  size: number
  fee: number
  pnl?: number // only on sell
}

export interface BacktestResult {
  totalReturn: number // % (final / initial - 1)
  finalEquity: number
  maxDrawdown: number // %
  trades: Trade[]
  equityCurve: { timestamp: number; equity: number }[]
  benchmarkReturn: number // hold from first to last candle
}

export interface Strategy {
  name: string
  onCandle(candle: Candle, index: number, portfolio: PortfolioState, candles?: Candle[]): Signal
}

