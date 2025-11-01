import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import {
  calculatePnL,
  calculateQuantity,
  getSymbolPrice,
  getTradingPairPrice,
  isUSDQuoted,
  extractQuoteAsset,
} from '@pkg/shared-kernel'

export type CreateTradeInput = {
  ideaId: number
  exchange: string
  symbol: string
  side: 'BUY' | 'SELL'
  budgetUSD: number
  entryPrice: number
  tpPct: number
  slPct: number
  risk?: string
}

export type TradeWithPnL = {
  id: number
  idea_id: number | null
  exchange: string
  symbol: string
  side: 'BUY' | 'SELL'
  budget_usd: number
  quantity: number
  entry_price: number
  tp_pct: number
  sl_pct: number
  status: string
  opened_at: Date | null
  closed_at: Date | null
  pnl_usd: number | null
  metadata: any
  markPrice: number | null
  pnl_unrealized: number | null
}

export class TradesService {
  constructor(
    private db: Kysely<DB>,
    private logger: Logger,
  ) {}

  async create(
    userId: string,
    input: CreateTradeInput,
    correlationId?: string,
  ): Promise<{ id: number }> {
    const log = this.logger.child({ correlationId, userId })
    
    const quantity = calculateQuantity(input.budgetUSD, input.entryPrice)

    const inserted = await this.db
      .insertInto('trades')
      .values({
        user_id: userId,
        idea_id: input.ideaId,
        exchange: input.exchange,
        symbol: input.symbol,
        side: input.side,
        budget_usd: input.budgetUSD,
        quantity,
        entry_price: input.entryPrice,
        tp_pct: input.tpPct,
        sl_pct: input.slPct,
        status: 'simulated',
        metadata: { risk: input.risk } as any,
      })
      .returning(['id'])
      .executeTakeFirstOrThrow()

    log.info({ tradeId: inserted.id, symbol: input.symbol }, 'Trade created')
    return inserted
  }

  async list(userId: string, limit = 200): Promise<Array<{
    id: number
    idea_id: number | null
    exchange: string
    symbol: string
    side: 'BUY' | 'SELL'
    budget_usd: number
    quantity: number
    entry_price: number
    tp_pct: number
    sl_pct: number
    status: string
    opened_at: Date | null
    closed_at: Date | null
    pnl_usd: number | null
    metadata: any
  }>> {
    const rows = await this.db
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
      .where('user_id', '=', userId)
      .orderBy('opened_at', 'desc')
      .limit(limit)
      .execute()

    return rows.map((row) => ({
      ...row,
      side: row.side as 'BUY' | 'SELL',
      metadata: row.metadata as any,
    }))
  }

  async findById(userId: string, tradeId: number): Promise<{
    id: number
    idea_id: number | null
    exchange: string
    symbol: string
    side: 'BUY' | 'SELL'
    budget_usd: number
    quantity: number
    entry_price: number
    tp_pct: number
    sl_pct: number
    status: string
    opened_at: Date | null
    closed_at: Date | null
    pnl_usd: number | null
    metadata: any
  } | null> {
    const trade = await this.db
      .selectFrom('trades')
      .selectAll()
      .where('id', '=', tradeId)
      .where('user_id', '=', userId)
      .executeTakeFirst()

    if (!trade) return null

    return {
      id: trade.id,
      idea_id: trade.idea_id,
      exchange: trade.exchange,
      symbol: trade.symbol,
      side: trade.side as 'BUY' | 'SELL',
      budget_usd: trade.budget_usd,
      quantity: trade.quantity,
      entry_price: trade.entry_price,
      tp_pct: trade.tp_pct,
      sl_pct: trade.sl_pct,
      status: trade.status,
      opened_at: trade.opened_at,
      closed_at: trade.closed_at,
      pnl_usd: trade.pnl_usd,
      metadata: trade.metadata as any,
    }
  }

  async listWithPnL(
    userId: string,
    priceMap: Map<string, number>,
    limit = 200,
  ): Promise<TradeWithPnL[]> {
    const trades = await this.list(userId, limit)

    return trades.map((trade) => {
      const markPrice = priceMap.get(trade.symbol)

      if (!markPrice || !isFinite(markPrice) || markPrice <= 0) {
        return {
          ...trade,
          markPrice: null,
          pnl_unrealized: null,
        }
      }

      const entryPrice = Number(trade.entry_price)
      const quantity = Number(trade.quantity)

      if (
        !isFinite(entryPrice) ||
        entryPrice <= 0 ||
        !isFinite(quantity) ||
        quantity <= 0
      ) {
        return {
          ...trade,
          markPrice,
          pnl_unrealized: null,
        }
      }

      const pnl = calculatePnL({
        side: trade.side,
        entryPrice,
        quantity,
        markPrice,
      })

      return {
        ...trade,
        markPrice,
        pnl_unrealized: pnl,
      }
    })
  }

