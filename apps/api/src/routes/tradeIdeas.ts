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

  return r
}


