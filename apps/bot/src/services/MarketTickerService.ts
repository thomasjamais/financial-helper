import axios from 'axios'
import type { AuthService } from './AuthService'
import type { TradeIdeaApiClient } from './TradeIdeaApiClient'

export class MarketTickerService {
  constructor(
    private apiBase: string,
    private authService: AuthService,
    private apiClient: TradeIdeaApiClient,
  ) {}

  async runMarketTickerAnalysis(): Promise<void> {
    try {
      await this.authService.ensureAuth()
      const accessToken = this.authService.getAccessToken()

      // Fetch market tickers and derive trade ideas (market-wide)
      const { data: tickers } = await axios.get(
        'https://api.binance.com/api/v3/ticker/24hr',
        { timeout: 10000 },
      )

      const symbols = (Array.isArray(tickers) ? tickers : []).filter((t: any) =>
        t.symbol?.endsWith('USDT'),
      )
      const sorted = symbols
        .map((t: any) => ({
          symbol: t.symbol as string,
          change: Number(t.priceChangePercent),
        }))
        .filter((t: any) => isFinite(t.change))
        .sort((a: any, b: any) => Math.abs(b.change) - Math.abs(a.change))

      for (const s of sorted) {
        const side = s.change >= 0 ? 'BUY' : 'SELL'
        const score = Math.min(1, Math.abs(s.change) / 25)

        if (score < 0.6) continue

        try {
          await axios.post(
            `${this.apiBase}/v1/trade-ideas`,
            {
              exchange: 'binance',
              symbol: s.symbol,
              side,
              score,
              reason: `24h change ${s.change.toFixed(2)}%`,
              metadata: { changePct: s.change, source: 'market_ticker' },
            },
            {
              headers: accessToken
                ? { Authorization: `Bearer ${accessToken}` }
                : undefined,
            },
          )
        } catch (err) {
          // Silent fail for individual symbols
          console.error(`Failed to post market ticker idea for ${s.symbol}:`, err)
        }
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        console.error(
          'Market ticker tick failed',
          err.response?.status,
          err.response?.data || err.message,
        )
      } else {
        console.error(
          'Market ticker tick failed',
          err instanceof Error ? err.message : String(err),
        )
      }
    }
  }
}

