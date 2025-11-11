import { Router, type Request, type Response } from 'express'
import type { Logger } from '../logger'
import { authMiddleware } from '../middleware/auth'
import type { AuthService } from '../services/AuthService'
import { z } from 'zod'
import { BacktestRunner } from '@pkg/backtesting-engine'
import { StrategyRegistry } from '@pkg/strategies'
import type { Candle } from '@pkg/backtesting-engine'

export function backtestRouter(
  logger: Logger,
  authService: AuthService,
): Router {
  const r = Router()

  const CandleSchema = z.object({
    open: z.number().positive(),
    high: z.number().positive(),
    low: z.number().positive(),
    close: z.number().positive(),
    volume: z.number().nonnegative(),
    timestamp: z.number().int().positive(),
  })

  const BacktestRequestSchema = z.object({
    strategy: z.string().min(1),
    candles: z.array(CandleSchema).min(1),
    initialCapital: z.number().positive(),
    feeRate: z.number().min(0).max(1),
    slippageBps: z.number().int().min(0).max(10000),
    symbol: z.string().min(1),
    timeframeMs: z.number().int().positive(),
  })

  r.post(
    '/v1/backtest',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/backtest' })

      try {
        // Validate request
        const parsed = BacktestRequestSchema.safeParse(req.body)
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

        const { strategy: strategyName, candles, initialCapital, feeRate, slippageBps, symbol, timeframeMs } =
          parsed.data

        // Load strategy from registry
        let strategy
        try {
          strategy = StrategyRegistry.create(strategyName)
        } catch (error) {
          return res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail: error instanceof Error ? error.message : 'Strategy not found',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        // Sort candles by timestamp to ensure chronological order
        const sortedCandles: Candle[] = [...candles].sort(
          (a, b) => a.timestamp - b.timestamp,
        )

        // Run backtest
        const runner = new BacktestRunner()
        const result = runner.run(strategy, sortedCandles, {
          initialCapital,
          feeRate,
          slippageBps,
          symbol,
          timeframeMs,
        })

        log.info(
          {
            strategy: strategyName,
            symbol,
            totalReturn: result.totalReturn,
            trades: result.trades.length,
          },
          'Backtest completed successfully',
        )

        return res.json({
          totalReturn: result.totalReturn,
          maxDrawdown: result.maxDrawdown,
          finalEquity: result.finalEquity,
          trades: result.trades,
          equityCurve: result.equityCurve,
          benchmarkReturn: result.benchmarkReturn,
        })
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

  return r
}

