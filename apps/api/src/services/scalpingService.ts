import axios from 'axios'
import type { Logger } from '../logger'
import {
  analyzeScalping,
  type CandleData,
  type ScalpingAnalysis,
} from '@pkg/scalping-engine'

type Candle = {
  openTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/**
 * Fetches klines from Bitget public API
 */
async function fetchBitgetKlines(
  symbol: string,
  interval: string,
  limit: number = 200,
): Promise<Candle[]> {
  const intervalMap: Record<string, string> = {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '1h': '1H',
    '4h': '4H',
    '1d': '1D',
  }

  const bitgetInterval = intervalMap[interval] || interval

  try {
    const response = await axios.get(
      `https://api.bitget.com/api/mix/v1/market/candles`,
      {
        params: {
          symbol,
          productType: 'USDT-FUTURES',
          granularity: bitgetInterval,
          limit,
        },
        timeout: 10000,
      },
    )

    if (!response.data || response.data.code !== '00000') {
      throw new Error(
        `Bitget API error: ${response.data?.msg || 'Unknown error'}`,
      )
    }

    const data = response.data.data || []
    return data.map((k: any[]) => ({
      openTime: Number(k[0]),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    }))
  } catch (err) {
    throw new Error(
      `Failed to fetch Bitget klines: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

export class ScalpingService {
  constructor(private logger: Logger) {}

  async analyzeSymbol(symbol: string): Promise<ScalpingAnalysis> {
    const log = this.logger.child({ symbol, service: 'ScalpingService' })

    try {
      log.info('Fetching candle data for all timeframes')

      const [candles1m, candles5m, candles15m, candles1h, candles4h, candles1d] =
        await Promise.all([
          fetchBitgetKlines(symbol, '1m', 200),
          fetchBitgetKlines(symbol, '5m', 200),
          fetchBitgetKlines(symbol, '15m', 200),
          fetchBitgetKlines(symbol, '1h', 200),
          fetchBitgetKlines(symbol, '4h', 200),
          fetchBitgetKlines(symbol, '1d', 200),
        ])

      const candleData: CandleData = {
        '1m': candles1m,
        '5m': candles5m,
        '15m': candles15m,
        '1h': candles1h,
        '4h': candles4h,
        '1d': candles1d,
      }

      log.info('Analyzing scalping opportunities')

      const analysis = analyzeScalping(symbol, candleData)

      log.info('Scalping analysis completed', {
        hasEntry: !!analysis.recommendedEntry,
        hasStopLoss: !!analysis.stopLoss,
        takeProfitsCount: analysis.takeProfits.length,
      })

      return analysis
    } catch (err) {
      log.error(
        {
          err: {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
        },
        'Failed to analyze symbol',
      )
      throw err
    }
  }
}

