import { Router, type Request, type Response } from 'express'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { authMiddleware } from '../middleware/auth'
import type { AuthService } from '../services/AuthService'
import { TradeIdeasService } from '../services/TradeIdeasService'
import { TradesService } from '../services/TradesService'
import { z } from 'zod'
import {
  calculateQuantity,
  getSymbolPrice,
  isUSDQuoted,
  extractQuoteAsset,
  getTradingPairPrice,
} from '@pkg/shared-kernel'

export function tradeIdeasRouter(
  db: Kysely<DB>,
  logger: Logger,
  authService: AuthService,
): Router {
  const r = Router()
  const tradeIdeasService = new TradeIdeasService(db, logger)
  const tradesService = new TradesService(db, logger)

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
    budgetUSD: z.number().min(10).default(50),
    risk: z.enum(['moderate']).default('moderate'),
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

        const budget = parsed.data.budgetUSD
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

        const inserted = await tradesService.create(
          req.user!.userId,
          {
            ideaId,
            exchange: idea.exchange,
            symbol: idea.symbol,
            side: idea.side,
            budgetUSD: budget,
            entryPrice,
            quantity: quantityToUse / entryPrice, // Calculate quantity correctly
            tpPct,
            slPct,
            risk: parsed.data.risk,
            conversionTradeId, // Store reference to conversion trade if any
          },
          req.correlationId,
        )

        return res.json({
          executed: true,
          tradeId: inserted.id,
          conversionTradeId,
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
        const trade = await tradesService.findById(req.user!.userId, tradeId)

        if (!trade) {
          return res.status(404).json({ error: 'Trade not found' })
        }

        const history = await tradesService.getHistory(tradeId)
        return res.json({ trade, history })
      } catch (err) {
        return res.status(500).json({ error: 'Failed to load trade detail' })
      }
    },
  )

  return r
}
