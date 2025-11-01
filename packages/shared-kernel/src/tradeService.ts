export type PortfolioAssetUSD = {
  asset: string
  valueUSD: number
}

export type TradeSuggestion = {
  asset: string
  action: 'BUY' | 'SELL'
  deltaUSD: number
  currentUSD: number
  targetUSD: number
}

export function computeSpotTrades(
  portfolio: Array<PortfolioAssetUSD>,
  recommendedAllocations: Record<string, number>,
  totalValueUSD: number,
  minAbsoluteUsd: number = 1,
): TradeSuggestion[] {
  const current = new Map<string, number>()
  for (const p of portfolio) current.set(p.asset, p.valueUSD)

  const trades: TradeSuggestion[] = []
  for (const [asset, targetPct] of Object.entries(recommendedAllocations)) {
    const currentUSD = current.get(asset) ?? 0
    const targetUSD = (Math.max(0, targetPct) / 100) * totalValueUSD
    const deltaUSD = targetUSD - currentUSD
    if (Math.abs(deltaUSD) < minAbsoluteUsd) continue
    trades.push({
      asset,
      action: deltaUSD >= 0 ? 'BUY' : 'SELL',
      deltaUSD: Number(deltaUSD.toFixed(2)),
      currentUSD: Number(currentUSD.toFixed(2)),
      targetUSD: Number(targetUSD.toFixed(2)),
    })
  }
  // Optionally, include assets that appear in current but not in recommendations (treat as 0%)
  for (const [asset, currentUSD] of current.entries()) {
    if (recommendedAllocations[asset] !== undefined) continue
    const targetUSD = 0
    const deltaUSD = targetUSD - currentUSD
    if (Math.abs(deltaUSD) < minAbsoluteUsd) continue
    trades.push({
      asset,
      action: 'SELL',
      deltaUSD: Number(deltaUSD.toFixed(2)),
      currentUSD: Number(currentUSD.toFixed(2)),
      targetUSD: 0,
    })
  }
  return trades.sort((a, b) => Math.abs(b.deltaUSD) - Math.abs(a.deltaUSD))
}

