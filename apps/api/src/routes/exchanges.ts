import { Router } from 'express'
import { z } from 'zod'

export function exchangesRouter(): Router {
  const r = Router()
  const LinkSchema = z.object({
    exchange: z.literal('bitget'),
    key: z.string(),
    secret: z.string(),
    passphrase: z.string().optional(),
    env: z.enum(['paper', 'live']).default('paper'),
  })
  r.post('/v1/exchanges', (req, res) => {
    const parsed = LinkSchema.safeParse(req.body)
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() })
    return res.status(201).json({ id: 'ex_1', ...parsed.data })
  })
  return r
}
