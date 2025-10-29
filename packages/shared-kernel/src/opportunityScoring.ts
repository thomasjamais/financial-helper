export type OpportunityInput = {
  apr: number // 0..1
  durationDays?: number // undefined for flexible
  redeemable: boolean
  liquidityScore?: number // 0..1
}

export function scoreOpportunity(input: OpportunityInput): number {
  const aprScore = clamp01(input.apr)
  const durationPenalty = input.durationDays ? Math.min(input.durationDays, 90) / 90 : 0
  const redeemBonus = input.redeemable ? 0.1 : 0
  const liquidity = input.liquidityScore ?? 0.5

  const base = aprScore * 0.6 + (1 - durationPenalty) * 0.2 + redeemBonus + liquidity * 0.1
  return clamp01(base)
}

function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}


