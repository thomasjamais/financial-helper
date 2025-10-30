import { Router, type Request, type Response } from 'express'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { authMiddleware } from '../middleware/auth'
import type { AuthService } from '../services/AuthService'
import { z } from 'zod'

export function signalsRouter(_db: Kysely<DB>, logger: Logger, authService: AuthService): Router {
  const r = Router()

  const SignalSchema = z.object({
    source: z.string().default('bot'),
    asset: z.string(),
    action: z.enum(['BUY', 'SELL', 'HOLD']),
    confidence: z.number().min(0).max(1).default(0.5),
    reason: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })

  r.post('/v1/signals', authMiddleware(authService, logger), async (req: Request, res: Response) => {
    const log = req.logger || logger.child({ endpoint: '/v1/signals' })
    try {
      const parsed = SignalSchema.safeParse(req.body)
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

      // Persist signal
      const s = parsed.data
      await _db
        .insertInto('signals')
        .values({
          user_id: req.user!.userId,
          source: s.source,
          asset: s.asset,
          action: s.action,
          confidence: s.confidence,
          reason: s.reason ?? null,
          metadata: s.metadata ?? null,
        })
        .execute()

      log.info({ signal: s }, 'Signal received')
      return res.json({ ok: true })
    } catch (err) {
      log.error({ err: { message: err instanceof Error ? err.message : String(err) } }, 'Failed to accept signal')
      return res.status(500).json({ error: 'Failed to accept signal' })
    }
  })

  r.get('/v1/signals', authMiddleware(authService, logger), async (req: Request, res: Response) => {
    const log = req.logger || logger.child({ endpoint: '/v1/signals' })
    try {
      const rows = await _db
        .selectFrom('signals')
        .select(['id', 'source', 'asset', 'action', 'confidence', 'reason', 'metadata', 'created_at'])
        .where('user_id', '=', req.user!.userId)
        .orderBy('created_at', 'desc')
        .limit(200)
        .execute()
      return res.json(rows)
    } catch (err) {
      log.error({ err }, 'Failed to list signals')
      return res.status(500).json({ error: 'Failed to list signals' })
    }
  })

  return r
}
