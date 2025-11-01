import { SMA } from 'technicalindicators'
import axios from 'axios'

interface Candle {
  openTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface TechnicalTradeIdea {
  symbol: string
  side: 'BUY' | 'SELL'
  score: number
  reason: string
  entryPrice: number
  takeProfitPct: number
  stopLossPct: number
  exitStrategy: string
  metadata: {
    fastPeriod: number
    slowPeriod: number
    fastSma: number
    slowSma: number
    currentPrice: number
    atr?: number
    volatility?: number
  }
}

/**
 * Fetches recent klines from Binance public API
 */
async function fetchKlines(
  symbol: string,
  interval: string = '1h',
  limit: number = 200,
): Promise<Candle[]> {
  const resp = await axios.get(
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    { timeout: 10000 },
  )
  const data = resp.data as any[]
  return data.map((k) => ({
    openTime: Number(k[0]),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  }))
}

/**
 * Calculates Average True Range (ATR) for volatility-based TP/SL
 */
function calculateATR(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) return 0

  const trueRanges: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high
    const low = candles[i].low
    const prevClose = candles[i - 1].close
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose),
    )
    trueRanges.push(tr)
  }

  // Calculate SMA of true ranges
  const atrValues = SMA.calculate({
    period,
    values: trueRanges,
  })

  return atrValues[atrValues.length - 1] || 0
}

/**
 * Computes a trade idea based on moving average crossover
 */
function computeMaCrossover(
  candles: Candle[],
  fastPeriod: number = 20,
  slowPeriod: number = 50,
): {
  side: 'BUY' | 'SELL'
  score: number
  reason: string
  fastSma: number
  slowSma: number
  currentPrice: number
  atr: number
} | null {
  if (candles.length < slowPeriod) return null

  const closes = candles.map((c) => c.close)
  const fastSma = SMA.calculate({ period: fastPeriod, values: closes })
  const slowSma = SMA.calculate({ period: slowPeriod, values: closes })

  const fastLatest = fastSma[fastSma.length - 1]
  const slowLatest = slowSma[slowSma.length - 1]
  const currentPrice = closes[closes.length - 1]

  if (fastLatest === undefined || slowLatest === undefined) return null

  const diff = fastLatest - slowLatest
  const side: 'BUY' | 'SELL' = diff >= 0 ? 'BUY' : 'SELL'

  // Normalize score: 0-1 based on percentage difference
  const percentageDiff = Math.abs(diff) / slowLatest
  const score = Math.min(1, percentageDiff * 2) // Multiply by 2 to scale better

  const reason = `MA${fastPeriod}-${slowPeriod} crossover: fast=${fastLatest.toFixed(
    2,
  )}, slow=${slowLatest.toFixed(2)}, diff=${(percentageDiff * 100).toFixed(
    2,
  )}%`

  const atr = calculateATR(candles)

  return {
    side,
    score,
    reason,
    fastSma: fastLatest,
    slowSma: slowLatest,
    currentPrice,
    atr,
  }
}

/**
 * Calculates Take Profit and Stop Loss based on ATR and volatility
 */
function calculateTPSL(
  currentPrice: number,
  side: 'BUY' | 'SELL',
  atr: number,
): {
  takeProfitPct: number
  stopLossPct: number
  entryPrice: number
  exitStrategy: string
} {
  // Use ATR for dynamic TP/SL
  const atrMultiplier = 2.0 // 2x ATR for TP
  const atrStopMultiplier = 1.0 // 1x ATR for SL

  if (side === 'BUY') {
    // For BUY: TP above, SL below
    const tpDistance = (atr * atrMultiplier) / currentPrice
    const slDistance = (atr * atrStopMultiplier) / currentPrice

    return {
      entryPrice: currentPrice,
      takeProfitPct: Math.min(tpDistance, 0.05), // Cap at 5% for safety
      stopLossPct: Math.min(slDistance, 0.02), // Cap at 2% for safety
      exitStrategy: `Take profit at +${(tpDistance * 100).toFixed(2)}%, stop loss at -${(slDistance * 100).toFixed(2)}%`,
    }
  } else {
    // For SELL: TP below, SL above
    const tpDistance = (atr * atrMultiplier) / currentPrice
    const slDistance = (atr * atrStopMultiplier) / currentPrice

    return {
      entryPrice: currentPrice,
      takeProfitPct: Math.min(tpDistance, 0.05),
      stopLossPct: Math.min(slDistance, 0.02),
      exitStrategy: `Take profit at -${(tpDistance * 100).toFixed(2)}%, stop loss at +${(slDistance * 100).toFixed(2)}%`,
    }
  }
}

/**
 * Generate a technical analysis trade idea for a symbol
 */
export async function generateTechnicalTradeIdea(
  symbol: string,
  fastPeriod: number = 20,
  slowPeriod: number = 50,
  minScore: number = 0.6,
): Promise<TechnicalTradeIdea | null> {
  try {
    const candles = await fetchKlines(symbol, '1h', 200)
    if (candles.length < slowPeriod) {
      return null
    }

    const result = computeMaCrossover(candles, fastPeriod, slowPeriod)
    if (!result || result.score < minScore) {
      return null
    }

    const { entryPrice, takeProfitPct, stopLossPct, exitStrategy } =
      calculateTPSL(result.currentPrice, result.side, result.atr)

    const volatility = result.atr / result.currentPrice

    return {
      symbol,
      side: result.side,
      score: result.score,
      reason: result.reason,
      entryPrice,
      takeProfitPct,
      stopLossPct,
      exitStrategy,
      metadata: {
        fastPeriod,
        slowPeriod,
        fastSma: result.fastSma,
        slowSma: result.slowSma,
        currentPrice: result.currentPrice,
        atr: result.atr,
        volatility,
      },
    }
  } catch (err) {
    console.error(`Failed to generate technical idea for ${symbol}:`, err)
    return null
  }
}

/**
 * Get top cryptocurrencies by 24h volume from Binance
 */
export async function getTopCryptosByVolume(
  count: number = 15,
): Promise<string[]> {
  try {
    const resp = await axios.get(
      'https://api.binance.com/api/v3/ticker/24hr',
      { timeout: 10000 },
    )

    const tickers = resp.data as any[]
    const usdtPairs = tickers
      .filter((t: any) => t.symbol?.endsWith('USDT'))
      .map((t: any) => ({
        symbol: t.symbol as string,
        quoteVolume: Number(t.quoteVolume || 0),
      }))
      .filter((t) => isFinite(t.quoteVolume) && t.quoteVolume > 0)
      .sort((a, b) => b.quoteVolume - a.quoteVolume)
      .slice(0, count)
      .map((t) => t.symbol)

    return usdtPairs
  } catch (err) {
    console.error('Failed to fetch top cryptos:', err)
    // Fallback to top 15 known symbols
    return [
      'BTCUSDT',
      'ETHUSDT',
      'BNBUSDT',
      'SOLUSDT',
      'XRPUSDT',
      'DOGEUSDT',
      'ADAUSDT',
      'TRXUSDT',
      'AVAXUSDT',
      'LINKUSDT',
      'DOTUSDT',
      'MATICUSDT',
      'LTCUSDT',
      'UNIUSDT',
      'ATOMUSDT',
    ]
  }
}

