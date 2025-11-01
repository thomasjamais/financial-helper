import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { filterBalances } from '../services/balanceFilter'
import { BinanceService } from '../services/BinanceService'
import {
  getRebalancingAdvice,
  OpenAIProvider,
} from '../services/aiPredictionService'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import { sql } from 'kysely'
import { makeEncryptDecrypt } from '../services/crypto'
import { getBinanceConfig, setBinanceConfig } from '../services/binanceState'
import type { Logger } from '../logger'

export function binanceRouter(
  db: Kysely<DB>,
  logger: Logger,
  encKey: string,
): Router {
  const r = Router()
  const { encrypt } = makeEncryptDecrypt(encKey)
  const binanceService = new BinanceService(db, logger, encKey)

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
      const balances = await binanceService.getBalances()
      const { spot, futures } = filterBalances(balances.spot, balances.futures)

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
      const positions = await binanceService.getPositions()
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

  r.get('/v1/binance/portfolio/spot', async (req: Request, res: Response) => {
    const log =
      req.logger || logger.child({ endpoint: '/v1/binance/portfolio/spot' })
    try {
      const balances = await binanceService.getBalances()
      const portfolio = await binanceService.getPortfolio(balances.spot)
      return res.json(portfolio)
    } catch (err) {
      log.error({ err }, 'Failed to build spot portfolio')
      return res.status(500).json({ error: 'Failed to build spot portfolio' })
    }
  })

  r.get('/v1/binance/orders', async (req: Request, res: Response) => {
    const log = req.logger || logger.child({ endpoint: '/v1/binance/orders' })
    try {
      const status =
        typeof req.query.status === 'string' ? req.query.status : undefined
      const orders = await binanceService.getOrders(status)
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
      const portfolio = await binanceService.getPortfolioWithEarn()

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

      const balances = await binanceService.getBalances()
      const conversion = await binanceService.calculateConversion(
        balances.spot,
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
        mode: z.enum(['spot', 'earn', 'overview']).default('overview'),
        targetAllocations: z.record(z.number()).optional(),
      })
      const parsed = Schema.safeParse(req.body)

      const mode = parsed.success ? parsed.data.mode : 'overview'
      let balances: Array<{ asset: string; free: number; locked?: number }> =
        []

      if (mode === 'spot') {
        const spotBalances = await binanceService.getBalances()
        balances = spotBalances.spot
      } else if (mode === 'earn') {
        balances = await binanceService.getEarnBalances()
      } else {
        // overview mode: combine spot and earn
        const spotBalances = await binanceService.getBalances()
        const earnBalances = await binanceService.getEarnBalances()
        balances = [...spotBalances.spot, ...earnBalances]
      }

      const portfolio = await binanceService.getPortfolio(balances)

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

  r.post('/v1/binance/ai/spot-trades', async (req: Request, res: Response) => {
    const log =
      req.logger || logger.child({ endpoint: '/v1/binance/ai/spot-trades' })
    try {
      const balances = await binanceService.getBalances()
      const portfolio = await binanceService.getPortfolio(balances.spot)

      const portfolioData = portfolio.assets.map((asset) => ({
        asset: asset.asset,
        valueUSD: asset.valueUSD,
      }))

      const openaiApiKey = process.env.OPENAI_API_KEY
      const aiProvider = openaiApiKey
        ? new OpenAIProvider(openaiApiKey)
        : undefined
      if (!aiProvider)
        log.warn('OpenAI API key not found in environment variables')

      const advice = await getRebalancingAdvice({
        portfolio: portfolioData,
        totalValueUSD: portfolio.totalValueUSD,
        aiProvider,
        targetAllocations: undefined,
      })

      const recommended = Object.fromEntries(
        (advice.suggestions || []).map((s) => [
          s.asset,
          s.recommendedAllocation,
        ]),
      )

      const trades = await binanceService.getRebalancingTrades(
        portfolioData,
        recommended,
        portfolio.totalValueUSD,
        5,
      )

      return res.json({ advice, trades })
    } catch (err) {
      log.error({ err }, 'Failed to generate AI spot trades')
      return res
        .status(500)
        .json({ error: 'Failed to generate AI spot trades' })
    }
  })

  return r
}
