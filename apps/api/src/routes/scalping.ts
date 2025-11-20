import { Router, Request, Response } from 'express'
import { z } from 'zod'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { ScalpingService } from '../services/scalpingService'
import { ScalpingBacktestService } from '../services/scalpingBacktestService'
import { ScalpingOrderService } from '../services/scalpingOrderService'
import { ScalpingStrategyService } from '../services/scalpingStrategyService'
import { ScalpingBotService } from '../services/scalpingBotService'
import { BitgetService } from '../services/BitgetService'
import { AuthService } from '../services/AuthService'
import { authMiddleware } from '../middleware/auth'

export function scalpingRouter(
  db: Kysely<DB>,
  logger: Logger,
  encKey: string,
  jwtSecret: string,
  jwtRefreshSecret: string,
): Router {
  const r = Router()
  const scalpingService = new ScalpingService(logger)
  const backtestService = new ScalpingBacktestService(logger)
  const bitgetService = new BitgetService(db, logger, encKey)
  const orderService = new ScalpingOrderService(db, logger, bitgetService)
  const strategyService = new ScalpingStrategyService(db, logger)
  const authService = new AuthService(db, logger, jwtSecret, jwtRefreshSecret)
  const botService = new ScalpingBotService(
    logger,
    scalpingService,
    orderService,
    strategyService,
  )

  r.get(
    '/v1/scalping/analyze/:symbol',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/scalping/analyze/:symbol' })
      const startTime = Date.now()

      try {
        const symbol = req.params.symbol.toUpperCase()

        if (!symbol || !symbol.endsWith('USDT')) {
          return res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail:
              'Invalid symbol. Must be a USDT futures pair (e.g., BTCUSDT)',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        log.info({ symbol }, 'Analyzing symbol for scalping')

        const analysis = await scalpingService.analyzeSymbol(symbol)

        const duration = Date.now() - startTime
        log.info(
          {
            symbol,
            hasEntry: !!analysis.recommendedEntry,
            durationMs: duration,
          },
          'Scalping analysis completed',
        )

        return res.json({ analysis })
      } catch (err) {
        const duration = Date.now() - startTime
        log.error(
          {
            err: {
              message: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            },
            durationMs: duration,
          },
          'Failed to analyze symbol',
        )
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Unknown error',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.post(
    '/v1/scalping/backtest',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/scalping/backtest' })
      const startTime = Date.now()

      try {
        const BacktestSchema = z.object({
          symbol: z.string().toUpperCase(),
          period: z
            .enum(['30d', '90d', '180d', '1y'])
            .optional()
            .default('30d'),
          config: z.object({
            initialCapital: z.number().positive(),
            leverage: z.number().positive().max(125),
            riskPerTrade: z.number().min(0).max(1),
            maxCapitalPerPair: z.number().positive(),
            feeRate: z.number().min(0).max(0.01).default(0.001),
            slippageBps: z.number().min(0).max(100).default(5),
          }),
          minConfidence: z.number().min(0).max(1).optional().default(0.6),
          maxOpenPositions: z.number().int().positive().optional().default(3),
        })

        const parsed = BacktestSchema.safeParse(req.body)
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

        const { symbol, period, config, minConfidence, maxOpenPositions } =
          parsed.data

        if (!symbol || !symbol.endsWith('USDT')) {
          return res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail:
              'Invalid symbol. Must be a USDT futures pair (e.g., BTCUSDT)',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        log.info({ symbol, period }, 'Running scalping backtest')

        const result = await backtestService.runBacktest(
          symbol,
          period,
          config,
          minConfidence,
          maxOpenPositions,
        )

        const duration = Date.now() - startTime
        log.info(
          {
            symbol,
            period,
            totalTrades: result.totalTrades,
            totalReturnPct: result.totalReturnPct,
            durationMs: duration,
          },
          'Scalping backtest completed',
        )

        return res.json({ result })
      } catch (err) {
        const duration = Date.now() - startTime
        log.error(
          {
            err: {
              message: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            },
            durationMs: duration,
          },
          'Failed to run scalping backtest',
        )
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Unknown error',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.post(
    '/v1/scalping/backtest/multiple-periods',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger ||
        logger.child({ endpoint: '/v1/scalping/backtest/multiple-periods' })
      const startTime = Date.now()

      try {
        const BacktestSchema = z.object({
          symbol: z.string().toUpperCase(),
          config: z.object({
            initialCapital: z.number().positive(),
            leverage: z.number().positive().max(125),
            riskPerTrade: z.number().min(0).max(1),
            maxCapitalPerPair: z.number().positive(),
            feeRate: z.number().min(0).max(0.01).default(0.001),
            slippageBps: z.number().min(0).max(100).default(5),
          }),
          minConfidence: z.number().min(0).max(1).optional().default(0.6),
          maxOpenPositions: z.number().int().positive().optional().default(3),
        })

        const parsed = BacktestSchema.safeParse(req.body)
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

        const { symbol, config, minConfidence, maxOpenPositions } = parsed.data

        if (!symbol || !symbol.endsWith('USDT')) {
          return res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail:
              'Invalid symbol. Must be a USDT futures pair (e.g., BTCUSDT)',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        log.info({ symbol }, 'Running scalping backtest for multiple periods')

        const results = await backtestService.runMultiplePeriods(
          symbol,
          config,
          minConfidence,
          maxOpenPositions,
        )

        const duration = Date.now() - startTime
        log.info(
          {
            symbol,
            durationMs: duration,
          },
          'Scalping backtest multiple periods completed',
        )

        return res.json({ results })
      } catch (err) {
        const duration = Date.now() - startTime
        log.error(
          {
            err: {
              message: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            },
            durationMs: duration,
          },
          'Failed to run scalping backtest multiple periods',
        )
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Unknown error',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.post(
    '/v1/scalping/place-order',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/scalping/place-order' })
      const startTime = Date.now()

      try {
        const PlaceOrderSchema = z.object({
          symbol: z.string().toUpperCase(),
          capital: z.number().positive(),
          leverage: z.number().positive().max(125),
          analysis: z.any(),
          simulation: z.boolean().default(true),
        })

        const parsed = PlaceOrderSchema.safeParse(req.body)
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

        const { symbol, capital, leverage, analysis, simulation } = parsed.data

        if (!symbol || !symbol.endsWith('USDT')) {
          return res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail: 'Invalid symbol. Must be a USDT futures pair',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        log.info(
          { symbol, capital, leverage, simulation },
          'Placing scalping order',
        )

        const calculatedOrder = await orderService.calculateOrder({
          symbol,
          capital,
          leverage,
          analysis,
          simulation,
        })

        const result = await orderService.placeOrder(
          {
            symbol,
            capital,
            leverage,
            analysis,
            simulation,
          },
          calculatedOrder,
        )

        const duration = Date.now() - startTime
        log.info(
          {
            symbol,
            orderId: result.orderId,
            simulation: result.simulation,
            durationMs: duration,
          },
          'Scalping order processed',
        )

        return res.json({
          order: calculatedOrder,
          result,
        })
      } catch (err) {
        const duration = Date.now() - startTime
        log.error(
          {
            err: {
              message: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            },
            durationMs: duration,
          },
          'Failed to place scalping order',
        )
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Unknown error',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.get(
    '/v1/scalping/strategies',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/scalping/strategies' })
      const userId = req.user!.userId

      try {
        const strategies = await strategyService.list(userId)
        return res.json({ strategies })
      } catch (err) {
        log.error(
          {
            err: {
              message: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            },
          },
          'Failed to list scalping strategies',
        )
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Unknown error',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.post(
    '/v1/scalping/strategies',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/scalping/strategies' })
      const userId = req.user!.userId

      try {
        const Schema = z.object({
          exchange: z.enum(['bitget', 'binance']),
          symbol: z.string().toUpperCase(),
          maxCapital: z.number().positive(),
          leverage: z.number().int().positive().max(125),
          riskPerTrade: z.number().min(0).max(1),
          minConfidence: z.number().min(0).max(1),
          maxOpenPositions: z.number().int().positive(),
          feeRate: z.number().min(0).max(0.01).optional(),
          slippageBps: z.number().int().min(0).max(100).optional(),
        })

        const parsed = Schema.safeParse(req.body)
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

        const strategy = await strategyService.create(userId, parsed.data)

        log.info(
          { strategyId: strategy.id, symbol: strategy.symbol },
          'Scalping strategy created',
        )

        return res.status(201).json({ strategy })
      } catch (err) {
        log.error(
          {
            err: {
              message: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            },
          },
          'Failed to create scalping strategy',
        )
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Unknown error',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.put(
    '/v1/scalping/strategies/:id',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/scalping/strategies/:id' })
      const userId = req.user!.userId
      const id = parseInt(req.params.id)

      if (isNaN(id)) {
        return res.status(400).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
          title: 'Bad Request',
          status: 400,
          detail: 'Invalid strategy ID',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }

      try {
        const Schema = z.object({
          maxCapital: z.number().positive().optional(),
          leverage: z.number().int().positive().max(125).optional(),
          riskPerTrade: z.number().min(0).max(1).optional(),
          minConfidence: z.number().min(0).max(1).optional(),
          maxOpenPositions: z.number().int().positive().optional(),
          isActive: z.boolean().optional(),
          feeRate: z.number().min(0).max(0.01).optional(),
          slippageBps: z.number().int().min(0).max(100).optional(),
        })

        const parsed = Schema.safeParse(req.body)
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

        const strategy = await strategyService.update(userId, id, parsed.data)

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

        log.info({ strategyId: strategy.id }, 'Scalping strategy updated')

        return res.json({ strategy })
      } catch (err) {
        log.error(
          {
            err: {
              message: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            },
          },
          'Failed to update scalping strategy',
        )
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Unknown error',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.delete(
    '/v1/scalping/strategies/:id',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/scalping/strategies/:id' })
      const userId = req.user!.userId
      const id = parseInt(req.params.id)

      if (isNaN(id)) {
        return res.status(400).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
          title: 'Bad Request',
          status: 400,
          detail: 'Invalid strategy ID',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }

      try {
        const deleted = await strategyService.delete(userId, id)

        if (!deleted) {
          return res.status(404).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.4',
            title: 'Not Found',
            status: 404,
            detail: 'Strategy not found',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        log.info({ strategyId: id }, 'Scalping strategy deleted')

        return res.json({ success: true })
      } catch (err) {
        log.error(
          {
            err: {
              message: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            },
          },
          'Failed to delete scalping strategy',
        )
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Unknown error',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  r.post(
    '/v1/scalping/bot/run-cycle',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/scalping/bot/run-cycle' })
      const startTime = Date.now()

      try {
        const result = await botService.runCycle()

        const duration = Date.now() - startTime
        log.info(
          {
            processed: result.processed,
            ordersPlaced: result.ordersPlaced,
            errors: result.errors,
            durationMs: duration,
          },
          'ScalpingBot cycle completed',
        )

        return res.json(result)
      } catch (err) {
        const duration = Date.now() - startTime
        log.error(
          {
            err: {
              message: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            },
            durationMs: duration,
          },
          'Failed to run ScalpingBot cycle',
        )
        return res.status(500).json({
          type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Unknown error',
          instance: req.path,
          correlationId: req.correlationId,
        })
      }
    },
  )

  return r
}
