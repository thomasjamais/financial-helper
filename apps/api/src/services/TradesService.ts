import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { calculatePnL, calculateQuantity, getSymbolPrice } from '@pkg/shared-kernel'

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
  tpPrice: number | null
  slPrice: number | null
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
      const entryPrice = Number(trade.entry_price)
      const quantity = Number(trade.quantity)

      // Calculate TP and SL prices based on entry price
      let tpPrice: number | null = null
      let slPrice: number | null = null
      
      if (isFinite(entryPrice) && entryPrice > 0) {
        if (trade.side === 'BUY') {
          tpPrice = entryPrice * (1 + trade.tp_pct)
          slPrice = entryPrice * (1 - trade.sl_pct)
        } else {
          tpPrice = entryPrice * (1 - trade.tp_pct)
          slPrice = entryPrice * (1 + trade.sl_pct)
        }
      }

      if (!markPrice || !isFinite(markPrice) || markPrice <= 0) {
        return {
          ...trade,
          markPrice: null,
          pnl_unrealized: null,
          tpPrice: tpPrice && isFinite(tpPrice) && tpPrice > 0 ? tpPrice : null,
          slPrice: slPrice && isFinite(slPrice) && slPrice > 0 ? slPrice : null,
        }
      }

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
          tpPrice: tpPrice && isFinite(tpPrice) && tpPrice > 0 ? tpPrice : null,
          slPrice: slPrice && isFinite(slPrice) && slPrice > 0 ? slPrice : null,
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
        tpPrice: tpPrice && isFinite(tpPrice) && tpPrice > 0 ? tpPrice : null,
        slPrice: slPrice && isFinite(slPrice) && slPrice > 0 ? slPrice : null,
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
    
    // For each symbol, we need:
    // - The actual pair price (for calculating PnL with entry_price)
    // - The USD price (for display in frontend)
    const pairPriceMap = new Map<string, number>() // Real pair price (e.g., FETBTC in BTC)
    const usdPriceMap = new Map<string, number>() // USD price for display
    
    await Promise.all(
      symbols.map(async (sym) => {
        try {
          if (isUSDQuoted(sym)) {
            // USD pair: same price for both
            const price = await getSymbolPrice(sym)
            if (price && isFinite(price) && price > 0) {
              pairPriceMap.set(sym, price)
              usdPriceMap.set(sym, price)
            } else {
              logger.debug({ symbol: sym, price }, 'Invalid price for symbol')
            }
          } else {
            // Non-USD pair: get actual pair price and USD price separately
            const pairPrice = await getTradingPairPrice(sym)
            const usdPrice = await getSymbolPrice(sym)
            
            if (pairPrice && isFinite(pairPrice) && pairPrice > 0) {
              pairPriceMap.set(sym, pairPrice)
            } else {
              logger.debug({ symbol: sym, pairPrice }, 'Invalid pair price for symbol')
            }
            
            if (usdPrice && isFinite(usdPrice) && usdPrice > 0) {
              usdPriceMap.set(sym, usdPrice)
            } else {
              logger.debug({ symbol: sym, usdPrice }, 'Invalid USD price for symbol')
            }
          }
        } catch (e) {
          logger.debug(
            { err: e, symbol: sym },
            'Error fetching price for symbol',
          )
        }
      }),
    )
    
    // Fetch quote asset prices for non-USD pairs to convert PnL to USD
    const quoteAssetPrices = new Map<string, number>()
    const nonUSDSymbols = trades
      .map((t) => t.symbol)
      .filter((sym) => !isUSDQuoted(sym))
      .map((sym) => extractQuoteAsset(sym))
      .filter((asset): asset is string => asset !== null)
    
    const uniqueQuoteAssets = Array.from(new Set(nonUSDSymbols))
    
    await Promise.all(
      uniqueQuoteAssets.map(async (quoteAsset) => {
        try {
          const price = await getSymbolPrice(`${quoteAsset}USDT`)
          if (price && isFinite(price) && price > 0) {
            quoteAssetPrices.set(quoteAsset, price)
          }
        } catch (e) {
          logger.debug({ err: e, quoteAsset }, 'Error fetching quote asset price')
        }
      }),
    )

    // Use pair prices for PnL calculation (entry and mark must be in same unit)
    // But return USD prices in markPrice for display
    return trades.map((trade) => {
      const pairPrice = pairPriceMap.get(trade.symbol) // Real pair price (e.g., FETBTC in BTC)
      const usdPrice = usdPriceMap.get(trade.symbol) // USD price for display
      
      const entryPrice = Number(trade.entry_price)
      const quantity = Number(trade.quantity)

      // Calculate TP and SL prices based on entry price (in same unit as entry_price)
      let tpPrice: number | null = null
      let slPrice: number | null = null
      
      if (isFinite(entryPrice) && entryPrice > 0) {
        if (trade.side === 'BUY') {
          tpPrice = entryPrice * (1 + trade.tp_pct)
          slPrice = entryPrice * (1 - trade.sl_pct)
        } else {
          tpPrice = entryPrice * (1 - trade.tp_pct)
          slPrice = entryPrice * (1 + trade.sl_pct)
        }
      }
      
      if (!pairPrice || !isFinite(pairPrice) || pairPrice <= 0) {
        return {
          ...trade,
          markPrice: usdPrice ?? null, // USD price for display
          pnl_unrealized: null,
          tpPrice: tpPrice && isFinite(tpPrice) && tpPrice > 0 ? tpPrice : null,
          slPrice: slPrice && isFinite(slPrice) && slPrice > 0 ? slPrice : null,
        }
      }

      if (
        !isFinite(entryPrice) ||
        entryPrice <= 0 ||
        !isFinite(quantity) ||
        quantity <= 0
      ) {
        return {
          ...trade,
          markPrice: usdPrice ?? null, // USD price for display
          pnl_unrealized: null,
          tpPrice: tpPrice && isFinite(tpPrice) && tpPrice > 0 ? tpPrice : null,
          slPrice: slPrice && isFinite(slPrice) && slPrice > 0 ? slPrice : null,
        }
      }

      // Calculate PnL using actual pair prices (entry and mark must be in same unit)
      const pnl = calculatePnL({
        side: trade.side,
        entryPrice,
        quantity,
        markPrice: pairPrice, // Use actual pair price for PnL calculation
      })
      
      // Convert PnL to USD if needed
      let pnlUSD: number = pnl
      if (!isUSDQuoted(trade.symbol)) {
        const quoteAsset = extractQuoteAsset(trade.symbol)
        if (quoteAsset) {
          const quoteAssetUsdPrice = quoteAssetPrices.get(quoteAsset)
          if (quoteAssetUsdPrice && isFinite(quoteAssetUsdPrice) && quoteAssetUsdPrice > 0) {
            // PnL in quote asset * quote asset price in USD = PnL in USD
            pnlUSD = pnl * quoteAssetUsdPrice
          } else {
            // Fallback: calculate PnL directly in USD using current prices
            if (usdPrice && pairPrice && pairPrice > 0) {
              const entryPriceUSD = entryPrice * (usdPrice / pairPrice)
              const markPriceUSD = usdPrice
              pnlUSD = trade.side === 'BUY'
                ? (markPriceUSD - entryPriceUSD) * quantity
                : (entryPriceUSD - markPriceUSD) * quantity
            }
          }
        }
      }

      return {
        ...trade,
        markPrice: usdPrice ?? null, // USD price for display in frontend
        pnl_unrealized: isFinite(pnlUSD) ? Number(pnlUSD.toFixed(2)) : null,
        tpPrice: tpPrice && isFinite(tpPrice) && tpPrice > 0 ? tpPrice : null,
        slPrice: slPrice && isFinite(slPrice) && slPrice > 0 ? slPrice : null,
      }
    })
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
}

