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






