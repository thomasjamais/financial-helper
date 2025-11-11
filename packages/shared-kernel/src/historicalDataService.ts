export type Candle = {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export type HistoricalDataOptions = {
  symbol: string
  interval: string
  startTime?: number
  endTime?: number
  limit?: number
}

export class HistoricalDataService {
  constructor(private baseUrl: string = 'https://api.binance.com') {}

  async fetchKlines(options: HistoricalDataOptions): Promise<Candle[]> {
    const { symbol, interval, startTime, endTime, limit = 1000 } = options

    const params = new URLSearchParams({
      symbol,
      interval,
      limit: String(limit),
    })

    if (startTime) {
      params.append('startTime', String(startTime))
    }

    if (endTime) {
      params.append('endTime', String(endTime))
    }

    const url = `${this.baseUrl}/api/v3/klines?${params.toString()}`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Failed to fetch klines: ${response.statusText}`)
      }

      const data = (await response.json()) as any[]

      return data.map((k) => ({
        timestamp: Number(k[0]),
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
        volume: Number(k[5]),
      }))
    } catch (error) {
      throw new Error(
        `Failed to fetch historical data for ${symbol}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  async fetchKlinesForPeriod(
    symbol: string,
    interval: string,
    months: number = 6,
  ): Promise<Candle[]> {
    const endTime = Date.now()
    const startTime = endTime - months * 30 * 24 * 60 * 60 * 1000

    const allCandles: Candle[] = []
    let currentStartTime = startTime
    const limit = 1000

    while (currentStartTime < endTime) {
      const batch = await this.fetchKlines({
        symbol,
        interval,
        startTime: currentStartTime,
        endTime,
        limit,
      })

      if (batch.length === 0) {
        break
      }

      allCandles.push(...batch)

      if (batch.length < limit) {
        break
      }

      const lastTimestamp = batch[batch.length - 1].timestamp
      currentStartTime = lastTimestamp + 1

      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    return allCandles.sort((a, b) => a.timestamp - b.timestamp)
  }

  async fetchKlinesForMultipleSymbols(
    symbols: string[],
    interval: string,
    months: number = 6,
  ): Promise<Map<string, Candle[]>> {
    const result = new Map<string, Candle[]>()

    for (const symbol of symbols) {
      try {
        const candles = await this.fetchKlinesForPeriod(symbol, interval, months)
        result.set(symbol, candles)
      } catch (error) {
        console.error(`Failed to fetch data for ${symbol}:`, error)
      }

      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    return result
  }
}

