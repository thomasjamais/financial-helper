import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { filterBalances } from '../services/balanceFilter'
import { BitgetService } from '../services/BitgetService'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import { sql } from 'kysely'
import { makeEncryptDecrypt } from '../services/crypto'
import { getBitgetConfig, setBitgetConfig } from '../services/bitgetState'
import type { Logger } from '../logger'
import { authMiddleware } from '../middleware/auth'
import type { AuthService } from '../services/AuthService'

export function bitgetRouter(
  db: Kysely<DB>,
  logger: Logger,
  encKey: string,
  authService: AuthService,
): Router {
  const r = Router()
  const { encrypt } = makeEncryptDecrypt(encKey)
  const bitgetService = new BitgetService(db, logger, encKey)

  r.post('/v1/bitget/config', (req: Request, res: Response) => {
    const log = req.logger || logger.child({ endpoint: '/v1/bitget/config' })
    log.info('Config update request received')

    const Schema = z.object({
      key: z.string().min(10),
      secret: z.string().min(10),
      passphrase: z.string().min(1),
      env: z.enum(['paper', 'live']).default('paper'),
      baseUrl: z.string().url().optional(),
    })
    const parsed = Schema.safeParse(req.body)
    if (!parsed.success) {
      log.warn({ errors: parsed.error.flatten() }, 'Config validation failed')
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    log.info({ env: parsed.data.env }, 'Setting Bitget config')
    setBitgetConfig({
      ...parsed.data,
      baseUrl: parsed.data.baseUrl ?? 'https://api.bitget.com',
    })
    const row = {
      exchange: 'bitget',
      key_enc: encrypt(parsed.data.key),
      secret_enc: encrypt(parsed.data.secret),
      passphrase_enc: parsed.data.passphrase
        ? encrypt(parsed.data.passphrase)
        : null,
      env: parsed.data.env,
    }

    sql`
      create table if not exists demo_api_creds(
        id serial primary key,
        exchange text not null,
        key_enc text not null,
        secret_enc text not null,
        passphrase_enc text,
        env text not null,
        created_at timestamptz not null default now()
      )
    `
      .execute(db)
      .then(() =>
        sql`
          insert into demo_api_creds(exchange,key_enc,secret_enc,passphrase_enc,env)
          values (${row.exchange},${row.key_enc},${row.secret_enc},${row.passphrase_enc},${row.env})
        `.execute(db),
      )
      .then(() => {
        log.info('Config saved to database')
      })
      .catch((err: unknown) => {
        log.error(
          {
            err: {
              message: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            },
          },
          'Failed to save config to database',
        )
      })

    log.info('Config update successful')
    return res.json({ ok: true })
  })

  r.get('/v1/balances', async (req: Request, res: Response) => {
    const log = req.logger || logger.child({ endpoint: '/v1/balances' })
    const startTime = Date.now()

    try {
      log.info('Fetching balances')
      const balances = await bitgetService.getBalances()
      const { spot, futures } = filterBalances(
        balances.spot,
        balances.futures,
      )

      const duration = Date.now() - startTime
      log.info(
        {
          spotCount: spot.length,
          futuresCount: futures.length,
          durationMs: duration,
        },
        'Balances fetched successfully',
      )

      return res.json({ spot, futures })
    } catch (err) {
      const duration = Date.now() - startTime
      log.error(
        {
          err: {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
          durationMs: duration,
        },
        'Failed to fetch balances',
      )
      return res.status(500).json({
        error: 'Failed to fetch balances',
        correlationId: req.correlationId,
      })
    }
  })

  r.get('/v1/positions', async (req: Request, res: Response) => {
    const log = req.logger || logger.child({ endpoint: '/v1/positions' })
    const startTime = Date.now()

    try {
      log.info('Fetching positions')
      const positions = await bitgetService.getPositions()

      const duration = Date.now() - startTime
      log.info(
        { count: positions.length, durationMs: duration },
        'Positions fetched successfully',
      )

      return res.json({ positions })
    } catch (err) {
      const duration = Date.now() - startTime
      log.error(
        {
          err: {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
          durationMs: duration,
        },
        'Failed to fetch positions',
      )
      return res.status(500).json({
        error: 'Failed to fetch positions',
        correlationId: req.correlationId,
      })
    }
  })

  r.post('/v1/orders', async (req: Request, res: Response) => {
    const log = req.logger || logger.child({ endpoint: '/v1/orders' })
    const startTime = Date.now()

    try {
      log.info('Order placement request received')

      const PlaceOrderSchema = z.object({
        symbol: z.string().toUpperCase(),
        side: z.enum(['BUY', 'SELL']),
        type: z.enum(['MARKET', 'LIMIT']),
        qty: z.number().positive(),
        price: z.number().positive().optional(),
        clientOid: z
          .string()
          .min(1)
          .default(() => `oid_${Date.now()}`),
      })
      const parsed = PlaceOrderSchema.safeParse(req.body)
      if (!parsed.success) {
        log.warn(
          { errors: parsed.error.flatten() },
          'Order validation failed',
        )
        return res.status(400).json({ error: parsed.error.flatten() })
      }

      log.info({ order: parsed.data }, 'Validated order request')

      const order = await bitgetService.placeOrder(parsed.data)

      const duration = Date.now() - startTime
      log.info(
        { orderId: order.id, symbol: order.symbol, durationMs: duration },
        'Order placed successfully',
      )

      return res.status(201).json(order)
    } catch (err) {
      const duration = Date.now() - startTime
      log.error(
        {
          err: {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
          durationMs: duration,
        },
        'Failed to place order',
      )

      const msg = err instanceof Error ? err.message : String(err)
      return res
        .status(400)
        .json({ error: msg, correlationId: req.correlationId })
    }
  })

  r.get(
    '/v1/bitget/futures-symbols',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/bitget/futures-symbols' })
      const startTime = Date.now()

      try {
        log.info('Fetching Bitget futures symbols')
        const symbols = await bitgetService.getFuturesSymbols()

      const duration = Date.now() - startTime
      log.info(
        { count: symbols.length, durationMs: duration },
        'Futures symbols fetched successfully',
      )

      return res.json({ symbols })
    } catch (err) {
      const duration = Date.now() - startTime
      log.error(
        {
          err: {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
          durationMs: duration,
        },
        'Failed to fetch futures symbols',
      )
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Unknown error',
        correlationId: req.correlationId,
      })
    }
  },
  )

  return r
}
