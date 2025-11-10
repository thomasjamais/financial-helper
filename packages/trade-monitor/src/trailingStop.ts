import type { TrailingStopConfig, TradeState } from './types.js'

/**
 * Calculate the trailing stop price based on current price and config
 */
export function calculateTrailingStop(
  trade: TradeState,
  config: TrailingStopConfig,
): number | null {
  if (!config.enabled) {
    return null
  }

  const currentProfitPct = calculateCurrentProfitPct(trade)

  // Trailing stop only activates after reaching activation profit threshold
  if (currentProfitPct < config.activationProfitPct) {
    return null
  }

  // Calculate trailing stop price
  if (trade.side === 'BUY') {
    // For BUY: trailing stop is below current price
    const trailingStopPrice = trade.currentPrice * (1 - config.trailDistancePct)
    
    // Ensure it's not below the minimum trail distance
    const minTrailingStopPrice = trade.currentPrice * (1 - config.minTrailDistancePct)
    
    // Use the higher of the two (closer to current price = tighter stop)
    return Math.max(trailingStopPrice, minTrailingStopPrice)
  } else {
    // For SELL: trailing stop is above current price
    const trailingStopPrice = trade.currentPrice * (1 + config.trailDistancePct)
    
    // Ensure it's not above the maximum trail distance
    const maxTrailingStopPrice = trade.currentPrice * (1 + config.minTrailDistancePct)
    
    // Use the lower of the two (closer to current price = tighter stop)
    return Math.min(trailingStopPrice, maxTrailingStopPrice)
  }
}

/**
 * Check if trailing stop should be updated
 */
export function shouldUpdateTrailingStop(
  trade: TradeState,
  newTrailingStopPrice: number,
): boolean {
  if (!trade.trailingStopConfig || !trade.trailingStopConfig.enabled) {
    return false
  }

  const currentProfitPct = calculateCurrentProfitPct(trade)

  // Only update if we've reached activation threshold
  if (currentProfitPct < trade.trailingStopConfig.activationProfitPct) {
    return false
  }

  // If no trailing stop is set yet, set it
  if (trade.currentTrailingStopPrice === null) {
    return true
  }

  // Update if new trailing stop is better (further from entry for BUY, closer to entry for SELL)
  if (trade.side === 'BUY') {
    // For BUY: higher trailing stop is better (locks in more profit)
    return newTrailingStopPrice > trade.currentTrailingStopPrice
  } else {
    // For SELL: lower trailing stop is better (locks in more profit)
    return newTrailingStopPrice < trade.currentTrailingStopPrice
  }
}

/**
 * Check if trailing stop has been triggered
 */
export function shouldTriggerTrailingStop(
  trade: TradeState,
): boolean {
  if (
    !trade.trailingStopConfig ||
    !trade.trailingStopConfig.enabled ||
    trade.currentTrailingStopPrice === null
  ) {
    return false
  }

  if (trade.side === 'BUY') {
    // For BUY: triggered when price falls below trailing stop
    return trade.currentPrice <= trade.currentTrailingStopPrice
  } else {
    // For SELL: triggered when price rises above trailing stop
    return trade.currentPrice >= trade.currentTrailingStopPrice
  }
}

/**
 * Auto-reconfigure trailing stop based on volatility
 * Adjusts trail distance if market conditions change significantly
 */
export function reconfigureTrailingStop(
  config: TrailingStopConfig,
  currentVolatility: number,
  previousVolatility?: number,
): TrailingStopConfig {
  // If no previous volatility, use current config
  if (previousVolatility === undefined) {
    return config
  }

  // Significant change threshold: 50% increase or decrease
  const volatilityChange = Math.abs(
    (currentVolatility - previousVolatility) / previousVolatility,
  )

  if (volatilityChange < 0.5) {
    // No significant change, keep current config
    return config
  }

  // Adjust trail distance based on volatility
  // Higher volatility = wider trail, lower volatility = tighter trail
  let newTrailDistancePct = config.trailDistancePct

  if (currentVolatility > previousVolatility * 1.5) {
    // Volatility increased significantly: widen trail
    newTrailDistancePct = config.trailDistancePct * 1.5
  } else if (currentVolatility < previousVolatility * 0.5) {
    // Volatility decreased significantly: tighten trail
    newTrailDistancePct = Math.max(
      config.minTrailDistancePct,
      config.trailDistancePct * 0.75,
    )
  }

  return {
    ...config,
    trailDistancePct: newTrailDistancePct,
  }
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

