import axios from 'axios'
import type { Logger } from '../logger'
import {
  runScalpingBacktest,
  type ScalpingBacktestConfig,
  type ScalpingBacktestParams,
  type ScalpingBacktestResult,
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
 * Fetches historical klines from Bitget public API
 */
async function fetchBitgetHistoricalKlines(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number,
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
  const allCandles: Candle[] = []
  let currentStartTime = startTime
  const limit = 200

  try {
    while (currentStartTime < endTime) {
      const response = await axios.get(
        `https://api.bitget.com/api/mix/v1/market/candles`,
        {
          params: {
            symbol,
            productType: 'USDT-FUTURES',
            granularity: bitgetInterval,
            startTime: currentStartTime.toString(),
            endTime: endTime.toString(),
            limit,
          },
          timeout: 30000,
        },
      )

      if (!response.data || response.data.code !== '00000') {
        throw new Error(
          `Bitget API error: ${response.data?.msg || 'Unknown error'}`,
        )
      }

      const data = response.data.data || []
      if (data.length === 0) {
        break
      }

      const candles = data.map((k: any[]) => ({
        openTime: Number(k[0]),
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
        volume: Number(k[5]),
      }))

      allCandles.push(...candles)

      const lastCandleTime = candles[candles.length - 1]?.openTime
      if (!lastCandleTime || lastCandleTime >= endTime) {
        break
      }

      currentStartTime = lastCandleTime + 1

      if (data.length < limit) {
        break
      }
    }

    return allCandles.sort((a, b) => a.openTime - b.openTime)
  } catch (err) {
    throw new Error(
      `Failed to fetch Bitget historical klines: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

export class ScalpingBacktestService {
  constructor(private logger: Logger) {}

  async runBacktest(
    symbol: string,
    period: '30d' | '90d' | '180d' | '1y',
    config: ScalpingBacktestConfig,
    minConfidence: number = 0.6,
    maxOpenPositions: number = 3,
  ): Promise<ScalpingBacktestResult> {
    const log = this.logger.child({
      symbol,
      period,
      service: 'ScalpingBacktestService',
    })

    try {
      log.info('Starting scalping backtest', {
        symbol,
        period,
        initialCapital: config.initialCapital,
        leverage: config.leverage,
      })

      const params: ScalpingBacktestParams = {
        symbol,
        period,
        config,
        minConfidence,
        maxOpenPositions,
      }

      const result = await runScalpingBacktest(
        params,
        fetchBitgetHistoricalKlines,
      )

      log.info('Scalping backtest completed', {
        symbol,
        period,
        totalTrades: result.totalTrades,
        totalReturnPct: result.totalReturnPct.toFixed(2),
        winRate: result.winRate.toFixed(2),
      })

      return result
    } catch (err) {
      log.error(
        {
          err: {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
        },
        'Failed to run scalping backtest',
      )
      throw err
    }
  }

  async runMultiplePeriods(
    symbol: string,
    config: ScalpingBacktestConfig,
    minConfidence: number = 0.6,
    maxOpenPositions: number = 3,
  ): Promise<{
    '30d': ScalpingBacktestResult
    '90d': ScalpingBacktestResult
    '180d': ScalpingBacktestResult
    '1y': ScalpingBacktestResult
  }> {
    const periods: Array<'30d' | '90d' | '180d' | '1y'> = [
      '30d',
      '90d',
      '180d',
      '1y',
    ]

    const results = await Promise.all(
      periods.map((period) =>
        this.runBacktest(
          symbol,
          period,
          config,
          minConfidence,
          maxOpenPositions,
        ),
      ),
    )

    return {
      '30d': results[0],
      '90d': results[1],
      '180d': results[2],
      '1y': results[3],
    }
  }
}
