/**
 * Calculate percentage from decimal (e.g., 0.02 -> 2)
 */
export function toPercentage(decimal: number): number {
  return decimal * 100
}

/**
 * Calculate decimal from percentage (e.g., 2 -> 0.02)
 */
export function fromPercentage(percentage: number): number {
  return percentage / 100
}

/**
 * Format risk/reward ratio
 */
export function formatRiskRewardRatio(ratio: number): string {
  return `1:${ratio.toFixed(2)}`
}

/**
 * Calculate profit/loss percentage
 */
export function calculateProfitLossPct(
  entryPrice: number,
  exitPrice: number,
  side: 'BUY' | 'SELL',
): number {
  if (side === 'BUY') {
    return ((exitPrice - entryPrice) / entryPrice) * 100
  } else {
    return ((entryPrice - exitPrice) / entryPrice) * 100
  }
}

