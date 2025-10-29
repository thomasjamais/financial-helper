import { Router, type Request, type Response } from 'express'
import type { Kysely } from 'kysely'
import type { Logger } from '../logger'
import { z } from 'zod'
import { scoreOpportunity } from '@pkg/shared-kernel/src/opportunityScoring'

export function binanceEarnRouter(
  _db: Kysely<unknown>,
  logger: Logger,
): Router {
  const r = Router()

  // Stubbed endpoint: returns empty scored list for now
  r.get('/v1/binance/earn/opportunities', async (req: Request, res: Response) => {
    const log = req.logger || logger.child({ endpoint: '/v1/binance/earn/opportunities' })
    try {
      const minScore = typeof req.query.minScore === 'string' ? Number(req.query.minScore) : 0

      const ProductSchema = z.object({
        id: z.string(),
        asset: z.string(),
        name: z.string(),
        type: z.enum(['flexible', 'locked', 'staking', 'launchpool']).optional(),
        apr: z.number().min(0),
        durationDays: z.number().optional(),
        redeemable: z.boolean(),
      })
      const Output = z.array(ProductSchema.extend({ score: z.number().min(0).max(1) }))

      // For now there is no discovery; prepare empty list with validation
      const products: Array<z.infer<typeof ProductSchema>> = []
      const scored = products.map((p) => ({
        ...p,
        score: scoreOpportunity({ apr: p.apr, durationDays: p.durationDays, redeemable: p.redeemable }),
      }))
      const filtered = scored.filter((x) => x.score >= minScore)

      const validated = Output.parse(filtered)
      return res.json(validated)
    } catch (err) {
      log.error({ err }, 'Failed to load opportunities')
      return res.status(500).json({ error: 'Failed to load opportunities' })
    }
  })

  return r
}


