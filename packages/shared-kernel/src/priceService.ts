export type PriceData = {
  asset: string
  priceUSD: number
  priceEUR: number
  timestamp: number
}

export interface PriceService {
  getPrices(assets: string[]): Promise<Map<string, PriceData>>
}

export class BinancePriceService implements PriceService {
  constructor(private baseUrl: string = 'https://api.binance.com') {}

  async getPrices(assets: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>()
    const usdtSymbols = assets
      .filter((asset) => asset !== 'USDT' && asset !== 'EUR')
      .map((asset) => `${asset}USDT`)

    const eurRate = await this.getEURRate()

    if (usdtSymbols.length === 0) {
      if (assets.includes('USDT')) {
        prices.set('USDT', {
          asset: 'USDT',
          priceUSD: 1,
          priceEUR: eurRate,
          timestamp: Date.now(),
        })
      }
      return prices
    }

    // Binance API: fetch prices one by one or use /api/v3/ticker/24hr for multiple
    // For simplicity and reliability, fetch individually with batching
    try {
      // Fetch in batches of 10 to avoid rate limits
      const batchSize = 10
      for (let i = 0; i < usdtSymbols.length; i += batchSize) {
        const batch = usdtSymbols.slice(i, i + batchSize)

        // Fetch each symbol individually (more reliable)
        const promises = batch.map(async (symbol) => {
          try {
            const url = `${this.baseUrl}/api/v3/ticker/price?symbol=${symbol}`
            const response = await fetch(url)
            if (!response.ok) {
              return null
            }
            const data = await response.json()
            return {
              symbol: data.symbol,
              price: parseFloat(data.price),
            }
          } catch {
            return null
          }
        })

        const results = await Promise.all(promises)

        for (const result of results) {
          if (result) {
            const asset = result.symbol.replace('USDT', '')
            const priceUSD = result.price
            prices.set(asset, {
              asset,
              priceUSD,
              priceEUR: priceUSD * eurRate,
              timestamp: Date.now(),
            })
          }
        }
      }

      if (assets.includes('USDT')) {
        prices.set('USDT', {
          asset: 'USDT',
          priceUSD: 1,
          priceEUR: eurRate,
          timestamp: Date.now(),
        })
      }
    } catch (err) {
      console.error('Failed to fetch prices from Binance:', err)
    }

    return prices
  }

  private async getEURRate(): Promise<number> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v3/ticker/price?symbol=EURUSDT`,
      )
      if (!response.ok) {
        return 0.85
      }
      const data = await response.json()
      return 1 / parseFloat(data.price)
    } catch {
      return 0.85
    }
  }
}
