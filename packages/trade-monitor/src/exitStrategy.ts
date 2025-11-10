import type { ExitLevel, ExitStrategy, TradeState } from './types.js'

/**
 * Automatically calculates a multi-exit strategy based on trade parameters
 * Creates 3-4 exit levels distributed across the take profit range
 */
export function calculateExitStrategy(
  tpPct: number,
  volatility?: number,
): ExitStrategy {
  // Default: 4 exit levels
  let numLevels = 4

  // Adjust based on TP percentage
  if (tpPct < 0.02) {
    // Small TP (< 2%): Use 2-3 levels
    numLevels = 2
  } else if (tpPct < 0.05) {
    // Medium TP (2-5%): Use 3 levels
    numLevels = 3
  } else {
    // Large TP (> 5%): Use 4 levels
    numLevels = 4
  }

  // Adjust based on volatility if provided
  if (volatility !== undefined) {
    if (volatility > 0.05) {
      // High volatility: More conservative, fewer levels
      numLevels = Math.max(2, numLevels - 1)
    } else if (volatility < 0.01) {
      // Low volatility: Can use more levels
      numLevels = Math.min(5, numLevels + 1)
    }
  }

  const levels: ExitLevel[] = []
  const quantityPerLevel = 1.0 / numLevels

  // Distribute exits across TP range
  // First exit at ~30% of TP, then evenly spaced
  const firstExitPct = tpPct * 0.3
  const remainingPct = tpPct - firstExitPct
  const spacing = remainingPct / (numLevels - 1)

  for (let i = 0; i < numLevels; i++) {
    if (i === 0) {
      levels.push({
        profitPct: firstExitPct,
        quantityPct: quantityPerLevel,
      })
    } else {
      levels.push({
        profitPct: firstExitPct + spacing * i,
        quantityPct: quantityPerLevel,
      })
    }
  }

  // Ensure last level is exactly at TP
  levels[levels.length - 1].profitPct = tpPct

  return {
    levels,
    autoCalculated: true,
  }
}

/**
 * Get the next exit level that hasn't been executed yet
 */
export function getNextExitLevel(
  trade: TradeState,
): ExitLevel | null {
  if (!trade.exitStrategy || trade.exitStrategy.levels.length === 0) {
    return null
  }

  const currentProfitPct = calculateCurrentProfitPct(trade)
  const remainingQuantityPct = 1.0 - (trade.exitedQuantity / trade.quantity)

  // Find the first level that:
  // 1. Hasn't been reached yet (profitPct > currentProfitPct)
  // 2. Has quantity remaining (quantityPct <= remainingQuantityPct)
  for (const level of trade.exitStrategy.levels) {
    if (level.profitPct > currentProfitPct && level.quantityPct <= remainingQuantityPct) {
      return level
    }
  }

  return null
}

/**
 * Check if a partial exit should be executed
 */
export function shouldExecutePartialExit(
  trade: TradeState,
  level: ExitLevel,
): boolean {
  const currentProfitPct = calculateCurrentProfitPct(trade)
  const remainingQuantityPct = 1.0 - (trade.exitedQuantity / trade.quantity)

  // Execute if:
  // 1. Current profit has reached or exceeded the level's profit target
  // 2. There's enough quantity remaining to execute this level
  return (
    currentProfitPct >= level.profitPct &&
    remainingQuantityPct >= level.quantityPct
  )
}

/**
 * Calculate the quantity to exit for a given level
 */
export function calculateExitQuantity(
  trade: TradeState,
  level: ExitLevel,
): number {
  const remainingQuantity = trade.quantity - trade.exitedQuantity
  const exitQuantity = remainingQuantity * level.quantityPct

  // Don't exit more than remaining quantity
  return Math.min(exitQuantity, remainingQuantity)
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

