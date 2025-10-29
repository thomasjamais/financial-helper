import { Router } from 'express'
import { z } from 'zod'
import { Kysely } from 'kysely'
import type { Logger } from '../logger'
import {
  createInteraction,
  listInteractionsByCorrelationId,
  type CreateInteractionInput,
} from '../services/aiInteractionService'

export function aiInteractionsRouter(db: Kysely<unknown>, logger: Logger) {
  const r = Router()

  const CreateSchema = z.object({
    repoOwner: z.string().min(1),
    repoName: z.string().min(1),
    agentRole: z.string().min(1),
    direction: z.enum(['user', 'assistant', 'system', 'event']),
    content: z.string().min(1),
    correlationId: z.string().optional(),
    issueNumber: z.number().int().optional(),
    prNumber: z.number().int().optional(),
    metadata: z.record(z.unknown()).optional(),
    tags: z.array(z.string()).optional(),
  })

  r.post('/v1/ai/interactions', async (req, res) => {
    const parsed = CreateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    const input = parsed.data
    const correlationId = input.correlationId || req.correlationId || ''
    if (!correlationId) {
      return res
        .status(400)
        .json({ error: 'Missing correlationId and none available in request' })
    }

    try {
      const record = await createInteraction(db, {
        ...(input as Omit<CreateInteractionInput, 'correlationId'>),
        correlationId,
      })
      return res.status(201).json(record)
    } catch (err) {
      req.logger?.error({ err }, 'Failed to create interaction')
      return res.status(500).json({ error: 'Failed to create interaction' })
    }
  })

  r.get('/v1/ai/interactions/:correlationId', async (req, res) => {
    const { correlationId } = req.params
    const limit = Number(req.query.limit ?? '200')

    if (!correlationId) return res.status(400).json({ error: 'Missing id' })

    try {
      const items = await listInteractionsByCorrelationId(db, correlationId, isNaN(limit) ? 200 : limit)
      return res.json({ items })
    } catch (err) {
      req.logger?.error({ err }, 'Failed to list interactions')
      return res.status(500).json({ error: 'Failed to list interactions' })
    }
  })

  return r
}
