import { Router, type Request, type Response } from 'express'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { authMiddleware } from '../middleware/auth'
import type { AuthService } from '../services/AuthService'
import { StrategiesService } from '../services/StrategiesService'
import { BacktestJobService } from '../services/BacktestJobService'
import { StrategyExecutionService } from '../services/StrategyExecutionService'
import { z } from 'zod'

export function strategiesRouter(
  db: Kysely<DB>,
  logger: Logger,
  authService: AuthService,
): Router {
  const r = Router()
  const strategiesService = new StrategiesService(db, logger)
  const backtestJobService = new BacktestJobService(db, logger)
  const executionService = new StrategyExecutionService(db, logger)

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

        log.info({ strategyId: id, jobId: result.jobId }, 'Backtest job created successfully')

        return res.json({ ok: true, jobId: result.jobId, status: result.status })
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

  r.get(
    '/v1/strategies/:id/backtests',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/strategies/:id/backtests' })
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

        const limit = Number.parseInt(req.query.limit as string, 10) || 50
        const offset = Number.parseInt(req.query.offset as string, 10) || 0

        const results = await strategiesService.listBacktestResults(
          req.user!.userId,
          id,
          limit,
          offset,
        )

        log.info({ strategyId: id, count: results.length }, 'Backtest results listed successfully')

        return res.json({ ok: true, results })
      } catch (err) {
        log.error({ err }, 'Failed to list backtest results')
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Failed to list backtest results',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.get(
    '/v1/backtest-jobs',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/backtest-jobs' })
      try {
        const strategyId = req.query.strategy_id
          ? Number.parseInt(req.query.strategy_id as string, 10)
          : undefined
        const status = req.query.status as 'pending' | 'running' | 'completed' | 'failed' | undefined
        const limit = Number.parseInt(req.query.limit as string, 10) || 50
        const offset = Number.parseInt(req.query.offset as string, 10) || 0
        const sortBy = (req.query.sort_by as 'created_at' | 'status') || 'created_at'
        const sortOrder = (req.query.sort_order as 'asc' | 'desc') || 'desc'

        if (strategyId !== undefined && Number.isNaN(strategyId)) {
          return res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail: 'Invalid strategy_id parameter',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        const { jobs, total } = await backtestJobService.listJobs({
          userId: req.user!.userId,
          strategyId,
          status,
          limit,
          offset,
          sortBy,
          sortOrder,
        })

        log.info({ count: jobs.length, total }, 'Backtest jobs listed successfully')

        return res.json({ ok: true, jobs, total })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        const errorStack = err instanceof Error ? err.stack : undefined
        
        log.error(
          { 
            err: {
              message: errorMessage,
              stack: errorStack,
              name: err instanceof Error ? err.name : undefined,
            },
            userId: req.user?.userId,
            query: req.query,
          },
          'Failed to list backtest jobs',
        )
        
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: errorMessage.includes('does not exist') 
            ? 'Backtest jobs table not found. Please run database migrations.'
            : errorMessage,
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.get(
    '/v1/backtest-jobs/:id',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/backtest-jobs/:id' })
      try {
        const id = Number.parseInt(req.params.id, 10)
        if (Number.isNaN(id)) {
          return res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail: 'Invalid job ID',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        const job = await backtestJobService.getJob(req.user!.userId, id)
        if (!job) {
          return res.status(404).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.4',
            title: 'Not Found',
            status: 404,
            detail: 'Backtest job not found',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        log.info({ jobId: id }, 'Backtest job retrieved successfully')

        return res.json({ ok: true, job })
      } catch (err) {
        log.error({ err }, 'Failed to get backtest job')
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Failed to get backtest job',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.get(
    '/v1/backtest-jobs/:id/result',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/backtest-jobs/:id/result' })
      try {
        const id = Number.parseInt(req.params.id, 10)
        if (Number.isNaN(id)) {
          return res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail: 'Invalid job ID',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        const job = await backtestJobService.getJob(req.user!.userId, id)
        if (!job) {
          return res.status(404).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.4',
            title: 'Not Found',
            status: 404,
            detail: 'Backtest job not found',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        if (job.status !== 'completed' || !job.result_id) {
          return res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail: 'Backtest job is not completed yet',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        const result = await strategiesService.getBacktestResult(
          req.user!.userId,
          job.result_id,
        )

        if (!result) {
          return res.status(404).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.4',
            title: 'Not Found',
            status: 404,
            detail: 'Backtest result not found',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        log.info({ jobId: id, resultId: job.result_id }, 'Backtest result retrieved successfully')

        return res.json({ ok: true, result })
      } catch (err) {
        log.error({ err }, 'Failed to get backtest result')
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Failed to get backtest result',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.get(
    '/v1/strategies/:id/execution',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/strategies/:id/execution' })
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

        const execution = await executionService.getExecution(req.user!.userId, id)

        log.info({ strategyId: id }, 'Execution status retrieved')

        return res.json({ ok: true, execution })
      } catch (err) {
        log.error({ err }, 'Failed to get execution status')
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Failed to get execution status',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.post(
    '/v1/strategies/:id/execution/start',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/strategies/:id/execution/start' })
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

        const StartExecutionSchema = z.object({
          symbols: z.array(z.string()).min(1),
          interval: z.string().optional(),
        })

        const parsed = StartExecutionSchema.safeParse(req.body)
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

        const result = await executionService.startExecution({
          userId: req.user!.userId,
          strategyId: id,
          symbols: parsed.data.symbols,
          interval: parsed.data.interval,
          correlationId: req.correlationId,
        })

        log.info({ strategyId: id, executionId: result.id }, 'Execution started')

        return res.json({ ok: true, executionId: result.id })
      } catch (err) {
        log.error({ err }, 'Failed to start execution')
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Failed to start execution',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.post(
    '/v1/strategies/:id/execution/stop',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/strategies/:id/execution/stop' })
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

        await executionService.stopExecution(req.user!.userId, id, req.correlationId)

        log.info({ strategyId: id }, 'Execution stopped')

        return res.json({ ok: true })
      } catch (err) {
        log.error({ err }, 'Failed to stop execution')
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Failed to stop execution',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.get(
    '/v1/strategies/:id/trades',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/strategies/:id/trades' })
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

        const limit = Number.parseInt(req.query.limit as string, 10) || 50
        const offset = Number.parseInt(req.query.offset as string, 10) || 0

        const trades = await db
          .selectFrom('strategy_trades')
          .innerJoin('trades', 'trades.id', 'strategy_trades.trade_id')
          .innerJoin('strategies', 'strategies.id', 'strategy_trades.strategy_id')
          .select([
            'strategy_trades.id',
            'strategy_trades.signal',
            'strategy_trades.symbol',
            'strategy_trades.created_at',
            'trades.id as trade_id',
            'trades.side',
            'trades.quantity',
            'trades.entry_price',
            'trades.status',
            'trades.pnl_usd',
          ])
          .where('strategies.user_id', '=', req.user!.userId)
          .where('strategy_trades.strategy_id', '=', id)
          .orderBy('strategy_trades.created_at', 'desc')
          .limit(limit)
          .offset(offset)
          .execute()

        log.info({ strategyId: id, count: trades.length }, 'Strategy trades listed')

        return res.json({ ok: true, trades })
      } catch (err) {
        log.error({ err }, 'Failed to list strategy trades')
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Failed to list strategy trades',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  return r
}

