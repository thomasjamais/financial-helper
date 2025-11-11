export type ListingEvent = {
  eventType: 'new_listing' | 'delisting'
  symbol: string
  title: string
  description: string | null
  announcementUrl: string | null
  metadata: Record<string, unknown>
}

export interface BinanceExchangeInfo {
  symbols: Array<{
    symbol: string
    status: string
    baseAsset: string
    quoteAsset: string
  }>
}

export class BinanceListingMonitor {
  constructor(private baseUrl: string = 'https://api.binance.com') {}

  async fetchCurrentSymbols(): Promise<Set<string>> {
    try {
      const url = `${this.baseUrl}/api/v3/exchangeInfo`
      const response = await fetch(url, { timeout: 10000 } as any)

      if (!response.ok) {
        throw new Error(`Failed to fetch exchange info: ${response.status}`)
      }

      const data = (await response.json()) as BinanceExchangeInfo

      if (!data || !Array.isArray(data.symbols)) {
        throw new Error('Invalid exchange info response')
      }

      const symbols = new Set<string>()
      for (const symbolInfo of data.symbols) {
        if (symbolInfo.status === 'TRADING') {
          symbols.add(symbolInfo.symbol)
        }
      }

      return symbols
    } catch (error) {
      throw new Error(
        `Failed to fetch current symbols: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  detectChanges(
    currentSymbols: Set<string>,
    previousSymbols: Set<string>,
  ): ListingEvent[] {
    const events: ListingEvent[] = []

    for (const symbol of currentSymbols) {
      if (!previousSymbols.has(symbol)) {
        events.push({
          eventType: 'new_listing',
          symbol,
          title: `New Listing: ${symbol}`,
          description: `${symbol} has been listed on Binance Spot`,
          announcementUrl: null,
          metadata: {
            detectedAt: new Date().toISOString(),
          },
        })
      }
    }

    for (const symbol of previousSymbols) {
      if (!currentSymbols.has(symbol)) {
        events.push({
          eventType: 'delisting',
          symbol,
          title: `Delisting: ${symbol}`,
          description: `${symbol} has been delisted from Binance Spot`,
          announcementUrl: null,
          metadata: {
            detectedAt: new Date().toISOString(),
          },
        })
      }
    }

    return events
  }
}

