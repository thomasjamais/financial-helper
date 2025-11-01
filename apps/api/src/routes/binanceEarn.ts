import { Router, type Request, type Response } from 'express'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { z } from 'zod'
import { BinanceEarnService } from '../services/BinanceEarnService'

export function binanceEarnRouter(
  db: Kysely<DB>,
  logger: Logger,
  encKey: string,
): Router {
  const r = Router()
  const earnService = new BinanceEarnService(db, logger, encKey)

  r.get(
    '/v1/binance/earn/opportunities',
    async (req: Request, res: Response) => {
      const log =
        req.logger ||
        logger.child({ endpoint: '/v1/binance/earn/opportunities' })
      try {
        const minScore =
          typeof req.query.minScore === 'string'
            ? Number(req.query.minScore)
            : 0

        const opportunities = await earnService.listOpportunities(minScore)
        return res.json(opportunities)
      } catch (err) {
        log.error({ err }, 'Failed to load opportunities')
        return res.status(500).json({ error: 'Failed to load opportunities' })
      }
    },
  )

  r.get('/v1/binance/earn/balances', async (_req: Request, res: Response) => {
    try {
      const earn = await earnService.getEarnBalances()
      return res.json({ earn })
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch earn balances' })
    }
  })

  r.get('/v1/binance/portfolio/earn', async (_req: Request, res: Response) => {
    try {
      const portfolio = await earnService.getEarnPortfolio()
      return res.json(portfolio)
    } catch (err) {
      return res.status(500).json({ error: 'Failed to build earn portfolio' })
    }
  })

  const AutoPlanSchema = z.object({
    assetPool: z.array(z.enum(['USDT', 'USDC'])).optional(),
    minApr: z.number().min(0).optional(),
    totalPct: z.number().min(0).max(1).optional(),
    maxPerProductPct: z.number().min(0).max(1).optional(),
    minAmount: z.number().min(0).optional(),
    roundTo: z.number().min(0).optional(),
  })

  r.post('/v1/binance/earn/auto/plan', async (req: Request, res: Response) => {
    try {
      const parsed = AutoPlanSchema.safeParse(req.body)
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

      const plan = await earnService.generateAutoPlan(parsed.data)
      return res.json(plan)
    } catch (err) {
      logger.error({ err }, 'Failed to build auto plan')
      return res.status(500).json({ error: 'Failed to build auto plan' })
    }
  })

  const ExecuteSchema = z.object({
    dryRun: z.boolean().default(true),
    confirm: z.boolean().default(false),
    plan: z
      .array(
        z.object({
          productId: z.string(),
          asset: z.string(),
          amount: z.number().positive(),
        }),
      )
      .default([]),
  })

  r.post(
    '/v1/binance/earn/auto/execute',
    async (req: Request, res: Response) => {
      try {
        const parsed = ExecuteSchema.safeParse(req.body)
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

        if (!parsed.data.dryRun && parsed.data.plan.length === 0) {
          return res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail: 'plan is required when dryRun=false',
            instance: req.path,
            correlationId: req.correlationId,
          })
        }

        const result = await earnService.executeAutoPlan(
          parsed.data.plan,
          parsed.data.dryRun,
          parsed.data.confirm,
        )

        return res.json(result)
      } catch (err) {
        logger.error({ err }, 'Failed to execute auto plan')
        return res.status(500).json({ error: 'Failed to execute auto plan' })
      }
    },
  )

  const UnsubPlanSchema = z.object({
    minApr: z.number().min(0).default(0.02),
    targetFreeAmount: z.number().min(0).default(0),
    assetPool: z.array(z.enum(['USDT', 'USDC'])).default(['USDT', 'USDC']),
  })

  r.post(
    '/v1/binance/earn/auto/unsubscribe/plan',
    async (req: Request, res: Response) => {
      try {
        const parsed = UnsubPlanSchema.safeParse(req.body)
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

        const plan = await earnService.generateUnsubscribePlan(parsed.data)
        return res.json(plan)
      } catch (err) {
        logger.error({ err }, 'Failed to build unsubscribe plan')
        return res
          .status(500)
          .json({ error: 'Failed to build unsubscribe plan' })
      }
    },
  )

  return r
}
