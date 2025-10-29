import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Kysely } from 'kysely'
import type { Logger } from '../logger'
import {
  listExchangeConfigs,
  getExchangeConfig,
  createExchangeConfig,
  updateExchangeConfig,
  deleteExchangeConfig,
  activateExchangeConfig,
} from '../services/exchangeConfigService'
import { setBitgetConfig } from '../services/bitgetState'
import { setBinanceConfig } from '../services/binanceState'

export function exchangeConfigsRouter(
  db: Kysely<unknown>,
  logger: Logger,
  encKey: string,
): Router {
  const r = Router()

  r.get('/v1/exchange-configs', async (req: Request, res: Response) => {
    const log = req.logger || logger.child({ endpoint: '/v1/exchange-configs' })
    try {
      const configs = await listExchangeConfigs(db, encKey)
      log.info({ count: configs.length }, 'Exchange configs listed')
      return res.json({ configs })
    } catch (err) {
      log.error(
        {
          err: {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
        },
        'Failed to list exchange configs',
      )
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  })

  r.get('/v1/exchange-configs/:id', async (req: Request, res: Response) => {
    const log =
      req.logger || logger.child({ endpoint: '/v1/exchange-configs/:id' })
    try {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' })
      }

      const config = await getExchangeConfig(db, encKey, id)
      if (!config) {
        return res.status(404).json({ error: 'Config not found' })
      }

      log.info({ id }, 'Exchange config retrieved')
      return res.json({ config })
    } catch (err) {
      log.error(
        {
          err: {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
        },
        'Failed to get exchange config',
      )
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  })

  r.post('/v1/exchange-configs', async (req: Request, res: Response) => {
    const log = req.logger || logger.child({ endpoint: '/v1/exchange-configs' })
    try {
      const Schema = z.object({
        exchange: z.enum(['bitget', 'binance']),
        label: z.string().min(1),
        key: z.string().min(10),
        secret: z.string().min(10),
        passphrase: z.string().optional(),
        env: z.enum(['paper', 'live']).default('paper'),
        baseUrl: z.string().url().optional(),
      })

      const parsed = Schema.safeParse(req.body)
      if (!parsed.success) {
        log.warn({ errors: parsed.error.flatten() }, 'Validation failed')
        return res.status(400).json({ error: parsed.error.flatten() })
      }

      const config = await createExchangeConfig(db, encKey, parsed.data)
      log.info(
        { id: config.id, exchange: config.exchange },
        'Exchange config created',
      )
      return res.status(201).json({ config })
    } catch (err) {
      log.error(
        {
          err: {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
        },
        'Failed to create exchange config',
      )
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  })

  r.put('/v1/exchange-configs/:id', async (req: Request, res: Response) => {
    const log =
      req.logger || logger.child({ endpoint: '/v1/exchange-configs/:id' })
    try {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' })
      }

      const Schema = z.object({
        label: z.string().min(1).optional(),
        key: z.string().min(10).optional(),
        secret: z.string().min(10).optional(),
        passphrase: z.string().optional(),
        env: z.enum(['paper', 'live']).optional(),
        baseUrl: z.string().url().optional(),
        isActive: z.boolean().optional(),
      })

      const parsed = Schema.safeParse(req.body)
      if (!parsed.success) {
        log.warn({ errors: parsed.error.flatten() }, 'Validation failed')
        return res.status(400).json({ error: parsed.error.flatten() })
      }

      const config = await updateExchangeConfig(db, encKey, id, parsed.data)
      if (!config) {
        return res.status(404).json({ error: 'Config not found' })
      }

      log.info({ id }, 'Exchange config updated')
      return res.json({ config })
    } catch (err) {
      log.error(
        {
          err: {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
        },
        'Failed to update exchange config',
      )
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  })

  r.delete('/v1/exchange-configs/:id', async (req: Request, res: Response) => {
    const log =
      req.logger || logger.child({ endpoint: '/v1/exchange-configs/:id' })
    try {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' })
      }

      const deleted = await deleteExchangeConfig(db, id)
      if (!deleted) {
        return res.status(404).json({ error: 'Config not found' })
      }

      log.info({ id }, 'Exchange config deleted')
      return res.json({ ok: true })
    } catch (err) {
      log.error(
        {
          err: {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
        },
        'Failed to delete exchange config',
      )
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  })

  r.post(
    '/v1/exchange-configs/:id/activate',
    async (req: Request, res: Response) => {
      const log =
        req.logger ||
        logger.child({ endpoint: '/v1/exchange-configs/:id/activate' })
      try {
        const id = parseInt(req.params.id, 10)
        if (isNaN(id)) {
          return res.status(400).json({ error: 'Invalid ID' })
        }

        const activated = await activateExchangeConfig(db, encKey, id)
        if (!activated) {
          return res.status(404).json({ error: 'Config not found' })
        }

        // Update in-memory state for immediate use
        if (activated.exchange === 'bitget') {
          setBitgetConfig({
            key: activated.key,
            secret: activated.secret,
            passphrase: activated.passphrase || '',
            env: activated.env,
            baseUrl: activated.baseUrl || 'https://api.bitget.com',
          })
        } else if (activated.exchange === 'binance') {
          setBinanceConfig({
            key: activated.key,
            secret: activated.secret,
            env: activated.env,
            baseUrl: activated.baseUrl || 'https://api.binance.com',
          })
        }

        log.info(
          { id, exchange: activated.exchange },
          'Exchange config activated',
        )
        return res.json({ ok: true, config: activated })
      } catch (err) {
        log.error(
          {
            err: {
              message: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            },
          },
          'Failed to activate exchange config',
        )
        return res.status(500).json({
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    },
  )

  return r
}
