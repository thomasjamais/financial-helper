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
        let entryPrice: number
        if (entryPriceFromMetadata) {
          entryPrice = entryPriceFromMetadata
        } else {
          const price = await getSymbolPrice(idea.symbol)
          if (!price || !isFinite(price) || price <= 0) {
            return res.status(502).json({ error: 'Failed to fetch price' })
          }
          entryPrice = price
        }

        const budget = parsed.data.budgetUSD
        // Use TP/SL from metadata if available (technical analysis), otherwise defaults
        const tpPct = tpPctFromMetadata ?? 0.04
        const slPct = slPctFromMetadata ?? 0.02

        const inserted = await tradesService.create(
          req.user!.userId,
          {
            ideaId,
            exchange: idea.exchange,
            symbol: idea.symbol,
            side: idea.side,
            budgetUSD: budget,
            entryPrice,
            tpPct,
            slPct,
            risk: parsed.data.risk,
          },
          req.correlationId,
        )

        return res.json({ executed: true, tradeId: inserted.id })
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

  return r
}