  async listWithPnLAndFetchPrices(
    userId: string,
    logger: Logger,
    limit = 200,
  ): Promise<TradeWithPnL[]> {
    const trades = await this.list(userId, limit)
    const symbols = Array.from(new Set(trades.map((t) => t.symbol)))
    
    const priceMap = new Map<string, number>()
    await Promise.all(
      symbols.map(async (sym) => {
        try {
          const price = await getSymbolPrice(sym)
          if (price && isFinite(price) && price > 0) {
            priceMap.set(sym, price)
          } else {
            logger.debug({ symbol: sym, price }, 'Invalid price for symbol')
          }
        } catch (e) {
          logger.debug(
            { err: e, symbol: sym },
            'Error fetching price for symbol',
          )
        }
      }),
    )
    
    return this.listWithPnL(userId, priceMap, limit)
  }

  async createSnapshot(
    userId: string,
    tradeId: number,
    markPrice: number,
    correlationId?: string,
  ): Promise<{ mark: number; pnl: number }> {
    const log = this.logger.child({ correlationId, userId, tradeId })
    
    const trade = await this.findById(userId, tradeId)
    
    if (!trade) {
      throw new Error('Trade not found')
    }

    const entryPrice = Number(trade.entry_price)
    const quantity = Number(trade.quantity)

    if (!isFinite(entryPrice) || entryPrice <= 0 || !isFinite(quantity) || quantity <= 0) {
      throw new Error('Invalid trade entry price or quantity')
    }

    const pnl = calculatePnL({
      side: trade.side,
      entryPrice,
      quantity,
      markPrice,
    })

    await this.db
      .insertInto('trade_pnl')
      .values({
        trade_id: tradeId,
        mark_price: markPrice,
        pnl_usd: pnl,
      })
      .execute()

    log.info({ markPrice, pnl }, 'PnL snapshot created')
    
    return { mark: markPrice, pnl }
  }

  async getHistory(tradeId: number, limit = 200): Promise<Array<{
    id: number
    trade_id: number
    ts: Date
    mark_price: number
    pnl_usd: number
  }>> {
    return await this.db
      .selectFrom('trade_pnl')
      .selectAll()
      .where('trade_id', '=', tradeId)
      .orderBy('ts', 'desc')
      .limit(limit)
      .execute()
  }

  async closeTrade(
    userId: string,
    tradeId: number,
    exitPrice: number,
    correlationId?: string,
  ): Promise<{
    trade: {
      id: number
      symbol: string
      side: 'BUY' | 'SELL'
      budget_usd: number
      quantity: number
      entry_price: number
      exit_price: number
      pnl_usd: number
      pnl_pct: number
      status: string
      closed_at: Date
    }
    pnl: number
    pnlPct: number
  }> {
    const log = this.logger.child({ correlationId, userId, tradeId })

    const trade = await this.findById(userId, tradeId)

    if (!trade) {
      throw new Error('Trade not found')
    }

    if (trade.status === 'closed') {
      throw new Error('Trade is already closed')
    }

    const entryPrice = Number(trade.entry_price)
    const quantity = Number(trade.quantity)

    if (!isFinite(entryPrice) || entryPrice <= 0 || !isFinite(quantity) || quantity <= 0) {
      throw new Error('Invalid trade entry price or quantity')
    }

    // Calculate PnL using actual pair prices
    const pnl = calculatePnL({
      side: trade.side,
      entryPrice,
      quantity,
      markPrice: exitPrice,
    })

    // Convert PnL to USD if needed (for non-USD pairs)
    let pnlUSD: number = pnl
    if (!isUSDQuoted(trade.symbol)) {
      const quoteAsset = extractQuoteAsset(trade.symbol)
      if (quoteAsset) {
        const quoteAssetUsdPrice = await getSymbolPrice(`${quoteAsset}USDT`)
        if (quoteAssetUsdPrice && isFinite(quoteAssetUsdPrice) && quoteAssetUsdPrice > 0) {
          pnlUSD = pnl * quoteAssetUsdPrice
        }
      }
    }

    // Calculate PnL percentage
    const pnlPct = trade.budget_usd > 0 ? (pnlUSD / trade.budget_usd) * 100 : 0

    // Update trade to closed status
    await this.db
      .updateTable('trades')
      .set({
        status: 'closed',
        closed_at: new Date(),
        pnl_usd: pnlUSD,
      })
      .where('id', '=', tradeId)
      .where('user_id', '=', userId)
      .execute()

    log.info(
      {
        symbol: trade.symbol,
        entryPrice,
        exitPrice,
        pnl: pnlUSD,
        pnlPct,
      },
      'Trade closed',
    )

    return {
      trade: {
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        budget_usd: trade.budget_usd,
        quantity,
        entry_price: entryPrice,
        exit_price: exitPrice,
        pnl_usd: pnlUSD,
        pnl_pct: pnlPct,
        status: 'closed',
        closed_at: new Date(),
      },
      pnl: pnlUSD,
      pnlPct,
    }
  }
}

