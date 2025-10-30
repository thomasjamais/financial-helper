import { Router, type Request, type Response } from 'express'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { z } from 'zod'
import { scoreOpportunity } from '@pkg/shared-kernel/src/opportunityScoring'
import { BinanceEarnClient, BinanceHttpClient, BinanceAdapter } from '@pkg/exchange-adapters'
import { getBinanceConfig, setBinanceConfig } from '../services/binanceState'
import { getActiveExchangeConfig } from '../services/exchangeConfigService'
import { buildPortfolio } from '../services/portfolioService'

export function binanceEarnRouter(_db: Kysely<DB>, logger: Logger): Router {
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
        const dbConfig = await getActiveExchangeConfig(
          _db,
          (process as any).env.ENCRYPTION_KEY,
          'binance',
        )
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
        const dbConfig = await getActiveExchangeConfig(
          _db,
          (process as any).env.ENCRYPTION_KEY,
          'binance',
        )
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

      let cfg = getBinanceConfig()
      if (!cfg) {
        const dbConfig = await getActiveExchangeConfig(
          _db,
          (process as any).env.ENCRYPTION_KEY,
          'binance',
        )
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

      // load defaults from settings if fields omitted
      let assetPool = parsed.data.assetPool ?? ['USDT', 'USDC']
      let minApr = parsed.data.minApr ?? 0.03
      let totalPct = parsed.data.totalPct ?? 0.5
      const maxPerProductPct = parsed.data.maxPerProductPct ?? 0.2
      const minAmount = parsed.data.minAmount ?? 5 // ignore tiny lines (<5 units)
      const roundTo = parsed.data.roundTo ?? 0.01 // round to 2 decimals by default

      // If client uses an opportunity fund, it should send adjusted totalPct.

      const http = new BinanceHttpClient({
        key: cfg.key,
        secret: cfg.secret,
        baseUrl: cfg.baseUrl || 'https://api.binance.com',
        env: cfg.env || 'live',
      })
      const earn = new BinanceEarnClient(http)

      // For spot balances, use adapter with config
      const adapter = new BinanceAdapter({
        key: cfg.key,
        secret: cfg.secret,
        baseUrl: cfg.baseUrl || 'https://api.binance.com',
        env: cfg.env || 'live',
      })
      const spot = await adapter.getBalances('spot')
      const stableFree = (
        spot as Array<{ asset: 'USDT' | 'USDC' | string; free: number }>
      )
        .filter((b) =>
          (assetPool as Array<'USDT' | 'USDC'>).includes(b.asset as any),
        )
        .reduce<Record<string, number>>((acc, b) => {
          acc[b.asset] = (acc[b.asset] || 0) + Number(b.free || 0)
          return acc
        }, {})

      const products = (await earn.listProducts())
        .filter(
          (p) =>
            p.type === 'flexible' &&
            p.apr >= minApr &&
            (assetPool as ReadonlyArray<string>).includes(p.asset),
        )
        .sort((a, b) => b.apr - a.apr)

      const plan: Array<{
        productId: string
        asset: string
        apr: number
        amount: number
      }> = []
      for (const asset of assetPool) {
        const free = stableFree[asset] || 0
        if (free <= 0) continue
        const budget = free * totalPct
        let remaining = budget
        const assetProducts = products.filter((p) => p.asset === asset)
        for (const p of assetProducts) {
          if (remaining <= 0) break
          const cap = budget * maxPerProductPct
          let amount = Math.min(cap, remaining)
          // round to step
          amount = Math.floor(amount / roundTo) * roundTo
          if (amount >= minAmount) {
            plan.push({
              productId: p.id,
              asset: p.asset,
              apr: p.apr,
              amount: Number(amount.toFixed(2)),
            })
            remaining -= amount
          }
        }
      }

      const totalPlanned = plan.reduce((s, x) => s + x.amount, 0)
      return res.json({
        assetPool,
        minApr,
        totalPct,
        maxPerProductPct,
        minAmount,
        roundTo,
        spotStable: stableFree,
        selectedProducts: products.map((p) => ({
          id: p.id,
          asset: p.asset,
          apr: p.apr,
        })),
        plan,
        dryRun: true,
        stats: {
          totalPlanned,
        },
      })
    } catch (err) {
      logger.error({ err }, 'Failed to build auto plan')
      return res.status(500).json({ error: 'Failed to build auto plan' })
    }
  })

  const ExecuteSchema = z.object({
    dryRun: z.boolean().default(true),
    plan: z
      .array(
        z.object({
          productId: z.string(),
          asset: z.string(),
          amount: z.number().positive(),
        }),
      )
      .min(1),
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

        let cfg = getBinanceConfig()
        if (!cfg) {
          const dbConfig = await getActiveExchangeConfig(
            _db,
            (process as any).env.ENCRYPTION_KEY,
            'binance',
          )
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

        const { dryRun, plan } = parsed.data
        const http = new BinanceHttpClient({
          key: cfg.key,
          secret: cfg.secret,
          baseUrl: cfg.baseUrl || 'https://api.binance.com',
          env: cfg.env || 'live',
        })
        const earn = new BinanceEarnClient(http)

        // NOTE: Subscription API integration can be added; for now simulate actions
        if (dryRun) {
          return res.json({
            executed: false,
            dryRun: true,
            steps: plan.map((p) => ({ action: 'subscribe', ...p })),
          })
        }

        // Placeholder: in real mode, iterate and call Binance Earn subscribe endpoints
        // For safety until fully implemented, reject non-dry runs
        return res
          .status(501)
          .json({ error: 'Live execution not yet implemented. Use dryRun.' })
      } catch (err) {
        logger.error({ err }, 'Failed to execute auto plan')
        return res.status(500).json({ error: 'Failed to execute auto plan' })
      }
    },
  )

  // Unsubscribe plan: propose redeem amounts for assets with APR below threshold or to free target stable amount
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

        let cfg = getBinanceConfig()
        if (!cfg) {
          const dbConfig = await getActiveExchangeConfig(
            _db,
            (process as any).env.ENCRYPTION_KEY,
            'binance',
          )
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

        const { minApr, targetFreeAmount, assetPool } = parsed.data
        const http = new BinanceHttpClient({
          key: cfg.key,
          secret: cfg.secret,
          baseUrl: cfg.baseUrl || 'https://api.binance.com',
          env: cfg.env || 'live',
        })
        const earn = new BinanceEarnClient(http)

        // approximate positions via earn balances per asset
        const positions = await earn.getEarnBalances()
        const products = (await earn.listProducts()).filter(
          (p) => p.type === 'flexible',
        )
        const assetApr = new Map<string, number>()
        for (const p of products) {
          if (!assetApr.has(p.asset)) assetApr.set(p.asset, p.apr)
          else
            assetApr.set(p.asset, Math.max(assetApr.get(p.asset) || 0, p.apr))
        }

        let remaining = targetFreeAmount
        const plan: Array<{
          asset: string
          amount: number
          reason: string
          apr?: number
        }> = []

        for (const pos of positions) {
          if (!assetPool.includes(pos.asset as any)) continue
          const apr = assetApr.get(pos.asset) || 0
          const amt = Number(pos.free || 0)
          if (amt <= 0) continue
          if (apr < minApr) {
            plan.push({
              asset: pos.asset,
              amount: Number(amt.toFixed(2)),
              reason: 'apr_below_threshold',
              apr,
            })
            remaining -= amt
          }
        }

        if (remaining > 0) {
          // still need to free funds: pick highest APR first but only up to remaining (conservative)
          const candidates = positions
            .filter((p) => assetPool.includes(p.asset as any))
            .map((p) => ({
              asset: p.asset,
              amt: Number(p.free || 0),
              apr: assetApr.get(p.asset) || 0,
            }))
            .sort((a, b) => b.apr - a.apr)
          for (const c of candidates) {
            if (remaining <= 0) break
            if (c.amt <= 0) continue
            const take = Math.min(c.amt, remaining)
            plan.push({
              asset: c.asset,
              amount: Number(take.toFixed(2)),
              reason: 'free_liquidity',
              apr: c.apr,
            })
            remaining -= take
          }
        }

        return res.json({ minApr, targetFreeAmount, plan, dryRun: true })
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
