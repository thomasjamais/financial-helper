export interface ScalpingAnalysis {
  symbol: string
  currentPrice: number
  fibonacci: {
    '1m': any
    '5m': any
    '15m': any
  }
  supportResistance: Array<{
    level: number
    strength: number
    touches: number
    type: 'support' | 'resistance'
  }>
  trend: {
    '1h': any
    '4h': any
    '1d': any
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
