import type { TechnicalTradeIdea } from '../technicalAnalysisService'
import {
  generateTechnicalTradeIdea,
  getTopCryptosByVolume,
} from '../technicalAnalysisService'
import type { AuthService } from './AuthService'
import type { TradeIdeaApiClient } from './TradeIdeaApiClient'

export class TechnicalAnalysisScheduler {
  constructor(
    private authService: AuthService,
    private apiClient: TradeIdeaApiClient,
    private symbolsCount: number,
    private minConfidenceScore: number,
  ) {}

  async runAnalysis(): Promise<{
    successful: number
    total: number
    results: Array<{
      symbol: string
      idea: TechnicalTradeIdea | null
      error?: string
    }>
  }> {
    try {
      await this.authService.ensureAuth()
      console.log('🔐 Authentication successful')

      // Get top cryptos to analyze (among all Binance cryptos)
      const symbols = await getTopCryptosByVolume(this.symbolsCount)

      console.log(`🔍 Running technical analysis on ${symbols.length} symbols...`)

      const results: Array<{
        symbol: string
        idea: TechnicalTradeIdea | null
        error?: string
      }> = []

      // Analyze each symbol
      for (const symbol of symbols) {
        try {
          const idea = await generateTechnicalTradeIdea(
            symbol,
            this.minConfidenceScore,
          )

          if (idea && idea.validatedIndicators.length > 0) {
            const indicatorsList = idea.validatedIndicators
              .map((ind) => ind.name)
              .join(', ')
            console.log(
              `📊 ${symbol}: ${idea.side} signal (score: ${(idea.score * 100).toFixed(1)}%, indicators: ${indicatorsList}, TP: ${(idea.takeProfitPct * 100).toFixed(2)}%, SL: ${(idea.stopLossPct * 100).toFixed(2)}%)`,
            )

            const posted = await this.apiClient.postTradeIdea(idea)
            if (posted) {
              results.push({ symbol, idea })
              console.log(`✅ ${symbol}: Trade idea saved successfully`)
            } else {
              results.push({ symbol, idea: null, error: 'Failed to post' })
            }
          } else {
            results.push({ symbol, idea: null })
          }
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err)
          results.push({ symbol, idea: null, error })
          console.error(`✗ ${symbol}: ${error}`)
        }
      }

      const successful = results.filter((r) => r.idea !== null).length
      console.log(
        `Technical analysis complete: ${successful}/${symbols.length} signals generated`,
      )

      return {
        successful,
        total: symbols.length,
        results,
      }
    } catch (err) {
      console.error('Technical analysis tick failed:', err)
      throw err
    }
  }
}

