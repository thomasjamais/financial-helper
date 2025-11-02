import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { TradeIdeasService } from './TradeIdeasService'
import { TradesService } from './TradesService'
import { BinanceService } from './BinanceService'
import {
  getSymbolPrice,
  getTradingPairPrice,
  isUSDQuoted,
  extractQuoteAsset,
} from '@pkg/shared-kernel'

export class AutoTradeService {
  constructor(
    private db: Kysely<DB>,
    private logger: Logger,
    private encKey: string,
  ) {}

  /**
   * Automatically places real trades for trade ideas with at least 6 validated indicators
   * Uses available USDT spot balance for position sizing
   */
  async autoPlaceTrades(userId: string): Promise<{
    checked: number
    placed: number
    errors: number
    results: Array<{
      ideaId: number
      symbol: string
      success: boolean
      error?: string
      tradeId?: number
      orderId?: string
    }>
  }> {
    const log = this.logger.child({ userId, operation: 'autoPlaceTrades' })
    const tradeIdeasService = new TradeIdeasService(this.db, this.logger)
    const tradesService = new TradesService(this.db, this.logger)
    const binanceService = new BinanceService(this.db, this.logger, this.encKey)

    try {
      // Get all trade ideas for the user
      const ideas = await tradeIdeasService.list(userId, {
        sortBy: 'created_at',
        sortOrder: 'desc',
        limit: 100,
      })

      log.info({ totalIdeas: ideas.length }, 'Checking trade ideas for auto-trade')

      // Filter ideas with at least 6 validated indicators
      const eligibleIdeas = ideas.filter((idea) => {
        const metadata = idea.metadata || {}
        const validatedIndicators = metadata.validatedIndicators || []
        return validatedIndicators.length >= 6
      })

      log.info(
        { eligibleIdeas: eligibleIdeas.length },
        'Found eligible trade ideas with >= 6 indicators',
      )

      // Get available USDT balance
      let availableUSDT: number
      try {
        availableUSDT = await binanceService.getUSDTBalance()
        log.info({ availableUSDT }, 'Available USDT balance')
      } catch (err) {
        log.error({ err }, 'Failed to get USDT balance')
        throw new Error('Failed to get USDT balance for auto-trading')
      }

      if (availableUSDT < 10) {
        log.warn({ availableUSDT }, 'Insufficient USDT for auto-trading')
        return {
          checked: ideas.length,
          placed: 0,
          errors: 0,
          results: [],
        }
      }

      // Process each eligible idea
      const results: Array<{
        ideaId: number
        symbol: string
        success: boolean
        error?: string
        tradeId?: number
        orderId?: string
      }> = []

      let placed = 0
      let errors = 0

      for (const idea of eligibleIdeas) {
        try {
          // Check if we already have an active trade for this symbol
          const existingTrades = await tradesService.list(userId, 100)
          const hasActiveTrade = existingTrades.some(
            (t) =>
              t.symbol === idea.symbol &&
              t.status !== 'closed' &&
              t.status !== 'simulated',
          )

          if (hasActiveTrade) {
            log.debug(
              { symbol: idea.symbol },
              'Skipping: active trade already exists for this symbol',
            )
            results.push({
              ideaId: idea.id,
              symbol: idea.symbol,
              success: false,
              error: 'Active trade already exists',
            })
            continue
          }

          // Get entry price and TP/SL from metadata
          const metadata = idea.metadata || {}
          const entryPriceFromMetadata =
            typeof metadata.entryPrice === 'number' && metadata.entryPrice > 0
              ? metadata.entryPrice
              : null
          const tpPctFromMetadata =
            typeof metadata.takeProfitPct === 'number' &&
            metadata.takeProfitPct > 0
              ? metadata.takeProfitPct
              : null
          const slPctFromMetadata =
            typeof metadata.stopLossPct === 'number' &&
            metadata.stopLossPct > 0
              ? metadata.stopLossPct
              : null

          // Get entry price
          let entryPrice: number
          if (entryPriceFromMetadata) {
            entryPrice = entryPriceFromMetadata
            if (!isUSDQuoted(idea.symbol)) {
              const pairPrice = await getTradingPairPrice(idea.symbol)
              if (!pairPrice || !isFinite(pairPrice) || pairPrice <= 0) {
                throw new Error('Failed to fetch pair price')
              }
              entryPrice = pairPrice
            }
          } else {
            if (isUSDQuoted(idea.symbol)) {
              const price = await getSymbolPrice(idea.symbol)
              if (!price || !isFinite(price) || price <= 0) {
                throw new Error('Failed to fetch price')
              }
              entryPrice = price
            } else {
              const pairPrice = await getTradingPairPrice(idea.symbol)
              if (!pairPrice || !isFinite(pairPrice) || pairPrice <= 0) {
                throw new Error('Failed to fetch pair price')
              }
              entryPrice = pairPrice
            }
          }

          // Use available USDT for budget (or a percentage of it)
          const budget = availableUSDT * 0.1 // Use 10% of available USDT per trade
          const tpPct = tpPctFromMetadata ?? 0.04
          const slPct = slPctFromMetadata ?? 0.02

          // Handle non-USD pairs
          let conversionTradeId: number | null = null
          let quoteAssetBudget: number | null = null

          if (!isUSDQuoted(idea.symbol)) {
            const quoteAsset = extractQuoteAsset(idea.symbol)
            if (!quoteAsset) {
              throw new Error(`Unable to determine quote asset for ${idea.symbol}`)
            }

            let conversionSymbol = `${quoteAsset}USDC`
            let conversionPairPrice = await getTradingPairPrice(conversionSymbol)

            if (
              !conversionPairPrice ||
              !isFinite(conversionPairPrice) ||
              conversionPairPrice <= 0
            ) {
              conversionSymbol = `${quoteAsset}USDT`
              conversionPairPrice = await getTradingPairPrice(conversionSymbol)

              if (
                !conversionPairPrice ||
                !isFinite(conversionPairPrice) ||
                conversionPairPrice <= 0
              ) {
                throw new Error(
                  `Failed to fetch conversion pair price for ${quoteAsset}`,
                )
              }
            }

            // Create conversion trade
            const conversionTrade = await tradesService.create(
              userId,
              {
                ideaId: null,
                exchange: idea.exchange,
                symbol: conversionSymbol,
                side: 'BUY',
                budgetUSD: budget,
                entryPrice: conversionPairPrice,
                tpPct: 0,
                slPct: 0,
                risk: 'conversion',
                realTrade: true,
              },
              `auto-trade-${Date.now()}`,
            )

            conversionTradeId = conversionTrade.id
            quoteAssetBudget = budget / conversionPairPrice

            // Place conversion order
            await binanceService.placeSpotOrder({
              symbol: conversionSymbol,
              side: 'BUY',
              type: 'MARKET',
              quantity: quoteAssetBudget,
            })
          }

          const quantityToUse = quoteAssetBudget ?? budget
          const calculatedQuantity = quantityToUse / entryPrice

          // Place real order
          log.info(
            {
              symbol: idea.symbol,
              side: idea.side,
              quantity: calculatedQuantity,
              entryPrice,
              budget,
            },
            'Placing auto-trade order',
          )

          const order = await binanceService.placeSpotOrder({
            symbol: idea.symbol,
            side: idea.side,
            type: 'MARKET',
            quantity: calculatedQuantity,
          })

          // Create trade record
          const trade = await tradesService.create(
            userId,
            {
              ideaId: idea.id,
              exchange: idea.exchange,
              symbol: idea.symbol,
              side: idea.side,
              budgetUSD: budget,
              entryPrice,
              quantity: order.qty,
              tpPct,
              slPct,
              risk: 'auto',
              conversionTradeId,
              realTrade: true,
              orderId: order.id,
            },
            `auto-trade-${Date.now()}`,
          )

          placed++
          results.push({
            ideaId: idea.id,
            symbol: idea.symbol,
            success: true,
            tradeId: trade.id,
            orderId: order.id,
          })

          log.info(
            {
              symbol: idea.symbol,
              tradeId: trade.id,
              orderId: order.id,
            },
            'Auto-trade placed successfully',
          )

          // Update available USDT for next iteration
          availableUSDT -= budget
        } catch (err) {
          errors++
          let errorMsg = err instanceof Error ? err.message : String(err)
          
          // Enhance error messages for common Binance API errors
          if (errorMsg.includes('-2010') || errorMsg.includes('Symbol not whitelisted')) {
            errorMsg = `Symbol ${idea.symbol} not whitelisted for API key`
          } else if (errorMsg.includes('-2011')) {
            errorMsg = `Unknown order: ${idea.symbol} may not be tradeable`
          } else if (errorMsg.includes('-1022')) {
            errorMsg = `Invalid API signature for ${idea.symbol}`
          } else if (errorMsg.includes('-2015')) {
            errorMsg = `Invalid API key or IP permissions for ${idea.symbol}`
          }
          
          log.error(
            { err, symbol: idea.symbol, ideaId: idea.id },
            'Failed to place auto-trade',
          )
          results.push({
            ideaId: idea.id,
            symbol: idea.symbol,
            success: false,
            error: errorMsg,
          })
        }
      }

      log.info(
        { checked: ideas.length, placed, errors },
        'Auto-trade placement complete',
      )

      return {
        checked: ideas.length,
        placed,
        errors,
        results,
      }
    } catch (err) {
      log.error({ err }, 'Failed to execute auto-trade placement')
      throw err
    }
  }
}

