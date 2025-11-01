import axios from 'axios'
import type { TechnicalTradeIdea } from '../technicalAnalysisService'
import type { AuthService } from './AuthService'

export class TradeIdeaApiClient {
  constructor(
    private apiBase: string,
    private authService: AuthService,
  ) {}

  async postTradeIdea(idea: TechnicalTradeIdea): Promise<boolean> {
    try {
      await this.authService.ensureAuth()
      const accessToken = this.authService.getAccessToken()

      const response = await axios.post(
        `${this.apiBase}/v1/trade-ideas`,
        {
          exchange: 'binance',
          symbol: idea.symbol,
          side: idea.side,
          score: idea.score,
          reason: idea.reason,
          metadata: {
            ...idea.metadata,
            entryPrice: idea.entryPrice,
            takeProfitPct: idea.takeProfitPct,
            stopLossPct: idea.stopLossPct,
            exitStrategy: idea.exitStrategy,
            validatedIndicators: idea.validatedIndicators.map((ind) => ({
              name: ind.name,
              side: ind.side,
              score: ind.score,
              reason: ind.reason,
              details: ind.details,
            })),
            source: 'technical_analysis',
          },
        },
        {
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
        },
      )
      console.log(
        `✓ Trade idea posted successfully for ${idea.symbol}:`,
        response.data,
      )
      return true
    } catch (err) {
      if (axios.isAxiosError(err)) {
        console.error(
          `✗ Failed to post trade idea for ${idea.symbol}:`,
          `Status: ${err.response?.status}`,
          `Error: ${JSON.stringify(err.response?.data || err.message)}`,
        )
      } else {
        console.error(
          `✗ Failed to post trade idea for ${idea.symbol}:`,
          err instanceof Error ? err.message : String(err),
        )
      }
      // Don't throw, continue with other symbols
      return false
    }
  }
}

