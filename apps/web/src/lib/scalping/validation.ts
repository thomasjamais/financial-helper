import type { ScalpingStrategyFormData } from '../../hooks/scalping/useScalpingStrategies'

export function validateScalpingStrategyForm(
  data: ScalpingStrategyFormData,
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  if (!data.symbol || data.symbol.trim().length === 0) {
    errors.symbol = 'Symbol is required'
  } else if (!data.symbol.endsWith('USDT')) {
    errors.symbol = 'Symbol must be a USDT pair (e.g., BTCUSDT)'
  }

  if (data.maxCapital <= 0) {
    errors.maxCapital = 'Max capital must be greater than 0'
  }

  if (data.leverage < 1 || data.leverage > 125) {
    errors.leverage = 'Leverage must be between 1 and 125'
  }

  if (data.riskPerTrade <= 0 || data.riskPerTrade > 1) {
    errors.riskPerTrade = 'Risk per trade must be between 0 and 100%'
  }

  if (data.minConfidence < 0 || data.minConfidence > 1) {
    errors.minConfidence = 'Min confidence must be between 0 and 100%'
  }

  if (data.maxOpenPositions < 1 || data.maxOpenPositions > 10) {
    errors.maxOpenPositions = 'Max open positions must be between 1 and 10'
  }

  if (data.feeRate < 0 || data.feeRate > 0.01) {
    errors.feeRate = 'Fee rate must be between 0 and 1%'
  }

  if (data.slippageBps < 0 || data.slippageBps > 100) {
    errors.slippageBps = 'Slippage must be between 0 and 100 bps'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

