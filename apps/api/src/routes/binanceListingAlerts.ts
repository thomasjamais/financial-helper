import { Router, type Request, type Response } from 'express'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { authMiddleware } from '../middleware/auth'
import type { AuthService } from '../services/AuthService'
import { BinanceListingAlertService } from '../services/BinanceListingAlertService'
import { z } from 'zod'

export function binanceListingAlertsRouter(
  db: Kysely<DB>,
  logger: Logger,
  authService: AuthService,
): Router {
  const r = Router()
  const alertService = new BinanceListingAlertService(db, logger)

  r.get(
    '/v1/binance/listing-alerts',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/binance/listing-alerts' })

      try {
        const querySchema = z.object({
          eventType: z.enum(['IPO', 'Launchpool', 'new_listing', 'delisting']).optional(),
          limit: z.coerce.number().int().min(1).max(100).optional().default(50),
          offset: z.coerce.number().int().min(0).optional().default(0),
          since: z.coerce.date().optional(),
        })

        const parsed = querySchema.safeParse(req.query)
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

        const alerts = await alertService.listAlerts({
          eventType: parsed.data.eventType,
          limit: parsed.data.limit,
          offset: parsed.data.offset,
          since: parsed.data.since,
        })

        return res.json({ alerts })
      } catch (err) {
        log.error({ err }, 'Failed to list alerts')
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to list alerts',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.get(
    '/v1/binance/listing-alerts/recent',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/binance/listing-alerts/recent' })

      try {
        const querySchema = z.object({
          limit: z.coerce.number().int().min(1).max(50).optional().default(10),
        })

        const parsed = querySchema.safeParse(req.query)
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

        const alerts = await alertService.getRecentAlerts(parsed.data.limit)

        return res.json({ alerts })
      } catch (err) {
        log.error({ err }, 'Failed to get recent alerts')
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to get recent alerts',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  return r
}

