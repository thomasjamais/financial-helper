import { Router, type Request, type Response } from 'express'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { authMiddleware } from '../middleware/auth'
import type { AuthService } from '../services/AuthService'
import { z } from 'zod'
import { BinanceAdapter, BinanceHttpClient } from '@pkg/exchange-adapters'
import { getActiveExchangeConfig } from '../services/exchangeConfigService'
import { getBinanceConfig, setBinanceConfig } from '../services/binanceState'
import { sql } from 'kysely'

export function tradeIdeasRouter(
  _db: Kysely<DB>,
  logger: Logger,
  authService: AuthService,
): Router {
  const r = Router()

  const IdeaSchema = z.object({
    exchange: z.string().default('binance'),
    symbol: z.string(),
    side: z.enum(['BUY', 'SELL']),
    score: z.number().min(0).max(1),
    reason: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })

  r.post(
    '/v1/trade-ideas',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/trade-ideas' })
      try {
        const parsed = IdeaSchema.safeParse(req.body)
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

        const d = parsed.data
        // normalize metadata
        let metadataObj: any = d.metadata ?? null
        if (typeof metadataObj === 'string') {
          try {
            metadataObj = JSON.parse(metadataObj)
          } catch {
            metadataObj = null
          }
        }
        const historyEntry = {
          ts: new Date().toISOString(),
          side: d.side,
          score: d.score,
          reason: d.reason ?? null,
          metadata: metadataObj,
        }

        await sql`
          insert into trade_ideas
            (user_id, exchange, symbol, side, score, reason, metadata, history)
          values
            (${req.user!.userId}, ${d.exchange}, ${d.symbol}, ${d.side}, ${d.score}, ${d.reason ?? null}, ${JSON.stringify(metadataObj)}::jsonb, ${JSON.stringify([historyEntry])}::jsonb)
          on conflict (user_id, exchange, symbol)
          do update set
            side = excluded.side,
            score = excluded.score,
            reason = excluded.reason,
            metadata = excluded.metadata,
            history = (
              case
                when jsonb_typeof(trade_ideas.history) = 'array' then trade_ideas.history
                else '[]'::jsonb
              end
            ) || excluded.history
        `.execute(_db)

        return res.json({ ok: true })
      } catch (err) {
        log.error({ err }, 'Failed to accept trade idea')
        return res.status(500).json({ error: 'Failed to accept trade idea' })
      }
    },
  )

  r.get(
    '/v1/trade-ideas',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      try {
        const rows = await _db
          .selectFrom('trade_ideas')
          .select([
            'id',
            'exchange',
            'symbol',
            'side',
            'score',
            'reason',
            'metadata',
            'created_at',
            'history',
          ])
          .where('user_id', '=', req.user!.userId)
          .orderBy('created_at', 'desc')
          .limit(200)
          .execute()
        return res.json(rows)
      } catch (err) {
        return res.status(500).json({ error: 'Failed to list trade ideas' })
      }
    },
  )

  // Recompute latest trade ideas by scanning Binance 24h tickers (top movers)
  r.post(
    '/v1/trade-ideas/refresh',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log = req.logger || logger.child({ endpoint: '/v1/trade-ideas/refresh' })
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000)
        const resp = await fetch('https://api.binance.com/api/v3/ticker/24hr', { signal: controller.signal })
        clearTimeout(timeout)
        if (!resp.ok) return res.status(502).json({ error: 'Failed to fetch tickers' })
        const tickers = (await resp.json()) as any[]
        const movers = (Array.isArray(tickers) ? tickers : [])
          .filter((t: any) => typeof t.symbol === 'string' && t.symbol.endsWith('USDT'))
          .map((t: any) => ({ symbol: t.symbol as string, change: Number(t.priceChangePercent) }))
          .filter((t: any) => isFinite(t.change))
          .sort((a: any, b: any) => Math.abs(b.change) - Math.abs(a.change))
          .slice(0, 10)

        const userId = req.user!.userId
        const nowIso = new Date().toISOString()
        let count = 0
        await Promise.all(
          movers.map(async (m) => {
            const side = m.change >= 0 ? 'BUY' : 'SELL'
            const score = Math.min(1, Math.abs(m.change) / 25)
            const historyEntry = {
              ts: nowIso,
              side,
              score,
              reason: `24h change ${m.change.toFixed(2)}%`,
              metadata: { changePct: m.change },
            }
            await sql`
              insert into trade_ideas
                (user_id, exchange, symbol, side, score, reason, metadata, history)
              values
                (${userId}, ${'binance'}, ${m.symbol}, ${side}, ${score}, ${`24h change ${m.change.toFixed(2)}%`}, ${JSON.stringify({ changePct: m.change })}::jsonb, ${JSON.stringify([historyEntry])}::jsonb)
              on conflict (user_id, exchange, symbol)
              do update set
                side = excluded.side,
                score = excluded.score,
                reason = excluded.reason,
                metadata = excluded.metadata,
                history = (
                  case when jsonb_typeof(trade_ideas.history) = 'array' then trade_ideas.history else '[]'::jsonb end
                ) || excluded.history
            `.execute(_db)
            count += 1
          }),
        )
        return res.json({ ok: true, count })
      } catch (err) {
        log.error({ err, correlationId: req.correlationId }, 'Failed to refresh trade ideas')
        return res.status(500).json({ error: 'Failed to refresh trade ideas' })
      }
    },
  )

  const ExecSchema = z.object({
    confirm: z.boolean().default(false),
    budgetUSD: z.number().min(10).default(50),
    risk: z.enum(['moderate']).default('moderate'),
  })

  r.post(
    '/v1/trade-ideas/:id/execute',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/trade-ideas/:id/execute' })
      try {
        const parsed = ExecSchema.safeParse(req.body)
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

        const ideaId = Number(req.params.id)
        const idea = await _db
          .selectFrom('trade_ideas')
          .selectAll()
          .where('id', '=', ideaId)
          .where('user_id', '=', req.user!.userId)
          .executeTakeFirst()

        if (!idea) return res.status(404).json({ error: 'Idea not found' })

        const budget = parsed.data.budgetUSD
        const sym = idea.symbol
        const resp = await fetch(
          `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(sym)}`,
        )
        if (!resp.ok)
          return res.status(502).json({ error: 'Failed to fetch price' })
        const { price } = (await resp.json()) as { price: string }
        const px = Number(price)
        if (!isFinite(px) || px <= 0)
          return res.status(502).json({ error: 'Invalid price' })

        const quantity = budget / px
        const tpPct = 0.04
        const slPct = 0.02

        const inserted = await _db
          .insertInto('trades')
          .values({
            user_id: req.user!.userId,
            idea_id: ideaId,
            exchange: idea.exchange,
            symbol: idea.symbol,
            side: idea.side,
            budget_usd: budget,
            quantity,
            entry_price: px,
            tp_pct: tpPct,
            sl_pct: slPct,
            status: 'simulated',
            metadata: { risk: parsed.data.risk } as any,
          })
          .returning(['id'])
          .executeTakeFirst()

        return res.json({ executed: true, tradeId: inserted?.id })
      } catch (err) {
        log.error({ err }, 'Failed to execute idea')
        return res.status(500).json({ error: 'Failed to execute idea' })
      }
    },
  )

  r.get(
    '/v1/trades',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      try {
        const rows = await _db
          .selectFrom('trades')
          .select([
            'id',
            'idea_id',
            'exchange',
            'symbol',
            'side',
            'budget_usd',
            'quantity',
            'entry_price',
            'tp_pct',
            'sl_pct',
            'status',
            'opened_at',
            'closed_at',
            'pnl_usd',
            'metadata',
          ])
          .where('user_id', '=', req.user!.userId)
          .orderBy('opened_at', 'desc')
          .limit(200)
          .execute()
        return res.json(rows)
      } catch (err) {
        return res.status(500).json({ error: 'Failed to list trades' })
      }
    },
  )

  r.post(
    '/v1/trades/:id/snapshot',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      try {
        const tradeId = Number(req.params.id)
        const trade = await _db
          .selectFrom('trades')
          .selectAll()
          .where('id', '=', tradeId)
          .where('user_id', '=', req.user!.userId)
          .executeTakeFirst()
        if (!trade) return res.status(404).json({ error: 'Trade not found' })
        const resp = await fetch(
          `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(trade.symbol)}`,
        )
        if (!resp.ok)
          return res.status(502).json({ error: 'Failed to fetch price' })
        const { price } = (await resp.json()) as any
        const mark = Number(price)
        if (!isFinite(mark))
          return res.status(502).json({ error: 'Invalid price' })
        const direction = trade.side === 'BUY' ? 1 : -1
        const pnl =
          direction *
          (mark - Number(trade.entry_price)) *
          Number(trade.quantity)
        await _db
          .insertInto('trade_pnl')
          .values({ trade_id: tradeId, mark_price: mark, pnl_usd: pnl })
          .execute()
        return res.json({ ok: true, mark, pnl: Number(pnl.toFixed(2)) })
      } catch (err) {
        return res.status(500).json({ error: 'Failed to record snapshot' })
      }
    },
  )

  r.get(
    '/v1/trades/with-pnl',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      let rows: any[] | null = null
      try {
        rows = await _db
          .selectFrom('trades')
          .select([
            'id',
            'idea_id',
            'exchange',
            'symbol',
            'side',
            'budget_usd',
            'quantity',
            'entry_price',
            'tp_pct',
            'sl_pct',
            'status',
            'opened_at',
            'closed_at',
            'pnl_usd',
            'metadata',
          ])
          .where('user_id', '=', req.user!.userId)
          .orderBy('opened_at', 'desc')
          .limit(200)
          .execute()

        // Default response if anything fails below
        const fallback = rows.map((r) => ({
          ...r,
          markPrice: null,
          pnl_unrealized: null,
        }))

        try {
          // Fetch current prices for unique symbols from Binance
          const symbols = Array.from(new Set(rows.map((r) => r.symbol)))
          const priceMap = new Map<string, number>()
          await Promise.all(
            symbols.map(async (sym) => {
              try {
                const resp = await fetch(
                  `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(sym)}`,
                )
                if (resp.ok) {
                  const { price } = (await resp.json()) as any
                  const px = Number(price)
                  if (isFinite(px)) priceMap.set(sym, px)
                }
              } catch (e) {
                // ignore per-symbol errors
              }
            }),
          )

          const enriched = rows.map((r) => {
            const mark = priceMap.get(r.symbol)
            if (!mark) return { ...r, markPrice: null, pnl_unrealized: null }
            const direction = r.side === 'BUY' ? 1 : -1
            const pnl =
              direction * (mark - Number(r.entry_price)) * Number(r.quantity)
            return {
              ...r,
              markPrice: mark,
              pnl_unrealized: Number(pnl.toFixed(2)),
            }
          })
          return res.json(enriched)
        } catch (innerErr) {
          req.logger?.warn(
            { err: innerErr, correlationId: req.correlationId },
            'PnL enrichment failed, returning fallback',
          )
          return res.json(fallback)
        }
      } catch (err) {
        if (rows !== null) {
          const safeFallback = rows.map((r) => ({
            ...r,
            markPrice: null,
            pnl_unrealized: null,
          }))
          req.logger?.warn(
            { err, correlationId: req.correlationId },
            'PnL route outer catch, returning safe fallback',
          )
          return res.json(safeFallback)
        }
        req.logger?.error(
          { err, correlationId: req.correlationId },
          'Failed to compute PnL',
        )
        return res.status(500).json({ error: 'Failed to compute PnL' })
      }
    },
  )

  r.get(
    '/v1/trades/:id',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      try {
        const tradeId = Number(req.params.id)
        const trade = await _db
          .selectFrom('trades')
          .selectAll()
          .where('id', '=', tradeId)
          .where('user_id', '=', req.user!.userId)
          .executeTakeFirst()
        if (!trade) return res.status(404).json({ error: 'Trade not found' })
        const history = await _db
          .selectFrom('trade_pnl')
          .selectAll()
          .where('trade_id', '=', tradeId)
          .orderBy('ts', 'desc')
          .limit(200)
          .execute()
        return res.json({ trade, history })
      } catch (err) {
        return res.status(500).json({ error: 'Failed to load trade detail' })
      }
    },
  )

  r.post(
    '/v1/trade-ideas/refresh',
    authMiddleware(authService, logger),
    async (req: Request, res: Response) => {
      const log =
        req.logger || logger.child({ endpoint: '/v1/trade-ideas/refresh' })
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000)
        const resp = await fetch('https://api.binance.com/api/v3/ticker/24hr', {
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (!resp.ok)
          return res.status(502).json({ error: 'Failed to fetch tickers' })
        const tickers = (await resp.json()) as any[]
        const MIN_QUOTE_USD = 5_000_000 // minimum 24h quote volume in USD for liquidity
        const BASES = ['USDT', 'USDC', 'FDUSD', 'TUSD']
        const candidates = (Array.isArray(tickers) ? tickers : [])
          .filter((t: any) => {
            if (typeof t.symbol !== 'string') return false
            const hasSupportedBase = BASES.some((b) => t.symbol.endsWith(b))
            return (
              hasSupportedBase &&
              isFinite(Number(t.priceChangePercent)) &&
              isFinite(Number(t.quoteVolume)) &&
              Number(t.quoteVolume) >= MIN_QUOTE_USD
            )
          })
          .map((t: any) => ({
            symbol: t.symbol as string,
            change: Number(t.priceChangePercent),
            quoteVolume: Number(t.quoteVolume),
          }))
          .sort((a: any, b: any) => Math.abs(b.change) - Math.abs(a.change))

        // Rotation: use time-based offset in minutes unless explicit ?offset provided
        const takeCount = 60
        const poolSize = Math.min(candidates.length, 200)
        const offsetParam = Number((req.query?.offset as string) ?? '')
        const baseOffset = Number.isFinite(offsetParam)
          ? Math.max(0, offsetParam) % (poolSize || 1)
          : Math.floor(Date.now() / 60_000) % (poolSize || 1)
        const end = baseOffset + takeCount
        const movers =
          end <= poolSize
            ? candidates.slice(baseOffset, end)
            : [...candidates.slice(baseOffset, poolSize), ...candidates.slice(0, end - poolSize)]

        const userId = req.user!.userId
        const nowIso = new Date().toISOString()
        let count = 0
        await Promise.all(
          movers.map(async (m) => {
            const side = m.change >= 0 ? 'BUY' : 'SELL'
            const score = Math.min(1, Math.abs(m.change) / 25)
            const historyEntry = {
              ts: nowIso,
              side,
              score,
              reason: `24h change ${m.change.toFixed(2)}%`,
              metadata: { changePct: m.change, quoteVolume: m.quoteVolume },
            }
            await sql`
              insert into trade_ideas
                (user_id, exchange, symbol, side, score, reason, metadata, history)
              values
                (${userId}, ${'binance'}, ${m.symbol}, ${side}, ${score}, ${`24h change ${m.change.toFixed(2)}%`}, ${JSON.stringify({ changePct: m.change, quoteVolume: m.quoteVolume })}::jsonb, ${JSON.stringify([historyEntry])}::jsonb)
              on conflict (user_id, exchange, symbol)
              do update set
                side = excluded.side,
                score = excluded.score,
                reason = excluded.reason,
                metadata = excluded.metadata,
                history = (
                  case when jsonb_typeof(trade_ideas.history) = 'array' then trade_ideas.history else '[]'::jsonb end
                ) || excluded.history
            `.execute(_db)
            count += 1
          }),
        )
        return res.json({ ok: true, count })
      } catch (err) {
        log.error(
          { err, correlationId: req.correlationId },
          'Failed to refresh trade ideas',
        )
        return res.status(500).json({ error: 'Failed to refresh trade ideas' })
      }
    },
  )

  return r
}
