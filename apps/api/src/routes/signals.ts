import { Router, type Request, type Response } from 'express'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { authMiddleware } from '../middleware/auth'
import type { AuthService } from '../services/AuthService'
import { SignalsService } from '../services/SignalsService'
import { z } from 'zod'

export function signalsRouter(
  db: Kysely<DB>,
  logger: Logger,
  authService: AuthService,
): Router {
  const r = Router()
  const signalsService = new SignalsService(db, logger)

  const SignalSchema = z.object({
    source: z.string().default('bot'),
    asset: z.string(),
    action: z.enum(['BUY', 'SELL', 'HOLD']),
    confidence: z.number().min(0).max(1).default(0.5),
    reason: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })

  r.post(
    '/v1/signals',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
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

        await signalsService.create(
          req.user!.userId,
          parsed.data,
          req.correlationId,
        )

        return res.json({ ok: true })
      } catch (err) {
        log.error(
          {
            err: {
              message: err instanceof Error ? err.message : String(err),
            },
          },
          'Failed to accept signal',
        )
        return res.status(500).json({ error: 'Failed to accept signal' })
      }
    },
  )

  r.get(
    '/v1/signals',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      try {
        const rows = await signalsService.list(req.user!.userId)
        return res.json(rows)
      } catch (err) {
        return res.status(500).json({ error: 'Failed to list signals' })
      }
    },
  )

  return r
}
