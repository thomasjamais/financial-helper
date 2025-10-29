import { Router, Request, Response } from 'express'
import { z } from 'zod'
import type { Kysely } from 'kysely'
import type { Logger } from '../logger'
import { BinanceEarnClient } from '@pkg/exchange-adapters/src/adapter/binanceEarnClient'

export function binanceEarnRouter(
  _db: Kysely<unknown>,
  logger: Logger,
): Router {
  const r = Router()

  r.get('/v1/binance/earn/products', async (req: Request, res: Response) => {
    const log = req.logger || logger.child({ endpoint: '/v1/binance/earn/products' })
    try {
      const client = new BinanceEarnClient()
      const products = await client.listProducts()

      const ProductSchema = z.object({
        id: z.string(),
        asset: z.string(),
        name: z.string(),
        type: z.enum(['flexible', 'locked', 'staking', 'launchpool']),
        apr: z.number().min(0),
        durationDays: z.number().optional(),
        redeemable: z.boolean(),
      })

      const Output = z.array(ProductSchema)
      const parsed = Output.safeParse(products)
      if (!parsed.success) {
        log.warn({ errors: parsed.error.flatten() }, 'Products validation failed')
        return res.status(500).json({ error: 'Failed to load products' })
      }

      return res.json(parsed.data)
    } catch (err) {
      log.error({ err }, 'Failed to load earn products')
      return res.status(500).json({ error: 'Failed to load products' })
    }
  })

  return r
}


