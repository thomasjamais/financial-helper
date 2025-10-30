import { Router, Request, Response } from 'express'
import { z } from 'zod'
import {
  BinanceAdapter,
  type BinanceConfig,
  type Balance,
} from '@pkg/exchange-adapters'
import { Kysely, sql } from 'kysely'
import { makeEncryptDecrypt } from '../services/crypto'
import { getBinanceConfig, setBinanceConfig } from '../services/binanceState'
import { getActiveExchangeConfig } from '../services/exchangeConfigService'
import { filterBalances } from '../services/balanceFilter'
import { buildPortfolio } from '../services/portfolioService'
import { fetchBinanceEarnBalances } from '../services/earnService'
import {
  calculateConversion,
  type ConversionTarget,
} from '../services/conversionService'
import {
  getRebalancingAdvice,
  OpenAIProvider,
} from '../services/aiPredictionService'
import type { Logger } from '../logger'

export function binanceRouter(
  db: Kysely<unknown>,
  logger: Logger,
  encKey: string,
): Router {
  const r = Router()
  const { encrypt } = makeEncryptDecrypt(encKey)

  r.post('/v1/binance/config', (req: Request, res: Response) => {
    const log = req.logger || logger.child({ endpoint: '/v1/binance/config' })
    log.info('Config update request received')

    const Schema = z.object({
      key: z.string().min(10),
      secret: z.string().min(10),
      env: z.enum(['paper', 'live']).default('paper'),
      baseUrl: z.string().url().optional(),
    })
    const parsed = Schema.safeParse(req.body)
    if (!parsed.success) {
      log.warn({ errors: parsed.error.flatten() }, 'Config validation failed')
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    log.info({ env: parsed.data.env }, 'Setting Binance config')
    setBinanceConfig({
      ...parsed.data,
      baseUrl:
        parsed.data.baseUrl ??
        (parsed.data.env === 'paper'
          ? 'https://testnet.binance.vision'
          : 'https://api.binance.com'),
    })
    const row = {
      exchange: 'binance',
      key_enc: encrypt(parsed.data.key),
      secret_enc: encrypt(parsed.data.secret),
      passphrase_enc: null,
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

  r.get('/v1/binance/balances', async (req: Request, res: Response) => {
    const log = req.logger || logger.child({ endpoint: '/v1/binance/balances' })
    const startTime = Date.now()

    try {
      log.info('Fetching balances')
      let cfg = getBinanceConfig()
      if (!cfg) {
        const dbConfig = await getActiveExchangeConfig(db, encKey, 'binance')
        if (dbConfig) {
          cfg = {
            key: dbConfig.key,
            secret: dbConfig.secret,
            env: dbConfig.env,
            baseUrl: dbConfig.baseUrl || 'https://api.binance.com',
          }
          setBinanceConfig(cfg)
        } else {
          log.warn('Binance config not set')
          return res.status(400).json({ error: 'Binance config not set' })
        }
      }

      log.debug({ env: cfg.env }, 'Creating Binance adapter')
      const adapter = new BinanceAdapter({
        key: cfg.key,
        secret: cfg.secret,
        env: cfg.env,
        baseUrl: cfg.baseUrl,
        logger: {
          debug: (msg: string, data?: unknown) => log.debug(data, msg),
          info: (msg: string, data?: unknown) => log.info(data, msg),
          warn: (msg: string, data?: unknown) => log.warn(data, msg),
          error: (msg: string, data?: unknown) => log.error(data, msg),
        },
      })

      log.debug('Fetching spot balances')
      const spotRaw = await adapter.getBalances('spot')
      log.debug({ count: spotRaw.length }, 'Spot balances fetched')

      log.debug('Skipping futures balances (Spot only)')
      const futuresRaw: Balance[] = []

      const { spot, futures } = filterBalances(spotRaw, futuresRaw)

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
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  })

  r.get('/v1/binance/positions', async (req: Request, res: Response) => {
    const log =
      req.logger || logger.child({ endpoint: '/v1/binance/positions' })
    try {
      let cfg = getBinanceConfig()
      if (!cfg) {
        const dbConfig = await getActiveExchangeConfig(db, encKey, 'binance')
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

      if (!cfg) {
        return res.status(400).json({ error: 'Binance config not set' })
      }

      const adapter = new BinanceAdapter({
        key: cfg.key,
        secret: cfg.secret,
        env: cfg.env,
        baseUrl: cfg.baseUrl,
        logger: {
          debug: (msg: string, data?: unknown) => log.debug(data, msg),
          info: (msg: string, data?: unknown) => log.info(data, msg),
          warn: (msg: string, data?: unknown) => log.warn(data, msg),
          error: (msg: string, data?: unknown) => log.error(data, msg),
        },
      })

      const positions = await adapter.getPositions()
      return res.json({ positions })
    } catch (err) {
      log.error(
        {
          err: {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
        },
        'Failed to fetch positions',
      )
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  })

  r.get('/v1/binance/orders', async (req: Request, res: Response) => {
    const log = req.logger || logger.child({ endpoint: '/v1/binance/orders' })
    try {
      let cfg = getBinanceConfig()
      if (!cfg) {
        const dbConfig = await getActiveExchangeConfig(db, encKey, 'binance')
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

      if (!cfg) {
        return res.status(400).json({ error: 'Binance config not set' })
      }

      const adapter = new BinanceAdapter({
        key: cfg.key,
        secret: cfg.secret,
        env: cfg.env,
        baseUrl: cfg.baseUrl,
        logger: {
          debug: (msg: string, data?: unknown) => log.debug(data, msg),
          info: (msg: string, data?: unknown) => log.info(data, msg),
          warn: (msg: string, data?: unknown) => log.warn(data, msg),
          error: (msg: string, data?: unknown) => log.error(data, msg),
        },
      })

      const status =
        typeof req.query.status === 'string' ? req.query.status : undefined
      const orders = await adapter.listOrders(status)
      return res.json({ orders })
    } catch (err) {
      log.error(
        {
          err: {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
        },
        'Failed to fetch orders',
      )
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  })

  r.get('/v1/binance/portfolio', async (req: Request, res: Response) => {
    const log =
      req.logger || logger.child({ endpoint: '/v1/binance/portfolio' })
    const startTime = Date.now()

    try {
      log.info('Fetching portfolio')
      let cfg = getBinanceConfig()
      if (!cfg) {
        const dbConfig = await getActiveExchangeConfig(db, encKey, 'binance')
        if (dbConfig) {
          cfg = {
            key: dbConfig.key,
            secret: dbConfig.secret,
            env: dbConfig.env,
            baseUrl: dbConfig.baseUrl || 'https://api.binance.com',
          }
          setBinanceConfig(cfg)
        } else {
          log.warn('Binance config not set')
          return res.status(400).json({ error: 'Binance config not set' })
        }
      }

      if (!cfg) {
        return res.status(400).json({ error: 'Binance config not set' })
      }

      const adapter = new BinanceAdapter({
        key: cfg.key,
        secret: cfg.secret,
        env: cfg.env,
        baseUrl: cfg.baseUrl,
        logger: {
          debug: (msg: string, data?: unknown) => log.debug(data, msg),
          info: (msg: string, data?: unknown) => log.info(data, msg),
          warn: (msg: string, data?: unknown) => log.warn(data, msg),
          error: (msg: string, data?: unknown) => log.error(data, msg),
        },
      })

      log.debug('Fetching all spot balances')
      const spotBalances = await adapter.getBalances('spot')
      log.debug({ count: spotBalances.length }, 'All balances fetched')

      const earnBalances = await fetchBinanceEarnBalances()
      const allBalances = [...spotBalances, ...earnBalances]

      const portfolio = await buildPortfolio(allBalances)

      const duration = Date.now() - startTime
      log.info(
        {
          assetCount: portfolio.assets.length,
          totalValueUSD: portfolio.totalValueUSD,
          totalValueEUR: portfolio.totalValueEUR,
          durationMs: duration,
        },
        'Portfolio fetched successfully',
      )

      return res.json(portfolio)
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
        'Failed to fetch portfolio',
      )
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  })

  r.post('/v1/binance/convert', async (req: Request, res: Response) => {
    const log = req.logger || logger.child({ endpoint: '/v1/binance/convert' })
    try {
      const Schema = z.object({
        fromAsset: z.string().min(1),
        fromAmount: z.number().positive(),
        toAsset: z.enum(['BTC', 'BNB', 'ETH']),
      })
      const parsed = Schema.safeParse(req.body)
      if (!parsed.success) {
        log.warn(
          { errors: parsed.error.flatten() },
          'Conversion validation failed',
        )
        return res.status(400).json({ error: parsed.error.flatten() })
      }

      let cfg = getBinanceConfig()
      if (!cfg) {
        const dbConfig = await getActiveExchangeConfig(db, encKey, 'binance')
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

      if (!cfg) {
        return res.status(400).json({ error: 'Binance config not set' })
      }

      const adapter = new BinanceAdapter({
        key: cfg.key,
        secret: cfg.secret,
        env: cfg.env,
        baseUrl: cfg.baseUrl,
        logger: {
          debug: (msg: string, data?: unknown) => log.debug(data, msg),
          info: (msg: string, data?: unknown) => log.info(data, msg),
          warn: (msg: string, data?: unknown) => log.warn(data, msg),
          error: (msg: string, data?: unknown) => log.error(data, msg),
        },
      })

      const balances = await adapter.getBalances('spot')
      const conversion = await calculateConversion(
        balances,
        parsed.data.fromAsset,
        parsed.data.fromAmount,
        parsed.data.toAsset,
      )

      if (!conversion) {
        return res.status(400).json({
          error: 'Conversion failed: insufficient balance or invalid asset',
        })
      }

      log.info('Conversion calculated', {
        fromAsset: conversion.fromAsset,
        toAsset: conversion.toAsset,
        rate: conversion.rate,
      })

      return res.json(conversion)
    } catch (err) {
      log.error(
        {
          err: {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
        },
        'Failed to calculate conversion',
      )
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  })

  r.post('/v1/binance/rebalance', async (req: Request, res: Response) => {
    const log =
      req.logger || logger.child({ endpoint: '/v1/binance/rebalance' })
    try {
      const Schema = z.object({
        targetAllocations: z.record(z.number()).optional(),
      })
      const parsed = Schema.safeParse(req.body)

      let cfg = getBinanceConfig()
      if (!cfg) {
        const dbConfig = await getActiveExchangeConfig(db, encKey, 'binance')
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

      if (!cfg) {
        return res.status(400).json({ error: 'Binance config not set' })
      }

      const adapter = new BinanceAdapter({
        key: cfg.key,
        secret: cfg.secret,
        env: cfg.env,
        baseUrl: cfg.baseUrl,
        logger: {
          debug: (msg: string, data?: unknown) => log.debug(data, msg),
          info: (msg: string, data?: unknown) => log.info(data, msg),
          warn: (msg: string, data?: unknown) => log.warn(data, msg),
          error: (msg: string, data?: unknown) => log.error(data, msg),
        },
      })

      const balances = await adapter.getBalances('spot')
      const portfolio = await buildPortfolio(balances)

      const portfolioData = portfolio.assets.map((asset) => ({
        asset: asset.asset,
        valueUSD: asset.valueUSD,
      }))

      const openaiApiKey = process.env.OPENAI_API_KEY
      const aiProvider = openaiApiKey
        ? new OpenAIProvider(openaiApiKey)
        : undefined

      if (!aiProvider) {
        log.warn('OpenAI API key not found in environment variables')
      }

      const advice = await getRebalancingAdvice({
        portfolio: portfolioData,
        totalValueUSD: portfolio.totalValueUSD,
        aiProvider,
        targetAllocations: parsed.success
          ? parsed.data.targetAllocations
          : undefined,
      })

      log.info('Rebalancing advice generated', {
        suggestionCount: advice.suggestions.length,
        confidence: advice.confidence,
      })

      return res.json(advice)
    } catch (err) {
      log.error(
        {
          err: {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
        },
        'Failed to generate rebalancing advice',
      )
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  })

  return r
}
