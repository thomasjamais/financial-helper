import { Router, type Request, type Response } from 'express'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { authMiddleware } from '../middleware/auth'
import type { AuthService } from '../services/AuthService'
import { z } from 'zod'
import { BinanceAdapter, BinanceHttpClient } from '@pkg/exchange-adapters'
import { getActiveExchangeConfig } from '../services/exchangeConfigService'
import { getBinanceConfig, setBinanceConfig } from '../services/binanceState'
import { sql } from 'kysely'

export function tradeIdeasRouter(
  _db: Kysely<DB>,
  logger: Logger,
  authService: AuthService,
): Router {
  const r = Router()

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

        const d = parsed.data
        // normalize metadata
        let metadataObj: any = d.metadata ?? null
        if (typeof metadataObj === 'string') {
          try {
            metadataObj = JSON.parse(metadataObj)
          } catch {
            metadataObj = null
          }
        }
        const historyEntry = {
          ts: new Date().toISOString(),
          side: d.side,
          score: d.score,
          reason: d.reason ?? null,
          metadata: metadataObj,
        }

        await sql`
          insert into trade_ideas
            (user_id, exchange, symbol, side, score, reason, metadata, history)
          values
            (${req.user!.userId}, ${d.exchange}, ${d.symbol}, ${d.side}, ${d.score}, ${d.reason ?? null}, ${JSON.stringify(metadataObj)}::jsonb, ${JSON.stringify([historyEntry])}::jsonb)
          on conflict (user_id, exchange, symbol)
          do update set
            side = excluded.side,
            score = excluded.score,
            reason = excluded.reason,
            metadata = excluded.metadata,
            history = coalesce(trade_ideas.history, '[]'::jsonb) || excluded.history
        `.execute(_db)

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
        const rows = await _db
          .selectFrom('trade_ideas')
          .select([
            'id',
            'exchange',
            'symbol',
            'side',
            'score',
            'reason',
            'metadata',
            'created_at',
            'history',
          ])
          .where('user_id', '=', req.user!.userId)
          .orderBy('created_at', 'desc')
          .limit(200)
          .execute()
        return res.json(rows)
      } catch (err) {
        const log = req.logger || logger.child({ endpoint: '/v1/trade-ideas' })
        log.error({ err, correlationId: req.correlationId }, 'Failed to list trade ideas')
        return res.status(500).json({ error: 'Failed to list trade ideas' })
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
        const idea = await _db
          .selectFrom('trade_ideas')
          .selectAll()
          .where('id', '=', ideaId)
          .where('user_id', '=', req.user!.userId)
          .executeTakeFirst()

        if (!idea) return res.status(404).json({ error: 'Idea not found' })

        const budget = parsed.data.budgetUSD
        const sym = idea.symbol
        const resp = await fetch(
          `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(sym)}`,
        )
        if (!resp.ok)
          return res.status(502).json({ error: 'Failed to fetch price' })
        const { price } = (await resp.json()) as { price: string }
        const px = Number(price)
        if (!isFinite(px) || px <= 0)
          return res.status(502).json({ error: 'Invalid price' })

        const quantity = budget / px
        const tpPct = 0.04
        const slPct = 0.02

        const inserted = await _db
          .insertInto('trades')
          .values({
            user_id: req.user!.userId,
            idea_id: ideaId,
            exchange: idea.exchange,
            symbol: idea.symbol,
            side: idea.side,
            budget_usd: budget,
            quantity,
            entry_price: px,
            tp_pct: tpPct,
            sl_pct: slPct,
            status: 'simulated',
            metadata: { risk: parsed.data.risk } as any,
          })
          .returning(['id'])
          .executeTakeFirst()

        return res.json({ executed: true, tradeId: inserted?.id })
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
        const rows = await _db
          .selectFrom('trades')
          .select([
            'id',
            'idea_id',
            'exchange',
            'symbol',
            'side',
            'budget_usd',
            'quantity',
            'entry_price',
            'tp_pct',
            'sl_pct',
            'status',
            'opened_at',
            'closed_at',
            'pnl_usd',
            'metadata',
          ])
          .where('user_id', '=', req.user!.userId)
          .orderBy('opened_at', 'desc')
          .limit(200)
          .execute()
        return res.json(rows)
      } catch (err) {
        const log = req.logger || logger.child({ endpoint: '/v1/trades' })
        log.error({ err, correlationId: req.correlationId }, 'Failed to list trades')
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
        const trade = await _db
          .selectFrom('trades')
          .selectAll()
          .where('id', '=', tradeId)
          .where('user_id', '=', req.user!.userId)
          .executeTakeFirst()
        if (!trade) return res.status(404).json({ error: 'Trade not found' })
        const resp = await fetch(
          `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(trade.symbol)}`,
        )
        if (!resp.ok)
          return res.status(502).json({ error: 'Failed to fetch price' })
        const { price } = (await resp.json()) as any
        const mark = Number(price)
        if (!isFinite(mark))
          return res.status(502).json({ error: 'Invalid price' })
        const direction = trade.side === 'BUY' ? 1 : -1
        const pnl =
          direction *
          (mark - Number(trade.entry_price)) *
          Number(trade.quantity)
        await _db
          .insertInto('trade_pnl')
          .values({ trade_id: tradeId, mark_price: mark, pnl_usd: pnl })
          .execute()
        return res.json({ ok: true, mark, pnl: Number(pnl.toFixed(2)) })
      } catch (err) {
        const log = req.logger || logger.child({ endpoint: '/v1/trades/:id/snapshot' })
        log.error({ err, correlationId: req.correlationId }, 'Failed to record snapshot')
        return res.status(500).json({ error: 'Failed to record snapshot' })
      }
    },
  )

  r.get(
    '/v1/trades/:id',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      try {
        const tradeId = Number(req.params.id)
        const trade = await _db
          .selectFrom('trades')
          .selectAll()
          .where('id', '=', tradeId)
          .where('user_id', '=', req.user!.userId)
          .executeTakeFirst()
        if (!trade) return res.status(404).json({ error: 'Trade not found' })
        const history = await _db
          .selectFrom('trade_pnl')
          .selectAll()
          .where('trade_id', '=', tradeId)
          .orderBy('ts', 'desc')
          .limit(200)
          .execute()
        return res.json({ trade, history })
      } catch (err) {
        const log = req.logger || logger.child({ endpoint: '/v1/trades/:id' })
        log.error({ err, correlationId: req.correlationId }, 'Failed to load trade detail')
        return res.status(500).json({ error: 'Failed to load trade detail' })
      }
    },
  )

  r.get(
    '/v1/trades/with-pnl',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      try {
        const rows = await _db
          .selectFrom('trades')
          .select([
            'id',
            'idea_id',
            'exchange',
            'symbol',
            'side',
            'budget_usd',
            'quantity',
            'entry_price',
            'tp_pct',
            'sl_pct',
            'status',
            'opened_at',
            'closed_at',
            'pnl_usd',
            'metadata',
          ])
          .where('user_id', '=', req.user!.userId)
          .orderBy('opened_at', 'desc')
          .limit(200)
          .execute()

        // Default response if anything fails below
        const fallback = rows.map((r) => ({ ...r, markPrice: null, pnl_unrealized: null }))

        try {
          // Fetch current prices for unique symbols from Binance
          const symbols = Array.from(new Set(rows.map((r) => r.symbol)))
          const priceMap = new Map<string, number>()
          await Promise.all(
            symbols.map(async (sym) => {
              try {
                const resp = await fetch(
                  `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(sym)}`,
                )
                if (resp.ok) {
                  const { price } = (await resp.json()) as any
                  const px = Number(price)
                  if (isFinite(px)) priceMap.set(sym, px)
                }
              } catch (e) {
                // ignore per-symbol errors
              }
            }),
          )

          const enriched = rows.map((r) => {
            const mark = priceMap.get(r.symbol)
            if (!mark) return { ...r, markPrice: null, pnl_unrealized: null }
            const direction = r.side === 'BUY' ? 1 : -1
            const pnl =
              direction * (mark - Number(r.entry_price)) * Number(r.quantity)
            return {
              ...r,
              markPrice: mark,
              pnl_unrealized: Number(pnl.toFixed(2)),
            }
          })
          return res.json(enriched)
        } catch (innerErr) {
          req.logger?.warn({ err: innerErr, correlationId: req.correlationId }, 'PnL enrichment failed, returning fallback')
          return res.json(fallback)
        }
      } catch (err) {
        const log = req.logger || logger.child({ endpoint: '/v1/trades/with-pnl' })
        log.error({ err, correlationId: req.correlationId }, 'Failed to compute PnL')
        return res.status(500).json({ error: 'Failed to compute PnL' })
      }
    },
  )

  return r
}
