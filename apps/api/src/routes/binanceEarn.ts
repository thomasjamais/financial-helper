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

  return r
}
