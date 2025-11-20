import { useMutation } from '@tanstack/react-query'
import { apiClient } from '../../lib/api'
import type { ScalpingAnalysis } from '../../types/scalping'

export interface CalculatedOrder {
  symbol: string
  side: 'BUY' | 'SELL'
  entryPrice: number
  quantity: number
  stopLoss: number
  takeProfits: Array<{ price: number; percentage: number }>
  positionSize: number
  riskAmount: number
  riskPct: number
  maxLoss: number
  maxLossPct: number
  potentialProfit: number
  potentialProfitPct: number
  riskRewardRatio: number
}

export interface PlaceScalpingOrderInput {
  symbol: string
  capital: number
  leverage: number
  analysis: ScalpingAnalysis
  simulation: boolean
}

export interface PlaceScalpingOrderResult {
  order: CalculatedOrder
  result: { orderId: string; simulation: boolean }
}

export function usePlaceScalpingOrder() {
  return useMutation({
    mutationFn: async (input: PlaceScalpingOrderInput) => {
      const response = await apiClient.post<PlaceScalpingOrderResult>(
        '/v1/scalping/place-order',
        {
          symbol: input.symbol,
          capital: input.capital,
          leverage: input.leverage,
          analysis: input.analysis,
          simulation: input.simulation,
        },
      )
      return response.data
    },
  })
}

