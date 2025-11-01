import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { sql } from 'kysely'
import axios from 'axios'
// TradeIdeasService handles trade ideas operations

export type CreateTradeIdeaInput = {
  exchange: string
  symbol: string
  side: 'BUY' | 'SELL'
  score: number
  reason?: string
  metadata?: Record<string, any>
}

export type TradeIdeaFilter = {
  sortBy?: 'score' | 'side' | 'created_at'
  sortOrder?: 'asc' | 'desc'
  limit?: number
}

export class TradeIdeasService {
  constructor(
    private db: Kysely<DB>,
    private logger: Logger,
  ) {}

  async create(
    userId: string,
    input: CreateTradeIdeaInput,
    correlationId?: string,
  ): Promise<void> {
    const log = this.logger.child({ correlationId, userId })
    
    const historyEntry = {
      ts: new Date().toISOString(),
      side: input.side,
      score: input.score,
      reason: input.reason ?? null,
      metadata: input.metadata ?? null,
    }

    await sql`
      insert into trade_ideas
        (user_id, exchange, symbol, side, score, reason, metadata, history)
      values
        (${userId}, ${input.exchange}, ${input.symbol}, ${input.side}, ${input.score}, ${input.reason ?? null}, ${JSON.stringify(input.metadata ?? null)}::jsonb, ${JSON.stringify([historyEntry])}::jsonb)
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
    `.execute(this.db)

    log.info({ symbol: input.symbol, exchange: input.exchange }, 'Trade idea created')
  }

  async list(
    userId: string,
    filter: TradeIdeaFilter = {},
  ): Promise<Array<{
    id: number
    exchange: string
    symbol: string
    side: 'BUY' | 'SELL'
    score: number
    reason: string | null
    metadata: any
    created_at: Date
    history: any
    priceChange24h: number | null
  }>> {
    const sortBy = filter.sortBy ?? 'created_at'
    const sortOrder = filter.sortOrder ?? 'desc'
    const limit = filter.limit ?? 200

    const validSortBy = ['score', 'side', 'created_at']
    const validSortOrder = ['asc', 'desc']
    const finalSortBy = validSortBy.includes(sortBy) ? sortBy : 'created_at'
    const finalSortOrder = validSortOrder.includes(sortOrder)
      ? sortOrder
      : 'desc'

    let query = this.db
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
      .where('user_id', '=', userId)

    if (finalSortBy === 'score') {
      query =
        finalSortOrder === 'asc'
          ? query.orderBy('score', 'asc')
          : query.orderBy('score', 'desc')
    } else if (finalSortBy === 'side') {
      query =
        finalSortOrder === 'asc'
          ? query.orderBy('side', 'asc')
          : query.orderBy('side', 'desc')
    } else {
      query =
        finalSortOrder === 'asc'
          ? query.orderBy('created_at', 'asc')
          : query.orderBy('created_at', 'desc')
    }

    const rows = await query.limit(limit).execute()

    // Fetch 24h price changes for all symbols
    const symbols = Array.from(new Set(rows.map((r) => r.symbol)))
    const priceChangeMap = new Map<string, number>()

    try {
      const tickerResp = await axios.get(
        'https://api.binance.com/api/v3/ticker/24hr',
        { timeout: 5000 },
      )
      const tickers = tickerResp.data as any[]

      for (const ticker of tickers) {
        if (ticker.symbol && isFinite(Number(ticker.priceChangePercent))) {
          priceChangeMap.set(
            ticker.symbol,
            Number(ticker.priceChangePercent),
          )
        }
      }
    } catch (err) {
      this.logger.debug({ err }, 'Failed to fetch 24h price changes')
      // Continue without 24h price changes if fetch fails
    }

    return rows.map((row) => ({
      ...row,
      side: row.side as 'BUY' | 'SELL',
      metadata: row.metadata as any,
      history: row.history as any,
      priceChange24h: priceChangeMap.get(row.symbol) ?? null,
    }))
  }

  async refreshFromBinanceTickers(
    userId: string,
    correlationId?: string,
  ): Promise<number> {
    const log = this.logger.child({ correlationId, userId })

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const resp = await fetch('https://api.binance.com/api/v3/ticker/24hr', {
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!resp.ok) {
        throw new Error(`Failed to fetch tickers: ${resp.status}`)
      }

      const tickers = (await resp.json()) as any[]
      const MIN_QUOTE_USD = 5_000_000
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

      const takeCount = 60
      const poolSize = Math.min(candidates.length, 200)
      const baseOffset = Math.floor(Date.now() / 60_000) % (poolSize || 1)
      const end = baseOffset + takeCount
      const movers =
        end <= poolSize
          ? candidates.slice(baseOffset, end)
          : [
              ...candidates.slice(baseOffset, poolSize),
              ...candidates.slice(0, end - poolSize),
            ]

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
          `.execute(this.db)
          count += 1
        }),
      )

      log.info({ count }, 'Trade ideas refreshed from Binance')
      return count
    } catch (err) {
      log.error({ err }, 'Failed to refresh trade ideas from Binance')
      throw err
    }
  }

  async findById(userId: string, ideaId: number): Promise<{
    id: number
    exchange: string
    symbol: string
    side: 'BUY' | 'SELL'
    score: number
    reason: string | null
    metadata: any
    created_at: Date
    history: any
  } | null> {
    const idea = await this.db
      .selectFrom('trade_ideas')
      .selectAll()
      .where('id', '=', ideaId)
      .where('user_id', '=', userId)
      .executeTakeFirst()

    if (!idea) return null

    return {
      id: idea.id,
      exchange: idea.exchange,
      symbol: idea.symbol,
      side: idea.side as 'BUY' | 'SELL',
      score: idea.score,
      reason: idea.reason,
      metadata: idea.metadata as any,
      created_at: idea.created_at,
      history: idea.history as any,
    }
  }
}

