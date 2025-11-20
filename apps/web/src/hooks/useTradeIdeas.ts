import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../components/AuthContext'
import { apiClient } from '../lib/api'

export type TradeIdea = {
  id: number
  exchange: string
  symbol: string
  side: 'BUY' | 'SELL'
  score: number
  reason?: string
  created_at: string
  priceChange24h?: number | null
  metadata?: {
    source?: string
    validatedIndicators?: Array<{
      name: string
      side: 'BUY' | 'SELL'
      score: number
      reason: string
      details?: Record<string, any>
    }>
    [key: string]: any
  }
}

export type SortBy = 'score' | 'side' | 'created_at'
export type SortOrder = 'asc' | 'desc'

export function useTradeIdeas(
  sortBy: SortBy = 'created_at',
  sortOrder: SortOrder = 'desc',
) {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: ['trade-ideas', sortBy, sortOrder],
    queryFn: async () => {
      const response = await apiClient.get<TradeIdea[]>('/v1/trade-ideas', {
        params: { sortBy, sortOrder },
      })
      return response.data
    },
    enabled: !!accessToken,
    refetchInterval: 60000,
  })
}

export type ExecuteTradeIdeaParams = {
  id: number
  budgetUSD?: number // Optional: if not provided and realTrade=true, uses all available USDT
  risk: 'moderate'
  realTrade?: boolean // Opt-in for real trading (default: false)
}

export function useExecuteTradeIdea() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: ExecuteTradeIdeaParams) => {
      const response = await apiClient.post(
        `/v1/trade-ideas/${params.id}/execute`,
        {
          confirm: true,
          budgetUSD: params.budgetUSD,
          risk: params.risk,
          realTrade: params.realTrade ?? false,
        },
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-ideas'] })
      queryClient.invalidateQueries({ queryKey: ['trades'] })
    },
  })
}

