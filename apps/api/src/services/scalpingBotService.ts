import type { Logger } from '../logger'
import { ScalpingService } from './scalpingService'
import { ScalpingOrderService } from './scalpingOrderService'
import { ScalpingStrategyService } from './scalpingStrategyService'

export interface ScalpingBotCycleResult {
  processed: number
  ordersPlaced: number
  errors: number
}

export class ScalpingBotService {
  constructor(
    private logger: Logger,
    private scalpingService: ScalpingService,
    private orderService: ScalpingOrderService,
    private strategyService: ScalpingStrategyService,
  ) {}

  async runCycle(): Promise<ScalpingBotCycleResult> {
    const activeStrategies = await this.strategyService.getActiveStrategies()

    if (activeStrategies.length === 0) {
      return {
        processed: 0,
        ordersPlaced: 0,
        errors: 0,
      }
    }

    let ordersPlaced = 0
    let errors = 0

    for (const strategy of activeStrategies) {
      try {
        const analysis = await this.scalpingService.analyzeSymbol(strategy.symbol)

        if (!analysis || !analysis.recommendedEntry || !analysis.stopLoss) {
          continue
        }

        if (analysis.recommendedEntry.confidence < strategy.minConfidence) {
          continue
        }

        const calculatedOrder = await this.orderService.calculateOrder({
          symbol: strategy.symbol,
          capital: strategy.maxCapital,
          leverage: strategy.leverage,
          analysis,
          simulation: false,
        })

        if (calculatedOrder.positionSize > strategy.maxCapital) {
          continue
        }

        const result = await this.orderService.placeOrder(
          {
            symbol: strategy.symbol,
            capital: strategy.maxCapital,
            leverage: strategy.leverage,
            analysis,
            simulation: false,
          },
          calculatedOrder,
        )

        if (!result.simulation) {
          ordersPlaced++
        }
      } catch (err) {
        errors++
        this.logger.error(
          {
            err: {
              message: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            },
            strategyId: strategy.id,
            symbol: strategy.symbol,
          },
          'Error processing scalping strategy',
        )
      }
    }

    return {
      processed: activeStrategies.length,
      ordersPlaced,
      errors,
    }
  }
}

