import type { TradeState, TradeAction, TradeEvaluation } from './types.js'
import {
  getNextExitLevel,
  shouldExecutePartialExit,
  calculateExitQuantity,
} from './exitStrategy.js'
import {
  calculateTrailingStop,
  shouldUpdateTrailingStop,
  shouldTriggerTrailingStop,
} from './trailingStop.js'

/**
 * Evaluate a trade and determine what actions should be taken
 */
export function evaluateTrade(trade: TradeState): TradeEvaluation {
  const actions: TradeAction[] = []
  const currentProfitPct = calculateCurrentProfitPct(trade)
  const remainingQuantity = trade.quantity - trade.exitedQuantity

  // Check for trailing stop trigger first (highest priority)
  if (shouldTriggerTrailingStop(trade)) {
    actions.push({
      type: 'trigger_trailing_stop',
      quantity: remainingQuantity,
    })
    return {
      actions,
      currentProfitPct,
      remainingQuantity,
    }
  }

  // Check for partial exit
  if (trade.exitStrategy && trade.exitStrategy.levels.length > 0) {
    const nextLevel = getNextExitLevel(trade)
    if (nextLevel && shouldExecutePartialExit(trade, nextLevel)) {
      const exitQuantity = calculateExitQuantity(trade, nextLevel)
      if (exitQuantity > 0) {
        actions.push({
          type: 'partial_exit',
          level: nextLevel,
          quantity: exitQuantity,
        })
      }
    }
  }

  // Check for trailing stop update
  if (trade.trailingStopConfig && trade.trailingStopConfig.enabled) {
    const newTrailingStopPrice = calculateTrailingStop(trade, trade.trailingStopConfig)
    if (
      newTrailingStopPrice !== null &&
      shouldUpdateTrailingStop(trade, newTrailingStopPrice)
    ) {
      actions.push({
        type: 'update_trailing_stop',
        newTrailingStopPrice,
      })
    }
  }

  // If no actions, return no_action
  if (actions.length === 0) {
    actions.push({ type: 'no_action' })
  }

  return {
    actions,
    currentProfitPct,
    remainingQuantity,
  }
}

/**
 * Get all actions for a trade (may return multiple actions)
 */
export function getTradeActions(trade: TradeState): TradeAction[] {
  const evaluation = evaluateTrade(trade)
  return evaluation.actions
}

/**
 * Calculate current profit percentage
 */
function calculateCurrentProfitPct(trade: TradeState): number {
  if (trade.entryPrice <= 0 || !isFinite(trade.entryPrice)) {
    return 0
  }

  if (trade.side === 'BUY') {
    return (trade.currentPrice - trade.entryPrice) / trade.entryPrice
  } else {
    // SELL: profit when price goes down
    return (trade.entryPrice - trade.currentPrice) / trade.entryPrice
  }
}

