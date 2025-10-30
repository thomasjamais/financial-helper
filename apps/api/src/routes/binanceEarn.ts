import { Router, type Request, type Response } from 'express'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { z } from 'zod'
import { scoreOpportunity } from '@pkg/shared-kernel/src/opportunityScoring'
import { BinanceEarnClient, BinanceHttpClient } from '@pkg/exchange-adapters'
import { getBinanceConfig, setBinanceConfig } from '../services/binanceState'
import { getActiveExchangeConfig } from '../services/exchangeConfigService'
import { buildPortfolio } from '../services/portfolioService'

export function binanceEarnRouter(
  _db: Kysely<DB>,
  logger: Logger,
): Router {
  const r = Router()

  // Stubbed endpoint: returns empty scored list for now
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

        const ProductSchema = z.object({
          id: z.string(),
          asset: z.string(),
          name: z.string(),
          type: z
            .enum(['flexible', 'locked', 'staking', 'launchpool'])
            .optional(),
          apr: z.number().min(0),
          durationDays: z.number().optional(),
          redeemable: z.boolean(),
        })
        const Output = z.array(
          ProductSchema.extend({ score: z.number().min(0).max(1) }),
        )

        // For now there is no discovery; prepare empty list with validation
        const products: Array<z.infer<typeof ProductSchema>> = []
        const scored = products.map((p) => ({
          ...p,
          score: scoreOpportunity({
            apr: p.apr,
            durationDays: p.durationDays,
            redeemable: p.redeemable,
          }),
        }))
        const filtered = scored.filter((x) => x.score >= minScore)

        const validated = Output.parse(filtered)
        return res.json(validated)
      } catch (err) {
        log.error({ err }, 'Failed to load opportunities')
        return res.status(500).json({ error: 'Failed to load opportunities' })
      }
    },
  )

  r.get('/v1/binance/earn/balances', async (_req: Request, res: Response) => {
    try {
      let cfg = getBinanceConfig()
      if (!cfg) {
        const dbConfig = await getActiveExchangeConfig(_db, (process as any).env.ENCRYPTION_KEY, 'binance')
        if (dbConfig) {
          cfg = {
            key: dbConfig.key,
            secret: dbConfig.secret,
            env: dbConfig.env,
            baseUrl: dbConfig.baseUrl || 'https://api.binance.com',
          }
          setBinanceConfig(cfg)
        } else {
          return res.status(400).json({ error: 'Binance config not set' })
        }
      }

      const http = new BinanceHttpClient({
        key: cfg.key,
        secret: cfg.secret,
        baseUrl: cfg.baseUrl || 'https://api.binance.com',
        env: cfg.env || 'live',
      })
      const client = new BinanceEarnClient(http)
      const earn = await client.getEarnBalances()
      return res.json({ earn })
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch earn balances' })
    }
  })

  r.get('/v1/binance/portfolio/earn', async (_req: Request, res: Response) => {
    try {
      let cfg = getBinanceConfig()
      if (!cfg) {
        const dbConfig = await getActiveExchangeConfig(_db, (process as any).env.ENCRYPTION_KEY, 'binance')
        if (dbConfig) {
          cfg = {
            key: dbConfig.key,
            secret: dbConfig.secret,
            env: dbConfig.env,
            baseUrl: dbConfig.baseUrl || 'https://api.binance.com',
          }
          setBinanceConfig(cfg)
        } else {
          return res.status(400).json({ error: 'Binance config not set' })
        }
      }

      const http = new BinanceHttpClient({
        key: cfg.key,
        secret: cfg.secret,
        baseUrl: cfg.baseUrl || 'https://api.binance.com',
        env: cfg.env || 'live',
      })
      const client = new BinanceEarnClient(http)
      const earn = await client.getEarnBalances()
      const portfolio = await buildPortfolio(earn)
      return res.json(portfolio)
    } catch (err) {
      return res.status(500).json({ error: 'Failed to build earn portfolio' })
    }
  })

  // Auto plan (dry-run): select flexible products over minApr and propose allocations from stablecoin spot balance
  const AutoPlanSchema = z.object({
    assetPool: z.array(z.enum(['USDT', 'USDC'])).default(['USDT', 'USDC']),
    minApr: z.number().min(0).default(0.03),
    totalPct: z.number().min(0).max(1).default(0.5),
    maxPerProductPct: z.number().min(0).max(1).default(0.2),
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

      let cfg = getBinanceConfig()
      if (!cfg) {
        const dbConfig = await getActiveExchangeConfig(_db, (process as any).env.ENCRYPTION_KEY, 'binance')
        if (dbConfig) {
          cfg = {
            key: dbConfig.key,
            secret: dbConfig.secret,
            env: dbConfig.env,
            baseUrl: dbConfig.baseUrl || 'https://api.binance.com',
          }
          setBinanceConfig(cfg)
        } else {
          return res.status(400).json({ error: 'Binance config not set' })
        }
      }

      const { assetPool, minApr, totalPct, maxPerProductPct } = parsed.data

      const http = new BinanceHttpClient({
        key: cfg.key,
        secret: cfg.secret,
        baseUrl: cfg.baseUrl || 'https://api.binance.com',
        env: cfg.env || 'live',
      })
      const earn = new BinanceEarnClient(http)

      // For spot balances, call adapter directly with imports
      const adapter = new (require('@pkg/exchange-adapters').BinanceAdapter)(http)
      const spot = await adapter.getBalances()
      const stableFree = (spot as Array<{ asset: 'USDT' | 'USDC' | string; free: number }>)
        .filter((b) => (assetPool as Array<'USDT'|'USDC'>).includes(b.asset as any))
        .reduce<Record<string, number>>((acc, b) => {
          acc[b.asset] = (acc[b.asset] || 0) + Number(b.free || 0)
          return acc
        }, {})

      const products = (await earn.listProducts())
        .filter((p) => p.type === 'flexible' && p.apr >= minApr && (assetPool as ReadonlyArray<string>).includes(p.asset))
        .sort((a, b) => b.apr - a.apr)

      const plan: Array<{ productId: string; asset: string; apr: number; amount: number }> = []
      for (const asset of assetPool) {
        const free = stableFree[asset] || 0
        if (free <= 0) continue
        const budget = free * totalPct
        let remaining = budget
        const assetProducts = products.filter((p) => p.asset === asset)
        for (const p of assetProducts) {
          if (remaining <= 0) break
          const cap = budget * maxPerProductPct
          const amount = Math.min(cap, remaining)
          if (amount > 0) {
            plan.push({ productId: p.id, asset: p.asset, apr: p.apr, amount: Number(amount.toFixed(2)) })
            remaining -= amount
          }
        }
      }

      return res.json({
        assetPool,
        minApr,
        totalPct,
        maxPerProductPct,
        spotStable: stableFree,
        selectedProducts: products.map(p => ({ id: p.id, asset: p.asset, apr: p.apr })),
        plan,
        dryRun: true,
      })
    } catch (err) {
      logger.error({ err }, 'Failed to build auto plan')
      return res.status(500).json({ error: 'Failed to build auto plan' })
    }
  })

  return r
}
