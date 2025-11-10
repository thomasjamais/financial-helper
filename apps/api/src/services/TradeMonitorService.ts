import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import {
  evaluateTrade,
  calculateExitStrategy,
  type TradeState,
  type TradeAction,
} from '@pkg/trade-monitor'
import {
  getTradingPairPrice,
  getSymbolPrice,
  isUSDQuoted,
  extractQuoteAsset,
  calculatePnL,
} from '@pkg/shared-kernel'
import { TradesService } from './TradesService.js'
import { BinanceService } from './BinanceService.js'

export class TradeMonitorService {
  constructor(
    private db: Kysely<DB>,
    private logger: Logger,
    private tradesService: TradesService,
    private binanceService: BinanceService,
  ) {}

  /**
   * Monitor all open trades and execute necessary actions
   */
  async monitorTrades(correlationId?: string): Promise<{
    checked: number
    actionsExecuted: number
    errors: number
  }> {
    const log = this.logger.child({ correlationId, service: 'TradeMonitorService' })
    let checked = 0
    let actionsExecuted = 0
    let errors = 0

    try {
      // Get all open trades
      const openTrades = await this.tradesService.getOpenTrades()
      checked = openTrades.length

      if (openTrades.length === 0) {
        log.debug('No open trades to monitor')
        return { checked: 0, actionsExecuted: 0, errors: 0 }
      }

      log.info({ count: openTrades.length }, 'Monitoring open trades')

      // Fetch current prices for all symbols
      const symbols = Array.from(new Set(openTrades.map((t) => t.symbol)))
      const priceMap = new Map<string, number>()

      await Promise.all(
        symbols.map(async (symbol) => {
          try {
            // Get actual pair price for PnL calculation
            const price = isUSDQuoted(symbol)
              ? await getSymbolPrice(symbol)
              : await getTradingPairPrice(symbol)

            if (price && isFinite(price) && price > 0) {
              priceMap.set(symbol, price)
            } else {
              log.warn({ symbol }, 'Failed to fetch valid price')
            }
          } catch (err) {
            log.warn({ err, symbol }, 'Error fetching price')
          }
        }),
      )

      // Evaluate each trade
      for (const trade of openTrades) {
        try {
          const currentPrice = priceMap.get(trade.symbol)

          if (!currentPrice || !isFinite(currentPrice) || currentPrice <= 0) {
            log.debug({ tradeId: trade.id, symbol: trade.symbol }, 'Skipping trade - no valid price')
            continue
          }

          // Auto-calculate exit strategy if not set
          let exitStrategy = trade.exit_strategy
          if (!exitStrategy) {
            exitStrategy = calculateExitStrategy(trade.tp_pct)
            await this.tradesService.updateExitStrategy(
              trade.user_id,
              trade.id,
              exitStrategy,
              correlationId,
            )
            log.info(
              { tradeId: trade.id, exitStrategy },
              'Auto-calculated exit strategy',
            )
          }

          // Convert trade to TradeState for evaluation
          const tradeState: TradeState = {
            id: trade.id,
            side: trade.side,
            entryPrice: trade.entry_price,
            quantity: trade.quantity,
            exitedQuantity: trade.exited_quantity ?? 0,
            tpPct: trade.tp_pct,
            slPct: trade.sl_pct,
            exitStrategy,
            trailingStopConfig: trade.trailing_stop_config,
            currentTrailingStopPrice: trade.current_trailing_stop_price,
            currentPrice,
          }

          // Evaluate trade
          const evaluation = evaluateTrade(tradeState)

          // Execute actions
          for (const action of evaluation.actions) {
            if (action.type === 'no_action') {
              continue
            }

            try {
              // Get full trade with metadata
              const fullTrade = await this.tradesService.findById(
                trade.user_id,
                trade.id,
              )
              if (!fullTrade) {
                log.warn({ tradeId: trade.id }, 'Trade not found for action execution')
                continue
              }

              await this.executeAction(
                {
                  ...trade,
                  metadata: fullTrade.metadata,
                },
                action,
                currentPrice,
                correlationId,
              )
              actionsExecuted++
            } catch (err) {
              errors++
              log.error(
                { err, tradeId: trade.id, action },
                'Failed to execute action',
              )
            }
          }
        } catch (err) {
          errors++
          log.error({ err, tradeId: trade.id }, 'Error monitoring trade')
        }
      }

      log.info(
        { checked, actionsExecuted, errors },
        'Trade monitoring complete',
      )

      return { checked, actionsExecuted, errors }
    } catch (err) {
      log.error({ err }, 'Trade monitoring failed')
      throw err
    }
  }

  /**
   * Execute a trade action
   */
  private async executeAction(
    trade: {
      id: number
      user_id: string
      symbol: string
      side: 'BUY' | 'SELL'
      exchange: string
      quantity: number
      entry_price: number
      metadata: any
    },
    action: TradeAction,
    currentPrice: number,
    correlationId?: string,
  ): Promise<void> {
    const log = this.logger.child({ correlationId, tradeId: trade.id })

    if (action.type === 'partial_exit') {
      await this.executePartialExit(trade, action, currentPrice, correlationId)
    } else if (action.type === 'update_trailing_stop') {
      await this.tradesService.updateTrailingStopPrice(
        trade.id,
        action.newTrailingStopPrice,
        correlationId,
      )
      log.info(
        { newTrailingStopPrice: action.newTrailingStopPrice },
        'Trailing stop updated',
      )
    } else if (action.type === 'trigger_trailing_stop') {
      await this.executeTrailingStopExit(trade, action, currentPrice, correlationId)
    }
  }

