import { Router, type Request, type Response } from 'express'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { authMiddleware } from '../middleware/auth'
import type { AuthService } from '../services/AuthService'
import { z } from 'zod'

export function tradeIdeasRouter(_db: Kysely<DB>, logger: Logger, authService: AuthService): Router {
  const r = Router()

  const IdeaSchema = z.object({
    exchange: z.string().default('binance'),
    symbol: z.string(),
    side: z.enum(['BUY', 'SELL']),
    score: z.number().min(0).max(1),
    reason: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })

  r.post('/v1/trade-ideas', authMiddleware(authService, logger), async (req: Request, res: Response) => {
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
      await _db
        .insertInto('trade_ideas')
        .values({
          user_id: req.user!.userId,
          exchange: d.exchange,
          symbol: d.symbol,
          side: d.side,
          score: d.score,
          reason: d.reason ?? null,
          metadata: d.metadata ?? null,
        })
        .execute()

      return res.json({ ok: true })
    } catch (err) {
      log.error({ err }, 'Failed to accept trade idea')
      return res.status(500).json({ error: 'Failed to accept trade idea' })
    }
  })

  r.get('/v1/trade-ideas', authMiddleware(authService, logger), async (req: Request, res: Response) => {
    try {
      const rows = await _db
        .selectFrom('trade_ideas')
        .select(['id', 'exchange', 'symbol', 'side', 'score', 'reason', 'metadata', 'created_at'])
        .where('user_id', '=', req.user!.userId)
        .orderBy('created_at', 'desc')
        .limit(200)
        .execute()
      return res.json(rows)
    } catch (err) {
      return res.status(500).json({ error: 'Failed to list trade ideas' })
    }
  })

  const ExecSchema = z.object({
    confirm: z.boolean().default(false),
    budgetUSD: z.number().min(10).default(50),
    risk: z.enum(['moderate']).default('moderate'),
  })

  r.post('/v1/trade-ideas/:id/execute', authMiddleware(authService, logger), async (req: Request, res: Response) => {
    const log = req.logger || logger.child({ endpoint: '/v1/trade-ideas/:id/execute' })
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
      const resp = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(sym)}`)
      if (!resp.ok) return res.status(502).json({ error: 'Failed to fetch price' })
      const { price } = (await resp.json()) as { price: string }
      const px = Number(price)
      if (!isFinite(px) || px <= 0) return res.status(502).json({ error: 'Invalid price' })

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
  })

  r.get('/v1/trades', authMiddleware(authService, logger), async (req: Request, res: Response) => {
    try {
      const rows = await _db
        .selectFrom('trades')
        .select([ 'id','idea_id','exchange','symbol','side','budget_usd','quantity','entry_price','tp_pct','sl_pct','status','opened_at','closed_at','pnl_usd','metadata' ])
        .where('user_id', '=', req.user!.userId)
        .orderBy('opened_at', 'desc')
        .limit(200)
        .execute()
      return res.json(rows)
    } catch (err) {
      return res.status(500).json({ error: 'Failed to list trades' })
    }
  })

  return r
}


