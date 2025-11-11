import { Router, type Request, type Response } from 'express'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { authMiddleware } from '../middleware/auth'
import type { AuthService } from '../services/AuthService'
import { StrategiesService } from '../services/StrategiesService'
import { z } from 'zod'

export function strategiesRouter(
  db: Kysely<DB>,
  logger: Logger,
  authService: AuthService,
): Router {
  const r = Router()
  const strategiesService = new StrategiesService(db, logger)

  const CreateStrategySchema = z.object({
    name: z.string().min(1).max(200),
    code: z.string().min(1),
    params_schema: z.any().optional(),
    allocated_amount_usd: z.number().min(0).optional(),
  })

  const UpdateStrategySchema = z.object({
    name: z.string().min(1).max(200).optional(),
    code: z.string().min(1).optional(),
    params_schema: z.any().optional(),
    allocated_amount_usd: z.number().min(0).optional(),
    is_active: z.boolean().optional(),
  })

  const BacktestStrategySchema = z.object({
    symbols: z.array(z.string()).min(1),
    interval: z.string().optional(),
    months: z.number().int().min(1).max(12).optional(),
    initial_balance: z.number().positive().optional(),
  })

  const UpdateAllocationSchema = z.object({
    allocated_amount_usd: z.number().min(0),
  })

  r.post(
    '/v1/strategies',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/strategies' })
      try {
        const parsed = CreateStrategySchema.safeParse(req.body)
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

        const result = await strategiesService.create(
          req.user!.userId,
          parsed.data,
          req.correlationId,
        )

        log.info({ strategyId: result.id, name: parsed.data.name }, 'Strategy created successfully')

        return res.json({ ok: true, id: result.id })
      } catch (err) {
        log.error({ err }, 'Failed to create strategy')
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Failed to create strategy',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.get(
    '/v1/strategies',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/strategies' })
      try {
        const strategies = await strategiesService.list(req.user!.userId)

        log.info({ count: strategies.length }, 'Strategies listed successfully')

        return res.json({ ok: true, strategies })
      } catch (err) {
        log.error({ err }, 'Failed to list strategies')
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Failed to list strategies',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  // IMPORTANT: This route must come BEFORE /v1/strategies/:id to avoid route conflicts
  r.get(
    '/v1/strategies/examples',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      try {
        const examples = await strategiesService.listExamples()
        return res.json({ strategies: examples })
      } catch (err) {
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to load example strategies',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.get(
    '/v1/strategies/:id',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/strategies/:id' })
      try {
        const id = Number.parseInt(req.params.id, 10)
        if (Number.isNaN(id)) {
          return res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail: 'Invalid strategy ID',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        const strategy = await strategiesService.getById(req.user!.userId, id)
        if (!strategy) {
          return res.status(404).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.4',
            title: 'Not Found',
            status: 404,
            detail: 'Strategy not found',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        log.info({ strategyId: id }, 'Strategy retrieved successfully')

        return res.json({ ok: true, strategy })
      } catch (err) {
        log.error({ err }, 'Failed to get strategy')
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Failed to get strategy',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.put(
    '/v1/strategies/:id',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/strategies/:id' })
      try {
        const id = Number.parseInt(req.params.id, 10)
        if (Number.isNaN(id)) {
          return res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail: 'Invalid strategy ID',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        const parsed = UpdateStrategySchema.safeParse(req.body)
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

        await strategiesService.update(req.user!.userId, id, parsed.data, req.correlationId)

        log.info({ strategyId: id }, 'Strategy updated successfully')

        return res.json({ ok: true })
      } catch (err) {
        log.error({ err }, 'Failed to update strategy')
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Failed to update strategy',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.delete(
    '/v1/strategies/:id',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/strategies/:id' })
      try {
        const id = Number.parseInt(req.params.id, 10)
        if (Number.isNaN(id)) {
          return res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail: 'Invalid strategy ID',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        await strategiesService.delete(req.user!.userId, id, req.correlationId)

        log.info({ strategyId: id }, 'Strategy deleted successfully')

        return res.json({ ok: true })
      } catch (err) {
        log.error({ err }, 'Failed to delete strategy')
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Failed to delete strategy',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.put(
    '/v1/strategies/:id/allocation',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/strategies/:id/allocation' })
      try {
        const id = Number.parseInt(req.params.id, 10)
        if (Number.isNaN(id)) {
          return res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail: 'Invalid strategy ID',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        const parsed = UpdateAllocationSchema.safeParse(req.body)
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

        await strategiesService.updateAllocation(
          req.user!.userId,
          id,
          parsed.data.allocated_amount_usd,
          req.correlationId,
        )

        log.info({ strategyId: id, allocated_amount_usd: parsed.data.allocated_amount_usd }, 'Strategy allocation updated successfully')

        return res.json({ ok: true })
      } catch (err) {
        log.error({ err }, 'Failed to update strategy allocation')
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Failed to update strategy allocation',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.post(
    '/v1/strategies/:id/backtest',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/strategies/:id/backtest' })
      try {
        const id = Number.parseInt(req.params.id, 10)
        if (Number.isNaN(id)) {
          return res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail: 'Invalid strategy ID',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        const parsed = BacktestStrategySchema.safeParse(req.body)
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

        const result = await strategiesService.backtest(
          req.user!.userId,
          id,
          parsed.data,
          req.correlationId,
        )

        log.info({ strategyId: id, backtestId: result.backtestId }, 'Backtest completed successfully')

        return res.json({ ok: true, result })
      } catch (err) {
        log.error({ err }, 'Failed to run backtest')
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Failed to run backtest',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.post(
    '/v1/strategies/:id/duplicate',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/strategies/:id/duplicate' })
      try {
        const strategyId = Number(req.params.id)
        const { name } = req.body

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail: 'Strategy name is required',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        const result = await strategiesService.duplicate(
          req.user!.userId,
          strategyId,
          name.trim(),
          req.correlationId,
        )

        return res.json(result)
      } catch (err) {
        log.error({ err }, 'Failed to duplicate strategy')
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Failed to duplicate strategy',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  return r
}