  /**
   * Execute a partial exit
   */
  private async executePartialExit(
    trade: {
      id: number
      user_id: string
      symbol: string
      side: 'BUY' | 'SELL'
      exchange: string
      quantity: number
      entry_price: number
      metadata: any
    },
    action: Extract<TradeAction, { type: 'partial_exit' }>,
    currentPrice: number,
    correlationId?: string,
  ): Promise<void> {
    const log = this.logger.child({ correlationId, tradeId: trade.id })

    // Only execute real orders if this is a real trade
    const isRealTrade = trade.metadata?.realTrade === true

    let orderId: string | null = null

    if (isRealTrade && trade.exchange === 'binance') {
      try {
        // Place order on exchange
        const order = await this.binanceService.placePartialExitOrder({
          symbol: trade.symbol,
          side: trade.side === 'BUY' ? 'SELL' : 'BUY', // Opposite side to exit
          quantity: action.quantity,
        })

        orderId = order.id
        log.info(
          { orderId, quantity: action.quantity, price: currentPrice },
          'Partial exit order placed',
        )
      } catch (err) {
        log.error({ err, quantity: action.quantity }, 'Failed to place partial exit order')
        throw err
      }
    } else {
      log.debug({ quantity: action.quantity }, 'Simulated partial exit (not a real trade)')
    }

    // Calculate PnL for this partial exit
    const exitPnL = calculatePnL({
      side: trade.side,
      entryPrice: trade.entry_price,
      quantity: action.quantity,
      markPrice: currentPrice,
    })

    // Convert PnL to USD if needed
    let pnlUSD = exitPnL
    if (!isUSDQuoted(trade.symbol)) {
      const quoteAsset = extractQuoteAsset(trade.symbol)
      if (quoteAsset) {
        const quoteAssetUsdPrice = await getSymbolPrice(`${quoteAsset}USDT`)
        if (quoteAssetUsdPrice && isFinite(quoteAssetUsdPrice) && quoteAssetUsdPrice > 0) {
          pnlUSD = exitPnL * quoteAssetUsdPrice
        }
      }
    }

    // Record the partial exit
    await this.tradesService.recordPartialExit(
      trade.id,
      'partial',
      action.quantity,
      currentPrice,
      pnlUSD,
      orderId,
      correlationId,
    )

    log.info(
      {
        quantity: action.quantity,
        price: currentPrice,
        pnlUSD,
        orderId,
        level: action.level,
      },
      'Partial exit executed',
    )
  }

  /**
   * Execute a trailing stop exit
   */
  private async executeTrailingStopExit(
    trade: {
      id: number
      user_id: string
      symbol: string
      side: 'BUY' | 'SELL'
      exchange: string
      quantity: number
      entry_price: number
      metadata: any
    },
    action: Extract<TradeAction, { type: 'trigger_trailing_stop' }>,
    currentPrice: number,
    correlationId?: string,
  ): Promise<void> {
    const log = this.logger.child({ correlationId, tradeId: trade.id })

    // Only execute real orders if this is a real trade
    const isRealTrade = trade.metadata?.realTrade === true

    let orderId: string | null = null

    if (isRealTrade && trade.exchange === 'binance') {
      try {
        // Place order on exchange to exit remaining position
        const order = await this.binanceService.placePartialExitOrder({
          symbol: trade.symbol,
          side: trade.side === 'BUY' ? 'SELL' : 'BUY', // Opposite side to exit
          quantity: action.quantity,
        })

        orderId = order.id
        log.info(
          { orderId, quantity: action.quantity, price: currentPrice },
          'Trailing stop exit order placed',
        )
      } catch (err) {
        log.error({ err, quantity: action.quantity }, 'Failed to place trailing stop exit order')
        throw err
      }
    } else {
      log.debug({ quantity: action.quantity }, 'Simulated trailing stop exit (not a real trade)')
    }

    // Calculate PnL for this exit
    const exitPnL = calculatePnL({
      side: trade.side,
      entryPrice: trade.entry_price,
      quantity: action.quantity,
      markPrice: currentPrice,
    })

    // Convert PnL to USD if needed
    let pnlUSD = exitPnL
    if (!isUSDQuoted(trade.symbol)) {
      const quoteAsset = extractQuoteAsset(trade.symbol)
      if (quoteAsset) {
        const quoteAssetUsdPrice = await getSymbolPrice(`${quoteAsset}USDT`)
        if (quoteAssetUsdPrice && isFinite(quoteAssetUsdPrice) && quoteAssetUsdPrice > 0) {
          pnlUSD = exitPnL * quoteAssetUsdPrice
        }
      }
    }

    // Record the trailing stop exit
    await this.tradesService.recordPartialExit(
      trade.id,
      'trailing_stop',
      action.quantity,
      currentPrice,
      pnlUSD,
      orderId,
      correlationId,
    )

    log.info(
      {
        quantity: action.quantity,
        price: currentPrice,
        pnlUSD,
        orderId,
      },
      'Trailing stop exit executed',
    )
  }
}

