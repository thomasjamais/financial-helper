export type Candle = {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export type Trade = {
  timestamp: number
  side: 'buy' | 'sell'
  price: number
  quantity: number
}

export type PortfolioSnapshot = {
  timestamp: number
  price: number
  cash: number
  positionQuantity: number
  equity: number
}

export type StrategySignal = 'buy' | 'sell' | 'hold'

export interface Strategy {
  readonly name: string
  initialize(candles: Candle[]): void
  onCandle(candle: Candle, index: number, candles: Candle[]): StrategySignal
}

export type BacktestMetrics = {
  totalReturnPct: number
  sharpeRatio: number
  maxDrawdown: number
  maxDrawdownPct: number
  winRate: number
  avgTradeDuration: number
  totalTrades: number
  profitableTrades: number
  losingTrades: number
  profitFactor: number
  avgWin: number
  avgLoss: number
  largestWin: number
  largestLoss: number
}

export type EnhancedBacktestResult = {
  trades: Trade[]
  snapshots: PortfolioSnapshot[]
  finalEquity: number
  initialBalance: number
  totalReturnPct: number
  metrics: BacktestMetrics
}

export type PerCryptoBacktestResult = {
  symbol: string
  result: EnhancedBacktestResult
}

export type MultiCryptoBacktestResult = {
  aggregated: EnhancedBacktestResult
  perCrypto: PerCryptoBacktestResult[]
}
