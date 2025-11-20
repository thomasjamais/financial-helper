import { useMutation } from '@tanstack/react-query'
import { apiClient } from '../../lib/api'

export interface BacktestConfig {
  initialCapital: number
  leverage: number
  riskPerTrade: number
  maxCapitalPerPair: number
  feeRate: number
  slippageBps: number
}

export interface BacktestResult {
  period: string
  startDate: string
  endDate: string
  initialCapital: number
  finalCapital: number
  totalReturn: number
  totalReturnPct: number
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  maxDrawdown: number
  maxDrawdownPct: number
}

export interface MultiplePeriodsBacktestInput {
  symbol: string
  config: BacktestConfig
  minConfidence: number
  maxOpenPositions: number
}

export interface MultiplePeriodsBacktestResult {
  '30d': BacktestResult
  '90d': BacktestResult
  '180d': BacktestResult
  '1y': BacktestResult
}

export function useScalpingBacktestMultiplePeriods() {
  return useMutation({
    mutationFn: async (input: MultiplePeriodsBacktestInput) => {
      const response = await apiClient.post<{ results: MultiplePeriodsBacktestResult }>(
        '/v1/scalping/backtest/multiple-periods',
        {
          symbol: input.symbol,
          config: input.config,
          minConfidence: input.minConfidence,
          maxOpenPositions: input.maxOpenPositions,
        },
      )
      return response.data.results
    },
  })
}

