/*
 * Example technical signal generator for financial-helper
 *
 * This module demonstrates how you can compute simple trading signals
 * from Binance price data using moving average crossovers.  It fetches
 * recent OHLCV data for a given symbol, calculates fast and slow moving
 * averages using the `technicalindicators` package and emits a trade
 * idea with a side (BUY or SELL), score and reason.  You can wire this
 * logic into your existing `/v1/trade-ideas/refresh` route or create a
 * separate endpoint that populates the `trade_ideas` table.
 *
 * The code assumes that you have installed the `technicalindicators`
 * package (`npm install technicalindicators`) and that you have a
 * Binance HTTP client similar to the one in your project.  Adjust the
 * imports as necessary.  The `score` is normalised to the absolute
 * difference between the two moving averages.  You can experiment
 * with different periods, indicators (RSI, MACD, Bollinger Bands),
 * or even plug in machine learning models to this service.
 */

import { SMA } from 'technicalindicators'
import type { BinanceHttpClient } from '@pkg/exchange-adapters'

interface Candle {
  openTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface TradeIdea {
  symbol: string
  side: 'BUY' | 'SELL'
  score: number
  reason: string
  metadata?: Record<string, any>
}

/**
 * Fetches recent klines from Binance and returns them as numeric candles.
 *
 * @param client Binance HTTP client from your project
 * @param symbol Symbol to fetch (e.g. 'BTCUSDT')
 * @param interval Kline interval (e.g. '1h', '4h', '1d')
 * @param limit Number of candles to fetch
 */
async function fetchKlines(
  client: BinanceHttpClient,
  symbol: string,
  interval: string = '1h',
  limit: number = 200,
): Promise<Candle[]> {
  const resp = await client.fetch(
    `/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
  )
  const data = (await resp.json()) as any[]
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
 * Compute a trade idea based on moving average crossover.  If the
 * fast SMA is above the slow SMA for the latest candle, we emit a
 * BUY; if it is below, we emit a SELL.  The score reflects the
 * normalised difference between the two averages.
 *
 * @param candles Array of OHLC candles ordered oldest to newest
 * @param fastPeriod Fast SMA period (e.g. 20)
 * @param slowPeriod Slow SMA period (e.g. 50)
 */
function computeMaCrossover(
  candles: Candle[],
  fastPeriod: number = 20,
  slowPeriod: number = 50,
): { side: 'BUY' | 'SELL'; score: number; reason: string } | null {
  if (candles.length < slowPeriod) return null
  const closes = candles.map((c) => c.close)
  const fastSma = SMA.calculate({ period: fastPeriod, values: closes })
  const slowSma = SMA.calculate({ period: slowPeriod, values: closes })
  // Align lengths: SMAs arrays are shorter than closes
  const idxOffset = slowPeriod - 1
  const fastLatest = fastSma[fastSma.length - 1]
  const slowLatest = slowSma[slowSma.length - 1]
  if (fastLatest === undefined || slowLatest === undefined) return null
  const diff = fastLatest - slowLatest
  const side: 'BUY' | 'SELL' = diff >= 0 ? 'BUY' : 'SELL'
  const score = Math.min(1, Math.abs(diff) / slowLatest) // normalised difference
  const reason = `MA${fastPeriod}-${slowPeriod} crossover: fast=${fastLatest.toFixed(
    2,
  )}, slow=${slowLatest.toFixed(2)}`
  return { side, score, reason }
}

/**
 * Generate a trade idea for a symbol using MA crossover on Binance klines.
 *
 * @param client Binance HTTP client
 * @param symbol Trading pair symbol (e.g. 'ETHUSDT')
 * @returns Trade idea or null if no signal
 */
export async function generateMaCrossoverIdea(
  client: BinanceHttpClient,
  symbol: string,
): Promise<TradeIdea | null> {
  try {
    const candles = await fetchKlines(client, symbol, '1h', 200)
    const result = computeMaCrossover(candles)
    if (!result) return null
    return {
      symbol,
      side: result.side,
      score: result.score,
      reason: result.reason,
      metadata: {
        fastPeriod: 20,
        slowPeriod: 50,
      },
    }
  } catch (err) {
    console.error(`Failed to generate MA crossover idea for ${symbol}:`, err)
    return null
  }
}

// Example usage:
// const idea = await generateMaCrossoverIdea(binanceClient, 'BTCUSDT')
// if (idea) {
//   // Insert into trade_ideas table using your existing DB logic
//   console.log(idea)
// }