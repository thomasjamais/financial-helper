import { Router, type Request, type Response } from 'express'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { authMiddleware } from '../middleware/auth'
import type { AuthService } from '../services/AuthService'
import { TradeIdeasService } from '../services/TradeIdeasService'
import { TradesService } from '../services/TradesService'
import { BinanceService } from '../services/BinanceService'
import { AutoTradeService } from '../services/AutoTradeService'
import { TradeMonitorService } from '../services/TradeMonitorService'
import { z } from 'zod'
import {
  calculateQuantity,
  getSymbolPrice,
  isUSDQuoted,
  extractQuoteAsset,
  getTradingPairPrice,
} from '@pkg/shared-kernel'
import type { ExitStrategy, TrailingStopConfig } from '@pkg/trade-monitor'

export function tradeIdeasRouter(
  db: Kysely<DB>,
  logger: Logger,
  authService: AuthService,
  encKey: string,
): Router {
  const r = Router()
  const tradeIdeasService = new TradeIdeasService(db, logger)
  const tradesService = new TradesService(db, logger)
  const binanceService = new BinanceService(db, logger, encKey)
  const autoTradeService = new AutoTradeService(db, logger, encKey)
  const tradeMonitorService = new TradeMonitorService(
    db,
    logger,
    tradesService,
    binanceService,
  )

  const IdeaSchema = z.object({
    exchange: z.string().default('binance'),
    symbol: z.string(),
    side: z.enum(['BUY', 'SELL']),
    score: z.number().min(0).max(1),
    reason: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })

  r.post(
    '/v1/trade-ideas',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/trade-ideas' })
      try {
        const parsed = IdeaSchema.safeParse(req.body)
        if (!parsed.success) {
          return res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail: 'Validation failed',
            errors: parsed.error.errors,
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        let metadataObj: any = parsed.data.metadata ?? null
        if (typeof metadataObj === 'string') {
          try {
            metadataObj = JSON.parse(metadataObj)
          } catch {
            metadataObj = null
          }
        }

        await tradeIdeasService.create(
          req.user!.userId,
          {
            ...parsed.data,
            metadata: metadataObj,
          },
          req.correlationId,
        )

        log.info(
          {
            symbol: parsed.data.symbol,
            side: parsed.data.side,
            score: parsed.data.score,
            userId: req.user!.userId,
          },
          'Trade idea created successfully',
        )

        return res.json({ ok: true })
      } catch (err) {
        log.error({ err }, 'Failed to accept trade idea')
        return res.status(500).json({ error: 'Failed to accept trade idea' })
      }
    },
  )

  r.get(
    '/v1/trade-ideas',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      try {
        const sortBy = (req.query?.sortBy as string) || 'created_at'
        const sortOrder = (req.query?.sortOrder as string) || 'desc'
        const validSortBy = ['score', 'side', 'created_at']
        const validSortOrder = ['asc', 'desc']

        const finalSortBy = validSortBy.includes(sortBy)
          ? (sortBy as 'score' | 'side' | 'created_at')
          : 'created_at'
        const finalSortOrder = validSortOrder.includes(sortOrder)
          ? (sortOrder as 'asc' | 'desc')
          : 'desc'

        const rows = await tradeIdeasService.list(req.user!.userId, {
          sortBy: finalSortBy,
          sortOrder: finalSortOrder,
        })

        return res.json(rows)
      } catch (err) {
        return res.status(500).json({ error: 'Failed to list trade ideas' })
      }
    },
  )

  r.post(
    '/v1/trade-ideas/refresh',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/trade-ideas/refresh' })
      try {
        const count = await tradeIdeasService.refreshFromBinanceTickers(
          req.user!.userId,
          req.correlationId,
        )

        return res.json({ ok: true, count })
      } catch (err) {
        log.error(
          { err, correlationId: req.correlationId },
          'Failed to refresh trade ideas',
        )
        return res.status(500).json({ error: 'Failed to refresh trade ideas' })
      }
    },
  )

  const ExecSchema = z.object({
    confirm: z.boolean().default(false),
    budgetUSD: z.number().min(10).optional(),
    risk: z.enum(['moderate']).default('moderate'),
    realTrade: z.boolean().default(false), // Opt-in for real trading
  })

  r.post(
    '/v1/trade-ideas/:id/execute',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/trade-ideas/:id/execute' })
      try {
        const parsed = ExecSchema.safeParse(req.body)
        if (!parsed.success) {
          return res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail: 'Validation failed',
            errors: parsed.error.errors,
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        const ideaId = Number(req.params.id)
        const idea = await tradeIdeasService.findById(req.user!.userId, ideaId)

        if (!idea) {
          return res.status(404).json({ error: 'Idea not found' })
        }

        // Get entry price and TP/SL from metadata if available (technical analysis)
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
          typeof metadata.stopLossPct === 'number' && metadata.stopLossPct > 0
            ? metadata.stopLossPct
            : null

        // Use entry price from metadata if available, otherwise fetch current price
        // For non-USD pairs, we need the actual pair price (e.g., FETBTC in BTC, not USD)
        // For USD pairs, we can use the USD price directly
        let entryPrice: number
        let entryPriceInUSD: number | null = null // For PnL calculations later

        if (entryPriceFromMetadata) {
          entryPrice = entryPriceFromMetadata
          // If metadata price exists, it's likely already in USD (from technical analysis)
          // But we should still check if it's a non-USD pair
          if (!isUSDQuoted(idea.symbol)) {
            // Metadata price is in USD, but we need the actual pair price
            // Get the actual trading pair price
            const pairPrice = await getTradingPairPrice(idea.symbol)
            if (!pairPrice || !isFinite(pairPrice) || pairPrice <= 0) {
              return res.status(502).json({
                error: 'Failed to fetch pair price for non-USD symbol',
              })
            }
            entryPrice = pairPrice
            entryPriceInUSD = entryPriceFromMetadata
          } else {
            entryPriceInUSD = entryPriceFromMetadata
          }
        } else {
          if (isUSDQuoted(idea.symbol)) {
            // USD pair: get price in USD directly
            const price = await getSymbolPrice(idea.symbol)
            if (!price || !isFinite(price) || price <= 0) {
              return res.status(502).json({ error: 'Failed to fetch price' })
            }
            entryPrice = price
            entryPriceInUSD = price
          } else {
            // Non-USD pair: get actual pair price (e.g., FETBTC in BTC)
            const pairPrice = await getTradingPairPrice(idea.symbol)
            if (!pairPrice || !isFinite(pairPrice) || pairPrice <= 0) {
              return res.status(502).json({
                error: 'Failed to fetch pair price',
              })
            }
            entryPrice = pairPrice

            // Also get USD price for budget calculations
            const usdPrice = await getSymbolPrice(idea.symbol)
            if (!usdPrice || !isFinite(usdPrice) || usdPrice <= 0) {
              return res.status(502).json({
                error: 'Failed to fetch USD price for conversion',
              })
            }
            entryPriceInUSD = usdPrice
          }
        }

        const realTrade = parsed.data.realTrade ?? false
        let budget = parsed.data.budgetUSD

        // If realTrade is true and no budget specified, calculate from available USDT
        if (realTrade && !budget) {
          try {
            const availableUSDT = await binanceService.getUSDTBalance()
            if (availableUSDT < 10) {
              return res.status(400).json({
                error: `Insufficient USDT balance. Available: ${availableUSDT.toFixed(2)} USDT. Minimum required: 10 USDT.`,
              })
            }
            // Use all available USDT for real trades when no budget specified
            budget = availableUSDT
            log.info(
              { availableUSDT, budget },
              'Using available USDT for real trade',
            )
          } catch (err) {
            log.error({ err }, 'Failed to get USDT balance')
            return res.status(500).json({
              error: 'Failed to get available USDT balance for real trade',
            })
          }
        }

        // Default budget if not specified and not real trade
        if (!budget) {
          budget = 50
        }

        // Use TP/SL from metadata if available (technical analysis), otherwise defaults
        const tpPct = tpPctFromMetadata ?? 0.04
        const slPct = slPctFromMetadata ?? 0.02

        // Check if symbol is not USD-quoted (e.g., FETBTC instead of FETUSDT)
        // If so, we need to create a conversion trade from USDC to the quote asset
        let conversionTradeId: number | null = null
        let quoteAssetBudget: number | null = null // Budget in quote asset after conversion

        if (!isUSDQuoted(idea.symbol)) {
          const quoteAsset = extractQuoteAsset(idea.symbol)

          if (!quoteAsset) {
            return res.status(400).json({
              error: `Unable to determine quote asset for symbol ${idea.symbol}`,
            })
          }

          // Try to find USDC pair first, then USDT as fallback
          let conversionSymbol = `${quoteAsset}USDC`
          let conversionPairPrice = await getTradingPairPrice(conversionSymbol)

          if (
            !conversionPairPrice ||
            !isFinite(conversionPairPrice) ||
            conversionPairPrice <= 0
          ) {
            // Try USDT instead
            conversionSymbol = `${quoteAsset}USDT`
            conversionPairPrice = await getTradingPairPrice(conversionSymbol)

            if (
              !conversionPairPrice ||
              !isFinite(conversionPairPrice) ||
              conversionPairPrice <= 0
            ) {
              return res.status(502).json({
                error: `Failed to fetch conversion pair price for ${quoteAsset}. Tried both USDC and USDT pairs.`,
              })
            }
          }

          // Create conversion trade: BUY quoteAsset with USDC/USDT
          // This ensures we have the quote asset needed for the actual trade
          const conversionTrade = await tradesService.create(
            req.user!.userId,
            {
              ideaId: null, // Conversion trade, not from an idea
              exchange: idea.exchange,
              symbol: conversionSymbol,
              side: 'BUY', // Always BUY to convert USDC to quote asset
              budgetUSD: budget,
              entryPrice: conversionPairPrice,
              tpPct: 0, // No TP/SL for conversion trades
              slPct: 0,
              risk: 'conversion',
            },
            req.correlationId,
          )

          conversionTradeId = conversionTrade.id

          // Calculate how much quote asset we got from the conversion
          // quantity = budgetUSD / conversionPairPrice (where price is in USD per quote asset)
          // So if BTCUSDC = 50000, and budget = 500, we get 500/50000 = 0.01 BTC
          quoteAssetBudget = budget / conversionPairPrice

          log.info(
            {
              symbol: idea.symbol,
              quoteAsset,
              conversionSymbol,
              conversionTradeId,
              quoteAssetBudget,
            },
            'Created conversion trade for non-USD pair',
          )
        }

        // For non-USD pairs, calculate quantity using quote asset budget and entry price in quote asset
        // For USD pairs, use USD budget and entry price in USD
        const quantityToUse = quoteAssetBudget ?? budget
        // entryPrice is already in the correct unit (pair price for non-USD, USD price for USD pairs)
        const calculatedQuantity = quantityToUse / entryPrice

        let orderId: string | undefined
        let actualQuantity = calculatedQuantity

        // Place real order if realTrade is true
        if (realTrade && idea.exchange === 'binance') {
          try {
            log.info(
              {
                symbol: idea.symbol,
                side: idea.side,
                quantity: calculatedQuantity,
                entryPrice,
                realTrade,
              },
              'Placing real order on Binance',
            )

            const order = await binanceService.placeSpotOrder({
              symbol: idea.symbol,
              side: idea.side,
              type: 'MARKET', // Use market orders for immediate execution
              quantity: calculatedQuantity,
            })

            orderId = order.id
            actualQuantity = order.qty

            log.info(
              {
                orderId,
                symbol: idea.symbol,
                executedQty: order.qty,
                status: order.status,
              },
              'Real order placed successfully',
            )
          } catch (err) {
            log.error(
              { err, symbol: idea.symbol },
              'Failed to place real order',
            )

            // Parse Binance API error messages for better user feedback
            let errorMessage = err instanceof Error ? err.message : String(err)
            if (
              errorMessage.includes('-2010') ||
              errorMessage.includes('Symbol not whitelisted')
            ) {
              errorMessage = `Symbol ${idea.symbol} is not whitelisted for your Binance API key. Please check your API key settings in Binance and ensure symbol trading permissions are enabled, or disable symbol whitelisting in your API key restrictions.`
            } else if (errorMessage.includes('-2011')) {
              errorMessage = `Unknown order sent. Symbol ${idea.symbol} may not be available for trading.`
            } else if (errorMessage.includes('-1022')) {
              errorMessage = `Invalid signature. Please check your Binance API key and secret configuration.`
            } else if (errorMessage.includes('-2015')) {
              errorMessage = `Invalid API-key or IP permissions. Please verify your API key settings in Binance.`
            }

            return res.status(500).json({
              error: `Failed to place real order: ${errorMessage}`,
            })
          }
        }

        const inserted = await tradesService.create(
          req.user!.userId,
          {
            ideaId,
            exchange: idea.exchange,
            symbol: idea.symbol,
            side: idea.side,
            budgetUSD: budget,
            entryPrice,
            quantity: actualQuantity,
            tpPct,
            slPct,
            risk: parsed.data.risk,
            conversionTradeId, // Store reference to conversion trade if any
            realTrade,
            orderId,
          },
          req.correlationId,
        )

        return res.json({
          executed: true,
          tradeId: inserted.id,
          conversionTradeId,
          realTrade,
          orderId,
        })
      } catch (err) {
        log.error({ err }, 'Failed to execute idea')
        return res.status(500).json({ error: 'Failed to execute idea' })
      }
    },
  )

  r.get(
    '/v1/trades',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      try {
        const rows = await tradesService.list(req.user!.userId)
        return res.json(rows)
      } catch (err) {
        return res.status(500).json({ error: 'Failed to list trades' })
      }
    },
  )

  r.post(
    '/v1/trades/:id/snapshot',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      try {
        const tradeId = Number(req.params.id)
        const trade = await tradesService.findById(req.user!.userId, tradeId)

        if (!trade) {
          return res.status(404).json({ error: 'Trade not found' })
        }

        const price = await getSymbolPrice(trade.symbol)
        if (!price || !isFinite(price) || price <= 0) {
          return res.status(502).json({ error: 'Failed to fetch price' })
        }

        const result = await tradesService.createSnapshot(
          req.user!.userId,
          tradeId,
          price,
          req.correlationId,
        )

        return res.json({ ok: true, mark: result.mark, pnl: result.pnl })
      } catch (err) {
        return res.status(500).json({ error: 'Failed to record snapshot' })
      }
    },
  )

  r.get(
    '/v1/trades/with-pnl',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/trades/with-pnl' })
      try {
        const enriched = await tradesService.listWithPnLAndFetchPrices(
          req.user!.userId,
          log,
        )

        return res.json(enriched)
      } catch (err) {
        log.error(
          { err, correlationId: req.correlationId },
          'Failed to compute PnL',
        )
        return res.status(500).json({ error: 'Failed to compute PnL' })
      }
    },
  )

  r.get(
    '/v1/trades/:id',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      try {
        const tradeId = Number(req.params.id)
        const detail = await tradesService.getTradeDetail(req.user!.userId, tradeId)

        if (!detail) {
          return res.status(404).json({ error: 'Trade not found' })
        }

        return res.json(detail)
      } catch (err) {
        return res.status(500).json({ error: 'Failed to load trade detail' })
      }
    },
  )

  r.post(
    '/v1/trades/:id/close',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/trades/:id/close' })
      try {
        const tradeId = Number(req.params.id)
        const trade = await tradesService.findById(req.user!.userId, tradeId)

        if (!trade) {
          return res.status(404).json({ error: 'Trade not found' })
        }

        if (trade.status === 'closed') {
          return res.status(400).json({ error: 'Trade is already closed' })
        }

        // Get current price to calculate final PnL
        const currentPrice = await getSymbolPrice(trade.symbol)
        if (!currentPrice || !isFinite(currentPrice) || currentPrice <= 0) {
          return res
            .status(502)
            .json({ error: 'Failed to fetch current price' })
        }

        // For non-USD pairs, we need the actual pair price, not USD price
        let exitPrice: number = currentPrice
        if (!isUSDQuoted(trade.symbol)) {
          const pairPrice = await getTradingPairPrice(trade.symbol)
          if (pairPrice && isFinite(pairPrice) && pairPrice > 0) {
            exitPrice = pairPrice
          } else {
            return res.status(502).json({
              error: 'Failed to fetch pair price for closing',
            })
          }
        }

        const result = await tradesService.closeTrade(
          req.user!.userId,
          tradeId,
          exitPrice,
          req.correlationId,
        )

        return res.json({
          ok: true,
          trade: result.trade,
          pnl: result.pnl,
          pnlPct: result.pnlPct,
        })
      } catch (err) {
        log.error({ err }, 'Failed to close trade')
        return res.status(500).json({ error: 'Failed to close trade' })
      }
    },
  )

  r.post(
    '/v1/trade-ideas/auto-place',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/trade-ideas/auto-place' })
      try {
        const result = await autoTradeService.autoPlaceTrades(req.user!.userId)

        log.info(
          {
            checked: result.checked,
            placed: result.placed,
            errors: result.errors,
          },
          'Auto-trade placement completed',
        )

        return res.json(result)
      } catch (err) {
        log.error({ err }, 'Failed to execute auto-trade placement')
        return res.status(500).json({
          error: 'Failed to execute auto-trade placement',
          detail: err instanceof Error ? err.message : String(err),
        })
      }
    },
  )

  const ExitStrategySchema = z.object({
    levels: z.array(
      z.object({
        profitPct: z.number().min(0),
        quantityPct: z.number().min(0).max(1),
      }),
    ),
    autoCalculated: z.boolean().optional(),
  })

  r.post(
    '/v1/trades/:id/exit-strategy',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/trades/:id/exit-strategy' })
      try {
        const tradeId = Number(req.params.id)
        const parsed = ExitStrategySchema.safeParse(req.body)

        if (!parsed.success) {
          return res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail: 'Invalid exit strategy format',
            errors: parsed.error.errors,
          })
        }

        const trade = await tradesService.findById(req.user!.userId, tradeId)
        if (!trade) {
          return res.status(404).json({ error: 'Trade not found' })
        }

        await tradesService.updateExitStrategy(
          req.user!.userId,
          tradeId,
          parsed.data as ExitStrategy,
          req.correlationId,
        )

        return res.json({ ok: true })
      } catch (err) {
        log.error({ err }, 'Failed to update exit strategy')
        return res.status(500).json({ error: 'Failed to update exit strategy' })
      }
    },
  )

  const TrailingStopConfigSchema = z.object({
    enabled: z.boolean(),
    activationProfitPct: z.number().min(0),
    trailDistancePct: z.number().min(0),
    minTrailDistancePct: z.number().min(0),
  })

  r.post(
    '/v1/trades/:id/trailing-stop',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/trades/:id/trailing-stop' })
      try {
        const tradeId = Number(req.params.id)
        const parsed = TrailingStopConfigSchema.safeParse(req.body)

        if (!parsed.success) {
          return res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail: 'Invalid trailing stop config format',
            errors: parsed.error.errors,
          })
        }

        const trade = await tradesService.findById(req.user!.userId, tradeId)
        if (!trade) {
          return res.status(404).json({ error: 'Trade not found' })
        }

        await tradesService.updateTrailingStopConfig(
          req.user!.userId,
          tradeId,
          parsed.data as TrailingStopConfig,
          req.correlationId,
        )

        return res.json({ ok: true })
      } catch (err) {
        log.error({ err }, 'Failed to update trailing stop config')
        return res.status(500).json({ error: 'Failed to update trailing stop config' })
      }
    },
  )

  r.get(
    '/v1/trades/:id/exits',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/trades/:id/exits' })
      try {
        const tradeId = Number(req.params.id)
        const limit = Number(req.query.limit) || 200

        const trade = await tradesService.findById(req.user!.userId, tradeId)
        if (!trade) {
          return res.status(404).json({ error: 'Trade not found' })
        }

        const exits = await tradesService.getExits(tradeId, limit)

        return res.json({ exits })
      } catch (err) {
        log.error({ err }, 'Failed to get trade exits')
        return res.status(500).json({ error: 'Failed to get trade exits' })
      }
    },
  )

  r.post(
    '/v1/trades/monitor',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/trades/monitor' })
      try {
        const result = await tradeMonitorService.monitorTrades(req.correlationId)

        return res.json(result)
      } catch (err) {
        log.error({ err }, 'Failed to monitor trades')
        return res.status(500).json({
          error: 'Failed to monitor trades',
          detail: err instanceof Error ? err.message : String(err),
        })
      }
    },
  )

  r.post(
    '/v1/trades/:id/feelings',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/trades/:id/feelings' })
      try {
        const tradeId = Number(req.params.id)
        const { feeling_text, sentiment_score, timeframe } = req.body

        if (!timeframe || !['1min', '5min', '30min', '1h', '4h', '1d', '1w', '1m', '1y'].includes(timeframe)) {
          return res.status(400).json({ error: 'Invalid timeframe' })
        }

        if (sentiment_score !== null && sentiment_score !== undefined) {
          if (typeof sentiment_score !== 'number' || sentiment_score < -1 || sentiment_score > 1) {
            return res.status(400).json({ error: 'Sentiment score must be between -1 and 1' })
          }
        }

        const result = await tradesService.createTradeFeeling(
          req.user!.userId,
          tradeId,
          feeling_text ?? null,
          sentiment_score ?? null,
          timeframe,
          req.correlationId,
        )

        return res.json(result)
      } catch (err) {
        log.error({ err }, 'Failed to create trade feeling')
        return res.status(500).json({
          error: 'Failed to create trade feeling',
          detail: err instanceof Error ? err.message : String(err),
        })
      }
    },
  )

  r.put(
    '/v1/trades/:id/feelings/:feelingId',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/trades/:id/feelings/:feelingId' })
      try {
        const feelingId = Number(req.params.feelingId)
        const { feeling_text, sentiment_score } = req.body

        if (sentiment_score !== null && sentiment_score !== undefined) {
          if (typeof sentiment_score !== 'number' || sentiment_score < -1 || sentiment_score > 1) {
            return res.status(400).json({ error: 'Sentiment score must be between -1 and 1' })
          }
        }

        await tradesService.updateTradeFeeling(
          req.user!.userId,
          feelingId,
          feeling_text ?? null,
          sentiment_score ?? null,
          req.correlationId,
        )

        return res.json({ ok: true })
      } catch (err) {
        log.error({ err }, 'Failed to update trade feeling')
        return res.status(500).json({
          error: 'Failed to update trade feeling',
          detail: err instanceof Error ? err.message : String(err),
        })
      }
    },
  )

  r.get(
    '/v1/trades/:id/feelings',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      try {
        const tradeId = Number(req.params.id)
        const feelings = await tradesService.getTradeFeelings(req.user!.userId, tradeId)
        return res.json({ feelings })
      } catch (err) {
        return res.status(500).json({ error: 'Failed to load trade feelings' })
      }
    },
  )

  return r
}
