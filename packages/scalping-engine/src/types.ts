export interface Candle {
  openTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface FibonacciLevels {
  level236: number
  level382: number
  level500: number
  level618: number
  level786: number
  swingHigh: number
  swingLow: number
  range: number
}

export interface SupportResistance {
  level: number
  strength: number
  touches: number
  type: 'support' | 'resistance'
}

export interface TrendAnalysis {
  timeframe: string
  direction: 'bullish' | 'bearish' | 'neutral'
  strength: number
  ema50: number
  ema100: number
  ema200: number
  priceVsEma50: number
  priceVsEma100: number
  priceVsEma200: number
}

export interface ScalpingAnalysis {
  symbol: string
  currentPrice: number
  fibonacci: {
    '1m': FibonacciLevels | null
    '5m': FibonacciLevels | null
    '15m': FibonacciLevels | null
  }
  supportResistance: SupportResistance[]
  trend: {
    '1h': TrendAnalysis | null
    '4h': TrendAnalysis | null
    '1d': TrendAnalysis | null
  }
  atr: number
  recommendedEntry: {
    price: number
    side: 'BUY' | 'SELL'
    confidence: number
    reason: string
  } | null
  stopLoss: {
    price: number
    distance: number
    distancePct: number
  } | null
  takeProfits: Array<{
    price: number
    percentage: number
    distance: number
    distancePct: number
  }>
}

