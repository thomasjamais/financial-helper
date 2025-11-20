import type { Logger } from '../logger'
import { BitgetService } from './BitgetService'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { ScalpingAnalysis } from '@pkg/scalping-engine'

export interface PlaceScalpingOrderInput {
  symbol: string
  capital: number
  leverage: number
  analysis: ScalpingAnalysis
  simulation: boolean
}

export interface CalculatedOrder {
  symbol: string
  side: 'BUY' | 'SELL'
  entryPrice: number
  quantity: number
  stopLoss: number
  takeProfits: Array<{ price: number; percentage: number }>
  positionSize: number
  riskAmount: number
  riskPct: number
  maxLoss: number
  maxLossPct: number
  potentialProfit: number
  potentialProfitPct: number
  riskRewardRatio: number
}

export class ScalpingOrderService {
  constructor(
    private db: Kysely<DB>,
    private logger: Logger,
    private bitgetService: BitgetService,
  ) {}

  async calculateOrder(
    input: PlaceScalpingOrderInput,
  ): Promise<CalculatedOrder> {
    const log = this.logger.child({
      symbol: input.symbol,
      service: 'ScalpingOrderService',
    })

    if (!input.analysis.recommendedEntry || !input.analysis.stopLoss) {
      throw new Error('No entry signal available for this symbol')
    }

    const entry = input.analysis.recommendedEntry
    const stopLoss = input.analysis.stopLoss
    const takeProfits = input.analysis.takeProfits

    const riskDistance = Math.abs(entry.price - stopLoss.price)
    const riskDistancePct = (riskDistance / entry.price) * 100

    if (riskDistancePct === 0) {
      throw new Error('Invalid stop loss distance')
    }

    const riskAmount = input.capital * 0.02
    const positionSize = (riskAmount / riskDistance) * input.leverage
    const quantity = positionSize / entry.price

    const maxLoss = riskAmount
    const maxLossPct = (maxLoss / input.capital) * 100

    const avgTakeProfit =
      takeProfits.length > 0
        ? takeProfits.reduce((sum, tp) => sum + tp.price, 0) /
          takeProfits.length
        : entry.price

    const potentialProfit =
      entry.side === 'BUY'
        ? (avgTakeProfit - entry.price) * quantity
        : (entry.price - avgTakeProfit) * quantity

    const potentialProfitPct = (potentialProfit / input.capital) * 100
    const riskRewardRatio = potentialProfit / maxLoss

    const calculatedOrder: CalculatedOrder = {
      symbol: input.symbol,
      side: entry.side,
      entryPrice: entry.price,
      quantity,
      stopLoss: stopLoss.price,
      takeProfits,
      positionSize: quantity * entry.price,
      riskAmount,
      riskPct: (riskAmount / input.capital) * 100,
      maxLoss,
      maxLossPct,
      potentialProfit,
      potentialProfitPct,
      riskRewardRatio,
    }

    log.info('Order calculated', {
      symbol: input.symbol,
      quantity: calculatedOrder.quantity.toFixed(4),
      riskPct: calculatedOrder.riskPct.toFixed(2),
      riskRewardRatio: calculatedOrder.riskRewardRatio.toFixed(2),
    })

    return calculatedOrder
  }

  async placeOrder(
    input: PlaceScalpingOrderInput,
    calculatedOrder: CalculatedOrder,
  ): Promise<{ orderId: string; simulation: boolean }> {
    const log = this.logger.child({
      symbol: input.symbol,
      service: 'ScalpingOrderService',
    })

    if (input.simulation) {
      log.info('Simulation mode: order not placed', {
        symbol: input.symbol,
        side: calculatedOrder.side,
        quantity: calculatedOrder.quantity,
        entryPrice: calculatedOrder.entryPrice,
      })
      return {
        orderId: `sim_${Date.now()}`,
        simulation: true,
      }
    }

    try {
      log.info('Placing real order', {
        symbol: input.symbol,
        side: calculatedOrder.side,
        quantity: calculatedOrder.quantity,
      })

      const order = await this.bitgetService.placeOrder({
        symbol: input.symbol,
        side: calculatedOrder.side,
        type: 'MARKET',
        qty: calculatedOrder.quantity,
      })

      log.info('Order placed successfully', {
        orderId: order.id,
        symbol: input.symbol,
      })

      return {
        orderId: order.id,
        simulation: false,
      }
    } catch (err) {
      log.error(
        {
          err: {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
        },
        'Failed to place order',
      )
      throw err
    }
  }
}
