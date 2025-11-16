export type TradeSide = 'BUY' | 'SELL'

export function calculateTpPrice(
  entryPrice: number,
  tpPct: number,
  side: TradeSide,
): number {
  if (side === 'BUY') {
    return entryPrice * (1 + tpPct)
  } else {
    return entryPrice * (1 - tpPct)
  }
}

export function calculateSlPrice(
  entryPrice: number,
  slPct: number,
  side: TradeSide,
): number {
  if (side === 'BUY') {
    return entryPrice * (1 - slPct)
  } else {
    return entryPrice * (1 + slPct)
  }
}

export function calculateExpectedPnL(
  entryPrice: number,
  targetPrice: number,
  quantity: number,
  side: TradeSide,
): number {
  if (side === 'BUY') {
    return quantity * (targetPrice - entryPrice)
  } else {
    return quantity * (entryPrice - targetPrice)
  }
}

export function calculateRiskRewardRatio(
  expectedGain: number,
  expectedLoss: number,
): number {
  if (expectedLoss === 0) {
    return expectedGain > 0 ? Infinity : 0
  }
  return Math.abs(expectedGain / expectedLoss)
}

export function calculateProbabilityEstimate(
  currentPrice: number,
  tpPrice: number,
  slPrice: number,
  side: TradeSide,
): number {
  // Simple heuristic: probability based on distance to TP vs SL
  // Closer to TP = higher probability, closer to SL = lower probability
  
  if (side === 'BUY') {
    const distanceToTp = Math.abs(tpPrice - currentPrice)
    const distanceToSl = Math.abs(currentPrice - slPrice)
    const totalDistance = distanceToTp + distanceToSl
    
    if (totalDistance === 0) return 0.5
    
    // Probability is inversely related to distance to TP
    // If we're halfway between entry and TP, probability is ~50%
    const probability = distanceToSl / totalDistance
    return Math.max(0, Math.min(1, probability))
  } else {
    // For SELL, TP is below entry, SL is above entry
    const distanceToTp = Math.abs(currentPrice - tpPrice)
    const distanceToSl = Math.abs(slPrice - currentPrice)
    const totalDistance = distanceToTp + distanceToSl
    
    if (totalDistance === 0) return 0.5
    
    const probability = distanceToSl / totalDistance
    return Math.max(0, Math.min(1, probability))
  }
}

export function calculateUnrealizedPnL(
  entryPrice: number,
  currentPrice: number,
  quantity: number,
  side: TradeSide,
): number {
  return calculateExpectedPnL(entryPrice, currentPrice, quantity, side)
}



