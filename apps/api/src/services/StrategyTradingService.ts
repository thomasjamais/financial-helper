import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { StrategyExecutionService } from './StrategyExecutionService'
import { StrategiesService } from './StrategiesService'
import { TradesService } from './TradesService'
import { BinanceService } from './BinanceService'
import { HistoricalDataService } from '@pkg/shared-kernel'
import { StrategySandbox } from '@pkg/strategy-engine'
import type { Candle } from '@pkg/backtester'

export type ExecuteStrategyResult = {
  executed: boolean
  signal: 'buy' | 'sell' | 'hold' | null
  tradeId: number | null
  error?: string
}

export class StrategyTradingService {
  constructor(
    private db: Kysely<DB>,
    private logger: Logger,
    private encKey: string,
  ) {}

  async executeStrategy(
    executionId: number,
    correlationId?: string,
  ): Promise<ExecuteStrategyResult> {
    const log = this.logger.child({ correlationId, executionId })

    try {
      const execution = await this.db
        .selectFrom('strategy_executions')
        .selectAll()
        .where('id', '=', executionId)
        .where('status', '=', 'active')
        .executeTakeFirst()

      if (!execution) {
        return {
          executed: false,
          signal: null,
          tradeId: null,
          error: 'Execution not found or not active',
        }
      }

      const strategiesService = new StrategiesService(this.db, this.logger)
      const strategy = await strategiesService.getById(
        execution.user_id,
        execution.strategy_id,
      )

      if (!strategy) {
        return {
          executed: false,
          signal: null,
          tradeId: null,
          error: 'Strategy not found',
        }
      }

      if (strategy.allocated_amount_usd <= 0 || !strategy.is_active) {
        return {
          executed: false,
          signal: null,
          tradeId: null,
          error: 'Strategy has no allocation or is inactive',
        }
      }

      log.info(
        { symbols: execution.symbols, interval: execution.interval },
        'Executing strategy',
      )

      const historicalDataService = new HistoricalDataService()
      const candlesMap = new Map<string, Candle[]>()

      for (const symbol of execution.symbols) {
        try {
          const candles = await historicalDataService.fetchKlinesForPeriod(
            symbol,
            execution.interval,
            3,
          )
          candlesMap.set(symbol, candles)
        } catch (error) {
          log.error({ error, symbol }, 'Failed to fetch candles for symbol')
          return {
            executed: false,
            signal: null,
            tradeId: null,
            error: `Failed to fetch candles for ${symbol}`,
          }
        }
      }

      const sandbox = StrategySandbox.createStrategy(strategy.code)
      const allCandles: Candle[] = []
      for (const candles of candlesMap.values()) {
        allCandles.push(...candles)
      }
      allCandles.sort((a, b) => a.timestamp - b.timestamp)

      if (allCandles.length === 0) {
        return {
          executed: false,
          signal: null,
          tradeId: null,
          error: 'No candles available',
        }
      }

      sandbox.initialize(allCandles)

      const latestCandle = allCandles[allCandles.length - 1]
      const result = sandbox.execute(
        latestCandle,
        allCandles.length - 1,
        allCandles,
      )

      if (!result.success || !result.signal) {
        return { executed: false, signal: 'hold', tradeId: null }
      }

      if (result.signal === 'hold') {
        return { executed: false, signal: 'hold', tradeId: null }
      }

      const signal = result.signal as 'buy' | 'sell'
      const symbol = execution.symbols[0]

      log.info({ signal, symbol }, 'Strategy generated signal')

      const tradeResult = await this.executeTrade(
        execution.user_id,
        execution.strategy_id,
        executionId,
        symbol,
        signal,
        strategy.allocated_amount_usd,
        latestCandle.close,
        correlationId,
      )

      return {
        executed: tradeResult.success,
        signal,
        tradeId: tradeResult.tradeId,
        error: tradeResult.error,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      log.error({ error }, 'Failed to execute strategy')
      return {
        executed: false,
        signal: null,
        tradeId: null,
        error: errorMessage,
      }
    }
  }

  private async executeTrade(
    userId: string,
    strategyId: number,
    executionId: number,
    symbol: string,
    signal: 'buy' | 'sell',
    allocatedAmount: number,
    currentPrice: number,
    correlationId?: string,
  ): Promise<{ success: boolean; tradeId: number | null; error?: string }> {
    const log = this.logger.child({
      correlationId,
      userId,
      strategyId,
      symbol,
      signal,
    })

    try {
      const binanceService = new BinanceService(
        this.db,
        this.logger,
        this.encKey,
      )
      const tradesService = new TradesService(this.db, this.logger)

      const side = signal === 'buy' ? 'BUY' : 'SELL'
      const quantity = allocatedAmount / currentPrice

      log.info(
        {
          symbol,
          side,
          quantity,
          price: currentPrice,
          budget: allocatedAmount,
        },
        'Placing strategy trade',
      )

      let orderId: string | null = null
      let actualQuantity = quantity

      try {
        const order = await binanceService.placeSpotOrder({
          symbol,
          side,
          type: 'MARKET',
          quantity,
        })
        orderId = order.id
        actualQuantity = order.qty
        log.info(
          { orderId, executedQty: order.qty },
          'Order placed successfully',
        )
      } catch (error) {
        log.error({ error }, 'Failed to place order, creating simulated trade')
      }

      const tpPct = 5
      const slPct = 2

      const trade = await tradesService.create(
        userId,
        {
          ideaId: null,
          exchange: 'binance',
          symbol,
          side,
          budgetUSD: allocatedAmount,
          entryPrice: currentPrice,
          quantity: actualQuantity,
          tpPct,
          slPct,
          risk: 'strategy',
          realTrade: orderId !== null,
          orderId: orderId ?? undefined,
        },
        correlationId,
      )

      await this.db
        .insertInto('strategy_trades')
        .values({
          strategy_id: strategyId,
          strategy_execution_id: executionId,
          trade_id: trade.id,
          signal,
          symbol,
        })
        .execute()

      log.info({ tradeId: trade.id }, 'Strategy trade created')

      return { success: true, tradeId: trade.id }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      log.error({ error }, 'Failed to execute trade')
      return { success: false, tradeId: null, error: errorMessage }
    }
  }
}
