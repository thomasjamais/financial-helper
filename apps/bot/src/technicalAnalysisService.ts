import { SMA, RSI, MACD, BollingerBands } from 'technicalindicators'
import axios from 'axios'

interface Candle {
  openTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface IndicatorResult {
  name: string
  side: 'BUY' | 'SELL'
  score: number
  reason: string
  validated: boolean
  details?: Record<string, any>
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
  validatedIndicators: IndicatorResult[]
  metadata: {
    currentPrice: number
    atr?: number
    volatility?: number
    indicators: IndicatorResult[]
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
 * Analyzes MA Crossover indicator
 */
function analyzeMaCrossover(
  candles: Candle[],
  fastPeriod: number = 20,
  slowPeriod: number = 50,
  minScore: number = 0.6,
): IndicatorResult | null {
  if (candles.length < slowPeriod) return null

  const closes = candles.map((c) => c.close)
  const fastSma = SMA.calculate({ period: fastPeriod, values: closes })
  const slowSma = SMA.calculate({ period: slowPeriod, values: closes })

  const fastLatest = fastSma[fastSma.length - 1]
  const slowLatest = slowSma[slowSma.length - 1]

  if (fastLatest === undefined || slowLatest === undefined) return null

  const diff = fastLatest - slowLatest
  const side: 'BUY' | 'SELL' = diff >= 0 ? 'BUY' : 'SELL'

  // Normalize score: 0-1 based on percentage difference
  const percentageDiff = Math.abs(diff) / slowLatest
  const score = Math.min(1, percentageDiff * 2) // Multiply by 2 to scale better

  const reason = `MA${fastPeriod}-${slowPeriod} crossover: fast=${fastLatest.toFixed(
    2,
  )}, slow=${slowLatest.toFixed(2)}, diff=${(percentageDiff * 100).toFixed(2)}%`

  return {
    name: 'MA_Crossover',
    side,
    score,
    reason,
    validated: score >= minScore,
    details: {
      fastPeriod,
      slowPeriod,
      fastSma: fastLatest,
      slowSma: slowLatest,
    },
  }
}

/**
 * Analyzes RSI indicator
 */
function analyzeRSI(
  candles: Candle[],
  period: number = 14,
  minScore: number = 0.6,
): IndicatorResult | null {
  if (candles.length < period + 1) return null

  const closes = candles.map((c) => c.close)
  const rsiValues = RSI.calculate({ values: closes, period })

  if (rsiValues.length === 0) return null

  const rsi = rsiValues[rsiValues.length - 1]
  if (rsi === undefined || !isFinite(rsi)) return null

  let side: 'BUY' | 'SELL'
  let score: number
  let reason: string

  // RSI > 70: overbought (SELL signal)
  // RSI < 30: oversold (BUY signal)
  if (rsi >= 70) {
    side = 'SELL'
    score = Math.min(1, (rsi - 70) / 30) // Normalize: 70-100 -> 0-1
    reason = `RSI overbought: ${rsi.toFixed(2)} (SELL signal)`
  } else if (rsi <= 30) {
    side = 'BUY'
    score = Math.min(1, (30 - rsi) / 30) // Normalize: 0-30 -> 1-0
    reason = `RSI oversold: ${rsi.toFixed(2)} (BUY signal)`
  } else {
    // Neutral zone, calculate score based on distance from center (50)
    const distanceFromCenter = Math.abs(rsi - 50)
    score = Math.min(1, distanceFromCenter / 50) // Normalize to 0-1
    side = rsi > 50 ? 'SELL' : 'BUY'
    reason = `RSI neutral: ${rsi.toFixed(2)}`
  }

  return {
    name: 'RSI',
    side,
    score,
    reason,
    validated: score >= minScore,
    details: {
      period,
      rsi,
    },
  }
}

/**
 * Analyzes MACD indicator
 */
function analyzeMACD(
  candles: Candle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9,
  minScore: number = 0.6,
): IndicatorResult | null {
  if (candles.length < slowPeriod + signalPeriod) return null

  const closes = candles.map((c) => c.close)
  const macdInput = {
    values: closes,
    fastPeriod,
    slowPeriod,
    signalPeriod,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  }

  const macdResults = MACD.calculate(macdInput)

  if (macdResults.length === 0) return null

  const latest = macdResults[macdResults.length - 1]
  if (!latest || latest.MACD === undefined || latest.signal === undefined) {
    return null
  }

  const macd = latest.MACD
  const signal = latest.signal
  const histogram = macd - signal

  // BUY: MACD crosses above signal (histogram positive and increasing)
  // SELL: MACD crosses below signal (histogram negative and decreasing)
  const side: 'BUY' | 'SELL' = histogram >= 0 ? 'BUY' : 'SELL'

  // Score based on histogram strength
  const histogramAbs = Math.abs(histogram)
  const avgPrice = closes.slice(-20).reduce((a, b) => a + b, 0) / 20
  const normalizedHistogram = histogramAbs / avgPrice
  const score = Math.min(1, normalizedHistogram * 100) // Scale to 0-1

  const reason = `MACD: ${macd.toFixed(4)}, Signal: ${signal.toFixed(4)}, Histogram: ${histogram.toFixed(4)}`

  return {
    name: 'MACD',
    side,
    score,
    reason,
    validated: score >= minScore,
    details: {
      fastPeriod,
      slowPeriod,
      signalPeriod,
      macd,
      signal,
      histogram,
    },
  }
}

/**
 * Analyzes Bollinger Bands indicator
 */
function analyzeBollingerBands(
  candles: Candle[],
  period: number = 20,
  stdDev: number = 2,
  minScore: number = 0.6,
): IndicatorResult | null {
  if (candles.length < period) return null

  const closes = candles.map((c) => c.close)
  const bbInput = {
    values: closes,
    period,
    stdDev,
  }

  const bbResults = BollingerBands.calculate(bbInput)

  if (bbResults.length === 0) return null

  const latest = bbResults[bbResults.length - 1]
  const currentPrice = closes[closes.length - 1]

  if (
    !latest ||
    latest.upper === undefined ||
    latest.middle === undefined ||
    latest.lower === undefined
  ) {
    return null
  }

  // Price near upper band: overbought (SELL signal)
  // Price near lower band: oversold (BUY signal)
  const upperDistance = (currentPrice - latest.upper) / latest.upper
  const lowerDistance = (latest.lower - currentPrice) / latest.lower
  const middleDistance = Math.abs(currentPrice - latest.middle) / latest.middle

  let side: 'BUY' | 'SELL'
  let score: number
  let reason: string

  if (currentPrice >= latest.upper) {
    // Price above upper band
    side = 'SELL'
    score = Math.min(1, Math.abs(upperDistance) * 50) // Scale based on distance
    reason = `Price above upper BB: ${currentPrice.toFixed(2)} > ${latest.upper.toFixed(2)}`
  } else if (currentPrice <= latest.lower) {
    // Price below lower band
    side = 'BUY'
    score = Math.min(1, Math.abs(lowerDistance) * 50)
    reason = `Price below lower BB: ${currentPrice.toFixed(2)} < ${latest.lower.toFixed(2)}`
  } else {
    // Price in middle zone
    side = currentPrice > latest.middle ? 'SELL' : 'BUY'
    score = Math.min(1, middleDistance * 20) // Lower score for middle zone
    reason = `Price in BB middle zone: ${currentPrice.toFixed(2)}`
  }

  return {
    name: 'Bollinger_Bands',
    side,
    score,
    reason,
    validated: score >= minScore,
    details: {
      period,
      stdDev,
      upper: latest.upper,
      middle: latest.middle,
      lower: latest.lower,
      currentPrice,
    },
  }
}

/**
 * Analyzes all technical indicators for a symbol
 */
export async function analyzeAllIndicators(
  symbol: string,
  minScore: number = 0.6,
): Promise<{
  indicators: IndicatorResult[]
  validatedIndicators: IndicatorResult[]
  currentPrice: number
  atr: number
}> {
  const candles = await fetchKlines(symbol, '1h', 200)
  const currentPrice = candles[candles.length - 1].close
  const atr = calculateATR(candles)

  const indicators: IndicatorResult[] = []

  // Analyze MA Crossover
  const maResult = analyzeMaCrossover(candles, 20, 50, minScore)
  if (maResult) indicators.push(maResult)

  // Analyze RSI
  const rsiResult = analyzeRSI(candles, 14, minScore)
  if (rsiResult) indicators.push(rsiResult)

  // Analyze MACD
  const macdResult = analyzeMACD(candles, 12, 26, 9, minScore)
  if (macdResult) indicators.push(macdResult)

  // Analyze Bollinger Bands
  const bbResult = analyzeBollingerBands(candles, 20, 2, minScore)
  if (bbResult) indicators.push(bbResult)

  const validatedIndicators = indicators.filter((ind) => ind.validated)

  return {
    indicators,
    validatedIndicators,
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
 * Determines overall side based on validated indicators
 */
function determineOverallSide(
  validatedIndicators: IndicatorResult[],
): 'BUY' | 'SELL' | null {
  if (validatedIndicators.length === 0) return null

  const buyCount = validatedIndicators.filter(
    (ind) => ind.side === 'BUY',
  ).length
  const sellCount = validatedIndicators.filter(
    (ind) => ind.side === 'SELL',
  ).length

  // Weighted by score
  const buyScore = validatedIndicators
    .filter((ind) => ind.side === 'BUY')
    .reduce((sum, ind) => sum + ind.score, 0)
  const sellScore = validatedIndicators
    .filter((ind) => ind.side === 'SELL')
    .reduce((sum, ind) => sum + ind.score, 0)

  return buyScore > sellScore ? 'BUY' : 'SELL'
}

/**
 * Generates a technical analysis trade idea for a symbol using multiple indicators
 */
export async function generateTechnicalTradeIdea(
  symbol: string,
  minScore: number = 0.6,
): Promise<TechnicalTradeIdea | null> {
  try {
    const { indicators, validatedIndicators, currentPrice, atr } =
      await analyzeAllIndicators(symbol, minScore)

    // Only create trade idea if at least one indicator is validated
    if (validatedIndicators.length === 0) {
      return null
    }

    const overallSide = determineOverallSide(validatedIndicators)
    if (!overallSide) {
      return null
    }

    // Calculate overall score as average of validated indicators
    const overallScore =
      validatedIndicators.reduce((sum, ind) => sum + ind.score, 0) /
      validatedIndicators.length

    // Create reason from validated indicators
    const reasons = validatedIndicators.map(
      (ind) => `${ind.name}: ${ind.reason}`,
    )
    const reason = `Validated indicators (${validatedIndicators.length}/${indicators.length}): ${reasons.join('; ')}`

    const { entryPrice, takeProfitPct, stopLossPct, exitStrategy } =
      calculateTPSL(currentPrice, overallSide, atr)

    const volatility = atr / currentPrice

    return {
      symbol,
      side: overallSide,
      score: overallScore,
      reason,
      entryPrice,
      takeProfitPct,
      stopLossPct,
      exitStrategy,
      validatedIndicators,
      metadata: {
        currentPrice,
        atr,
        volatility,
        indicators,
      },
    }
  } catch (err) {
    console.error(`Failed to generate technical idea for ${symbol}:`, err)
    return null
  }
}

/**
 * Get 15 cryptocurrencies with rotation from Binance
 * This includes all trading pairs on Binance, rotates which ones are selected
 */
export async function getTopCryptosByVolume(
  count: number = 50,
): Promise<string[]> {
  try {
    const resp = await axios.get('https://api.binance.com/api/v3/ticker/24hr', {
      timeout: 10000,
    })

    const tickers = resp.data as any[]
    // Filter for all valid trading pairs (including USDT, USDC, BTC, ETH, BNB as quote)
    const supportedQuotes = [
      'USDT',
      'USDC',
      'BTC',
      'ETH',
      'BNB',
      'FDUSD',
      'TUSD',
    ]
    const validPairs = tickers
      .filter((t: any) => {
        if (!t.symbol || typeof t.symbol !== 'string') return false
        // Check if symbol ends with any supported quote asset
        return supportedQuotes.some((quote) => t.symbol.endsWith(quote))
      })
      .map((t: any) => ({
        symbol: t.symbol as string,
        quoteVolume: Number(t.quoteVolume || 0),
      }))
      .filter((t) => isFinite(t.quoteVolume) && t.quoteVolume > 0)
      .sort((a, b) => b.quoteVolume - a.quoteVolume)

    // Rotate selection based on current time (every 5 seconds, we'll have a different offset)
    // Calculate offset based on seconds since epoch, rotating every interval
    const rotationInterval = 5 // seconds
    const currentSecond = Math.floor(Date.now() / 1000)
    const rotationIndex = Math.floor(currentSecond / rotationInterval)

    // Use rotationIndex to determine which 15 cryptos to analyze
    // This ensures we rotate through different cryptos over time
    const poolSize = validPairs.length
    const offset = (rotationIndex * count) % poolSize
    const end = offset + count

    let selected: typeof validPairs
    if (end <= poolSize) {
      selected = validPairs.slice(offset, end)
    } else {
      // Wrap around if we exceed the pool
      selected = [
        ...validPairs.slice(offset, poolSize),
        ...validPairs.slice(0, end - poolSize),
      ]
    }

    return selected.map((t) => t.symbol)
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
